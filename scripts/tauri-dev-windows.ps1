# Arranque de `tauri dev` con carpeta de usuario de WebView2 en %TEMP%.
# Mitiga fallos al crear el webview (HRESULT 0x80070057) cuando el perfil en AppData está corrupto o hay conflictos de permisos.
# Uso: desde la raíz del repo: npm run tauri:dev:win

$ErrorActionPreference = "Stop"
$dataRoot = Join-Path $env:TEMP "consultorio-renew-lab-webview2"
New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
$env:WEBVIEW2_USER_DATA_FOLDER = $dataRoot
Write-Host "[tauri-dev] WEBVIEW2_USER_DATA_FOLDER=$dataRoot"
Set-Location (Join-Path $PSScriptRoot "..")
npm run tauri -- dev
