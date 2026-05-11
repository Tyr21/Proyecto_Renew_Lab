# Build de release de LABORATORIO (updater): usa merge src-tauri/tauri.updater-lab.json.
# Ejecute antes: npm run updater:lab:init
#
# La clave privada se toma de TAURI_SIGNING_PRIVATE_KEY o, si falta, del archivo src-tauri/.updater-lab-demo

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$labKey = Join-Path $repoRoot "src-tauri\.updater-lab-demo"
$labMerge = Join-Path $repoRoot "src-tauri\tauri.updater-lab.json"

if (-not (Test-Path $labMerge)) {
	Write-Host "No existe $labMerge. Ejecute: npm run updater:lab:init" -ForegroundColor Red
	exit 1
}

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
	if (Test-Path $labKey) {
		$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Path $labKey -Raw
		Write-Host "Usando clave de laboratorio en $labKey" -ForegroundColor Cyan
	}
}

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
	Write-Host "Falta TAURI_SIGNING_PRIVATE_KEY o el archivo $labKey" -ForegroundColor Red
	exit 1
}

npm run tauri -- build --ci -c $labMerge
exit $LASTEXITCODE
