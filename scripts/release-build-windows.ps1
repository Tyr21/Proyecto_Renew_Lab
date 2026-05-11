# Build de release en Windows con artefactos del updater (.sig), igual que en CI (sin PFX opcional).
# Uso (desde la raíz del repo, en PowerShell):
#   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Path ruta\clave.minisign -Raw
#   # opcional si la clave tiene contraseña:
#   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '...'
#   npm run release:build:win
#
# Requisitos: Node, Rust, herramientas MSVC, y la clave privada minisign que forma par con plugins.updater.pubkey.
# Ver docs/RELEASE_QUICKSTART.md

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
	Write-Host "Falta la variable de entorno TAURI_SIGNING_PRIVATE_KEY (contenido de la clave privada minisign)." -ForegroundColor Red
	Write-Host "Ejemplo: `$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Path `$HOME\.renew\minisign.key -Raw" -ForegroundColor Yellow
	exit 1
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
$mergePath = Join-Path $repoRoot "src-tauri\tauri-release.local.json"

$minimal = @'
{
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
'@
try {
	Set-Content -Path $mergePath -Value $minimal.TrimStart() -Encoding utf8
	npm run tauri -- build --ci -c $mergePath
	$code = $LASTEXITCODE
} finally {
	Remove-Item $mergePath -Force -ErrorAction SilentlyContinue
}

if ($code -ne 0) {
	exit $code
}

Write-Host ""
Write-Host "Build listo. Instaladores y firmas (updater) en:" -ForegroundColor Green
Write-Host "  $repoRoot\src-tauri\target\release\bundle\nsis\"
Write-Host ""
Write-Host "Siguiente: sube el .exe y el .sig a una URL HTTPS (p. ej. GitHub Release), luego:" -ForegroundColor Cyan
Write-Host "  npm run release:write-manifest -- --url `"https://.../Consultorio Renew Lab_X.Y.Z_x64-setup.exe`""
