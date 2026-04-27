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
