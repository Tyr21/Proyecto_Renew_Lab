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

## Soporte

- **Logs**: archivo rotado por tamaño (5 MB, mantiene históricos) en el `LogDir` del sistema; en Windows: `%LOCALAPPDATA%\com.premex.consultorio-renew-lab\logs\renew-lab.log` (más rotaciones `renew-lab_<timestamp>.log`). Adjuntar el archivo más reciente al reportar incidencias.
