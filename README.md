# Consultorio Renew Lab

Aplicación de **escritorio local** para gestionar citas de **cámaras hiperbáricas** y **sueroterapia**: **Tauri**, **React (Vite)**, **Tailwind CSS** y **SQLite**, sin dependencia de servicios en la nube para el funcionamiento base.

## Documentación canónica

- **[docs/PROJECT.md](docs/PROJECT.md)** — visión del producto, fases e hitos.
- **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)** — stack, esquema de datos y eventos de dominio.
- **[docs/MANUAL_USUARIO.md](docs/MANUAL_USUARIO.md)** — manual de uso para personal del consultorio.

## Requisitos

- [Node.js](https://nodejs.org/) (npm)
- [Rust](https://www.rust-lang.org/tools/install) (cargo, rustup) y, en Windows, herramientas de compilación C++ (Visual Studio Build Tools) para enlazar Tauri.

## Desarrollo

En la raíz del repositorio:

```bash
npm install
npm run tauri dev
```

Esto levanta Vite en `http://localhost:1420/` y ejecuta el binario de Tauri en modo depuración.

Otros comandos útiles:

```bash
npm run dev          # Solo frontend (Vite)
npm run build        # Compilar frontend (tsc + vite build)
npm run test         # Pruebas Vitest (validación y solapes en TS)
npm run tauri build  # Empaquetado de la app de escritorio
```

### Calidad de código

El frontend usa **ESLint** (TypeScript + React) y **Prettier**; ambos integrados sin conflictos vía `eslint-config-prettier`. El backend usa **`cargo fmt`** (configuración en `src-tauri/rustfmt.toml`, tabs duros) y **`cargo clippy`** estricto.

```bash
npm run lint           # ESLint sobre TS/TSX (sin auto-fix)
npm run lint:fix       # ESLint con auto-fix
npm run format         # Prettier --write sobre todo el repo
npm run format:check   # Prettier --check (no modifica archivos; falla si hay diferencias)
```

```bash
cd src-tauri
cargo fmt              # Aplica formato según rustfmt.toml
cargo fmt --check      # Verifica formato sin modificar (lo que corre CI)
cargo clippy --all-targets --locked -- -D warnings   # Lints como errores
```

Antes de un commit no trivial, conviene ejecutar `npm run lint && npm run format:check` en la raíz y `cargo fmt --check && cargo clippy --all-targets -- -D warnings` en `src-tauri/`. El CI de GitHub Actions ejecuta exactamente esos pasos.

Pruebas Rust (reglas de tiempo en el backend):

```bash
cd src-tauri
cargo test
```

Los criterios de producto de la Fase 2 y la lista de comandos de prueba están resumidos en [docs/PROJECT.md](docs/PROJECT.md).

## IDE recomendado

- [VS Code](https://code.visualstudio.com/) + [extensión Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Releases

La versión del producto vive en **`package.json`** (única fuente de verdad).
`src-tauri/tauri.conf.json` la lee automáticamente (`"version": "../package.json"`, feature nativa de Tauri 2) y `src-tauri/Cargo.toml` se sincroniza con un script. La versión visible en la UI (HelpModal → "Acerca de") se importa de `package.json` en build, así que coincide con el instalador siempre que `release:check` pase.

### Publicar una nueva versión

1. `npm run version:bump -- X.Y.Z` — actualiza `package.json` y `src-tauri/Cargo.toml` (admite SemVer con pre-release, p. ej. `1.0.0-rc.1`).
2. Editar [`CHANGELOG.md`](CHANGELOG.md): mover lo aplicable de `[Unreleased]` a una nueva sección `[X.Y.Z] — YYYY-MM-DD` y actualizar los enlaces de comparación al final.
3. `npm run release:check` — valida que las tres versiones sean coherentes.
4. `git add -A && git commit -m "chore(release): vX.Y.Z"`.
5. `git tag vX.Y.Z`.
6. `git push && git push --tags`.

El push del tag dispara [`.github/workflows/ci.yml`](.github/workflows/ci.yml): tras pasar lint/tests/`clippy`, el job `release-build` construye los instaladores Windows (MSI + NSIS) y los publica como artifact `tauri-installers-vX.Y.Z`. Si están configurados los GitHub Secrets de **firma de código** (Authenticode), los artefactos salen firmados; si no, el build sigue siendo válido pero Windows puede mostrar advertencias de SmartScreen en descargas (ver más abajo).

### Firma de código (Windows / Authenticode)

Los instaladores **no están firmados** por defecto. En equipos de usuarios finales, **SmartScreen** y algunos antivirus pueden mostrar mensajes del tipo _aplicación no reconocida_ / _publicador desconocido_ hasta que la aplicación gane reputación o se distribuya con un **certificado de firma de código** emitido por una CA de confianza para Windows.

| Tipo                            | Notas                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OV** (Organization Validated) | Suele bastar para muchos despliegues internos; SmartScreen puede seguir siendo estricto al principio hasta acumular descargas/reputación.                                                        |
| **EV** (Extended Validation)    | Mejor experiencia inicial con SmartScreen en muchos casos; a menudo implica **hardware (token)** o firma en la nube (**Azure Key Vault**, **Trusted Signing**, etc.) más que un único PFX en CI. |

Este repositorio documenta el camino **estándar con PFX (OV u OV-compatible)** y GitHub Actions, alineado con la guía oficial de Tauri: [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/).

#### Secretos en GitHub (repo → _Settings_ → _Secrets and variables_ → _Actions_)

| Secreto                        | Obligatorio si hay firma | Descripción                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WINDOWS_CERTIFICATE`          | Sí                       | Contenido **Base64** del fichero `.pfx`. Recomendado: en Windows, `certutil -encode mi-certificado.pfx gh-secret.txt` y pegar **todo** el contenido de `gh-secret.txt` en el secreto. Alternativa: Base64 de una sola línea del PFX (sin saltos). |
| `WINDOWS_CERTIFICATE_PASSWORD` | Sí                       | Contraseña de exportación del PFX.                                                                                                                                                                                                                |
| `WINDOWS_SIGN_TIMESTAMP_URL`   | No                       | Servidor de sellado de tiempo RFC3161. Por defecto se usa `http://timestamp.digicert.com`. Su CA puede indicar otra URL (`timestamp.sectigo.com`, etc.).                                                                                          |

**No** subas el `.pfx` ni contraseñas al repositorio; solo en GitHub Secrets (o en un gestor tipo HSM, y entonces ver la guía Tauri para `signCommand` / Azure).

#### Qué hace el CI

En el job `release-build`, el paso **Build Tauri (MSI + NSIS)** ejecuta [`scripts/ci-release-windows-build.ps1`](scripts/ci-release-windows-build.ps1):

1. Si **no** existe `WINDOWS_CERTIFICATE`, corre `tauri build` sin firma (aviso en el log).
2. Si existe, decodifica el PFX, lo importa al almacén **CurrentUser\\My** del runner, obtiene el **thumbprint** y fusiona la config con `npm run tauri -- build --ci -c src-tauri/tauri-signing.ci.json` (fichero efímero, ignorado por git), como describe Tauri para CI.
3. Tras el build, comprueba con `Get-AuthenticodeSignature` que los `.exe` relevantes y los `.msi` tengan estado **Valid**.

#### Certificado y exportación PFX (resumen)

1. Adquirir un **certificado de firma de código** (no un certificado SSL de web). Referencia Microsoft: [Code signing certificate management](https://learn.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-cert-manage).
2. Obtener `.pfx` (PKCS#12) con clave privada y contraseña de exportación (OpenSSL u herramientas de la CA).
3. Probar localmente: importar el PFX, copiar el **thumbprint** desde `certmgr.msc` y opcionalmente añadirlo en `src-tauri/tauri.conf.json` bajo `bundle.windows`, o usar el mismo flujo que CI con `-c` y un JSON de fusión.
4. Renovar antes del vencimiento: generar nuevo certificado, actualizar secretos y volver a etiquetar un release.

#### Límites y expectativas

- **SmartScreen** no es solo “¿va firmado?”. Puede seguir avisando la primera vez o con poca reputación; EV y uso continuo suelen mejorar la percepción del usuario.
- **Certificados EV** en token / HSM no suelen exponerse como PFX en GitHub; en ese caso hay que usar **comando de firma personalizado** (`bundle.windows.signCommand` en Tauri) con Azure Key Vault, Trusted Signing u otra herramienta recomendada por la CA.
- Los runners de GitHub son efímeros; el certificado se importa solo durante ese job y no queda en el artefacto subido (solo los instaladores firmados).

## Soporte

- **Logs**: archivo rotado por tamaño (5 MB, mantiene históricos) en el `LogDir` del sistema; en Windows: `%LOCALAPPDATA%\com.premex.consultorio-renew-lab\logs\renew-lab.log` (más rotaciones `renew-lab_<timestamp>.log`). Adjuntar el archivo más reciente al reportar incidencias.
