# Build de release Windows (MSI + NSIS) con firma opcional Authenticode en CI.
# Requisitos (GitHub Secrets): ver README sección "Firma de código (Windows)".
# Uso: desde la raíz del repo, con variables de entorno ya definidas por el workflow.

$ErrorActionPreference = "Stop"

function Write-NoticeCI {
	param([string]$Message)
	Write-Host "::notice::$Message"
}

if ([string]::IsNullOrWhiteSpace($env:WINDOWS_CERTIFICATE)) {
	Write-NoticeCI "WINDOWS_CERTIFICATE no configurado: tauri build sin firma Authenticode (esperado en forks o antes de comprar certificado)."
	npm run tauri -- build --ci
	exit $LASTEXITCODE
}

if ([string]::IsNullOrWhiteSpace($env:WINDOWS_CERTIFICATE_PASSWORD)) {
	throw "WINDOWS_CERTIFICATE está definido pero falta WINDOWS_CERTIFICATE_PASSWORD."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$certDir = Join-Path $repoRoot "certificate"
New-Item -ItemType Directory -Path $certDir -Force | Out-Null
$pfxPath = Join-Path $certDir "certificate.pfx"
$tempTxt = Join-Path $certDir "_secret_b64.txt"
$mergePath = Join-Path $repoRoot "src-tauri\tauri-signing.ci.json"

try {
	Remove-Item $pfxPath -Force -ErrorAction SilentlyContinue
	Set-Content -Path $tempTxt -Value $env:WINDOWS_CERTIFICATE

	& certutil.exe -decode $tempTxt $pfxPath | Out-Null
	$decodedOk =
		($LASTEXITCODE -eq 0) -and (Test-Path $pfxPath) -and ((Get-Item $pfxPath).Length -gt 100)

	if (-not $decodedOk) {
		Remove-Item $pfxPath -Force -ErrorAction SilentlyContinue
		$b64 = ($env:WINDOWS_CERTIFICATE -replace "(?m)^-----.*?-----$", "" -replace "\s", "")
		try {
			$bytes = [System.Convert]::FromBase64String($b64)
			[System.IO.File]::WriteAllBytes($pfxPath, $bytes)
		} catch {
			throw "No se pudo decodificar WINDOWS_CERTIFICATE. Use la salida de ``certutil -encode cert.pfx out.txt`` (recomendado) o Base64 de una sola línea del PFX."
		}
		if (-not (Test-Path $pfxPath) -or (Get-Item $pfxPath).Length -lt 100) {
			throw "El PFX decodificado parece vacío o corrupto."
		}
	}

	$pwd = ConvertTo-SecureString -String $env:WINDOWS_CERTIFICATE_PASSWORD -AsPlainText -Force
	$imported = Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation Cert:\CurrentUser\My -Password $pwd
	$thumb = $imported.Thumbprint

	$ts = $env:WINDOWS_SIGN_TIMESTAMP_URL
	if ([string]::IsNullOrWhiteSpace($ts)) {
		$ts = "http://timestamp.digicert.com"
	}

	$mergeJson = @"
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "$thumb",
      "digestAlgorithm": "sha256",
      "timestampUrl": "$ts"
    }
  }
}
"@
	Set-Content -Path $mergePath -Value $mergeJson.TrimStart() -Encoding utf8

	npm run tauri -- build --ci -c $mergePath
	if ($LASTEXITCODE -ne 0) {
		exit $LASTEXITCODE
	}

	$toVerify = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
	$patterns = @(
		(Join-Path $repoRoot "src-tauri\target\release\bundle\nsis\*.exe")
		(Join-Path $repoRoot "src-tauri\target\release\bundle\msi\*.msi")
	)
	foreach ($pat in $patterns) {
		$found = Get-ChildItem -Path $pat -File -ErrorAction SilentlyContinue
		foreach ($f in @($found)) {
			if ($f) {
				$toVerify.Add($f)
			}
		}
	}
	$releaseExes = Get-ChildItem -Path (Join-Path $repoRoot "src-tauri\target\release\*.exe") -File -ErrorAction SilentlyContinue
	foreach ($f in @($releaseExes)) {
		if ($f) {
			$toVerify.Add($f)
		}
	}

	if ($toVerify.Count -eq 0) {
		throw "No se encontraron binarios ni instaladores bajo src-tauri/target/release para verificar firma."
	}

	foreach ($f in $toVerify) {
		$sig = Get-AuthenticodeSignature -FilePath $f.FullName
		if ($sig.Status -ne "Valid") {
			throw "Firma Authenticode no válida en $($f.Name): $($sig.Status) — $($sig.StatusMessage)"
		}
		Write-Host "Authenticode OK: $($f.Name) — $($sig.SignerCertificate.Subject)"
	}
} finally {
	Remove-Item $tempTxt -Force -ErrorAction SilentlyContinue
	Remove-Item $pfxPath -Force -ErrorAction SilentlyContinue
	Remove-Item $certDir -Recurse -Force -ErrorAction SilentlyContinue
	Remove-Item $mergePath -Force -ErrorAction SilentlyContinue
}
