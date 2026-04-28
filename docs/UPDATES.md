# Actualizaciones in-app (Tauri Updater)

**Importante:** el valor de `plugins.updater.pubkey` en `src-tauri/tauri.conf.json` debe formar **par minisign** con el secreto `TAURI_SIGNING_PRIVATE_KEY` en GitHub Actions. Si acaba de clonar el repositorio, genere un par nuevo (`npx tauri signer generate`), actualice la clave pública en `tauri.conf.json` y configure el secreto con la clave privada antes del primer release con updater.

Esta aplicación usa el plugin oficial **tauri-plugin-updater**: el binario comprueba un manifiesto JSON en **HTTPS**, descarga el instalador publicado y verifica la firma **minisign** antes de instalar.

Para detalle orientado a personal del consultorio y a quien despliega la app, véase [MANUAL_USUARIO.md](MANUAL_USUARIO.md) (secciones **7.7** y **12**).

## URL del manifiesto

Por defecto, `src-tauri/tauri.conf.json` apunta a:

`https://raw.githubusercontent.com/Tyr21/Proyecto_Renew_Lab/main/docs/releases/latest.json`

Tras un fork o cambio de rama, actualice `plugins.updater.endpoints` para que coincida con su hosting estable (misma URL en todos los builds que deben recibir actualizaciones). Hasta que `docs/releases/latest.json` exista en esa ruta pública, la petición devolverá error (p. ej. 404 y HTML en lugar de JSON).

## Modo `tauri dev`

Por defecto, **Configuración → Actualizaciones** no llama al remoto en desarrollo para evitar mensajes confusos cuando el manifiesto aún no está publicado o el updater no aplica al binario en caliente. Para forzar la misma comprobación que en producción, cree `.env` en la raíz del frontend con `VITE_UPDATER_IN_DEV=true` y reinicie Vite.

## Clave pública y secreto de firma

1. Genere un par minisign (solo la **privada** vivirá en CI o en su máquina segura):

   ```bash
   npx tauri signer generate -w src-tauri/.updater-key.local
   ```

   Los archivos `src-tauri/.updater-key.local*` están en `.gitignore`.

2. Copie el contenido **completo** del `.pub` (dos líneas en base64) al campo `plugins.updater.pubkey` en `tauri.conf.json`, como un único literal con `\n` entre líneas si las pega en una sola línea JSON.

3. En **GitHub Actions**, defina el secreto `TAURI_SIGNING_PRIVATE_KEY` con el contenido de la clave **privada** (y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` si la clave está cifrada). Debe ser el mismo par que la `pubkey` versionada; si rota el par, actualice ambos a la vez.

## Publicar una release que los consultorios reciban por updater

1. Siga el flujo de versión del README (`version:bump`, CHANGELOG, tag `vX.Y.Z`).
2. El job `release-build` genera MSI, NSIS (`.exe`) y los `.sig` junto a cada instalador (minisign).
3. Suba a **GitHub Releases** (u otro dominio solo HTTPS) el `.exe` de NSIS **y** el `.sig` asociado; la URL del `.exe` debe coincidir con la del manifiesto.
4. Actualice `docs/releases/latest.json` en la rama servida por `endpoints`:
   - `version`: igual que `package.json` / tag (SemVer).
   - `platforms.windows-x86_64.url`: URL HTTPS directa al `.exe`.
   - `platforms.windows-x86_64.signature`: contenido del archivo `.sig` como espera el esquema de Tauri (suelen pegarse como una cadena; compruebe con el primer release real).

Hasta que `latest.json` anuncie una versión **mayor** que la instalada, la comprobación no ofrecerá actualización.

## Limitaciones

- **SmartScreen** y reputación de binarios dependen sobre todo de **firma Authenticode** (certificado de código) y del uso en el campo; el updater no sustituye a un instalador firmado ante Windows.
- Los datos de la aplicación en `app_data_dir` no deberían borrarse en una actualización in-app normal; el instalador NSIS de Tauri actualiza sobre la instalación existente. Conviene probar siempre con copia de la base antes de desplegar a producción.
- MSIX u otros formatos pueden tener reglas distintas; este proyecto documenta el flujo **NSIS + windows-x86_64** alineado con los artefactos del CI.
