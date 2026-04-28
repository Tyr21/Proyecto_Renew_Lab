# Build de release Windows (MSI + NSIS) con artefactos de updater (minisign) y firma opcional Authenticode.
# Requisitos: TAURI_SIGNING_PRIVATE_KEY (minisign para .sig del updater). Opcional: GitHub Secrets de PFX (README).
# Fusiona siempre `createUpdaterArtifacts: true` vía JSON efímero (ignorado por git).

$ErrorActionPreference = "Stop"

function Write-NoticeCI {
	param([string]$Message)
	Write-Host "::notice::$Message"
}

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
	throw 'Falta TAURI_SIGNING_PRIVATE_KEY. El job release-build debe definir este secreto (clave privada minisign) para generar firmas .sig del updater. Ver README, sección Actualizaciones in-app.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
$mergePath = Join-Path $repoRoot "src-tauri\tauri-release.ci.json"

function Invoke-TauriReleaseBuild {
	try {
		npm run tauri -- build --ci -c $mergePath
		return $LASTEXITCODE
	} finally {
		Remove-Item $mergePath -Force -ErrorAction SilentlyContinue
	}
}

if ([string]::IsNullOrWhiteSpace($env:WINDOWS_CERTIFICATE)) {
	Write-NoticeCI "WINDOWS_CERTIFICATE no configurado: build sin firma Authenticode (solo minisign del updater)."
	$minimal = @'
{
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
'@
	Set-Content -Path $mergePath -Value $minimal.TrimStart() -Encoding utf8
	exit (Invoke-TauriReleaseBuild)
}

if ([string]::IsNullOrWhiteSpace($env:WINDOWS_CERTIFICATE_PASSWORD)) {
	throw "WINDOWS_CERTIFICATE está definido pero falta WINDOWS_CERTIFICATE_PASSWORD."
}

$certDir = Join-Path $repoRoot "certificate"
New-Item -ItemType Directory -Path $certDir -Force | Out-Null
$pfxPath = Join-Path $certDir "certificate.pfx"
$tempTxt = Join-Path $certDir "_secret_b64.txt"

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
    "createUpdaterArtifacts": true,
    "windows": {
      "certificateThumbprint": "$thumb",
      "digestAlgorithm": "sha256",
      "timestampUrl": "$ts"
    }
  }
}
"@
	Set-Content -Path $mergePath -Value $mergeJson.TrimStart() -Encoding utf8

	$code = Invoke-TauriReleaseBuild
	if ($code -ne 0) {
		exit $code
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
}
