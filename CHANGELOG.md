# Changelog

Todas las modificaciones notables del **Consultorio Renew Lab** se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

Las entradas se escriben en español. Tipos de cambio admitidos por sección:

- **Añadido** — funcionalidad nueva.
- **Cambiado** — cambios en funcionalidad existente.
- **Corregido** — errores resueltos.
- **Obsoleto** — funcionalidad marcada para retirar.
- **Eliminado** — funcionalidad retirada.
- **Seguridad** — cambios con impacto en seguridad.

## [Unreleased]

### Añadido

- **CI (tags `v*`):** firma Authenticode opcional para instaladores Windows (MSI/NSIS) vía GitHub Secrets y [`scripts/ci-release-windows-build.ps1`](scripts/ci-release-windows-build.ps1); verificación con `Get-AuthenticodeSignature`. Documentado en [README](README.md) (sección _Firma de código_).
- **Actualizaciones in-app:** `tauri-plugin-updater` + UI en Configuración; manifiesto en [docs/releases/latest.json](docs/releases/latest.json) y guía en [docs/UPDATES.md](docs/UPDATES.md). El job `release-build` exige `TAURI_SIGNING_PRIVATE_KEY` y sube `.sig` junto a los instaladores.
- **Manual de usuario:** secciones [7.7](docs/MANUAL_USUARIO.md) (Actualizaciones in-app) y [12](docs/MANUAL_USUARIO.md) (roles y datos tras actualizar).

### Cambiado

### Corregido

### Obsoleto

### Eliminado

### Seguridad

## [0.1.0] — 2026-04-27

Primera versión etiquetada del producto. Cubre Fases 1–3 completas y Fase 4 en curso (ver [docs/PROJECT.md](docs/PROJECT.md)).

### Añadido

- **Calendario semanal** con CSS Grid nativo (sin librerías externas), celdas de 30 min y citas por defecto de 1 h, navegación semanal y ajustes de vista (domingos, formato de hora). _(Fase 1)_
- **CRUD de citas** persistido en SQLite con validaciones de capacidad concurrente por tipo de servicio, choques de horarios, periodo de gracia de 15 min y edición restringida según pasado/futuro. _(Fase 2)_
- **Bus de eventos local** Rust → TypeScript: emisión desde `tauri::Emitter::emit` tras persistir, frontend suscrito con `@tauri-apps/api/event`. _(Fase 3)_
- **Finanzas:** tabla `ingresos`, comandos `crear_ingreso` / `obtener_ingresos`, modal de pago abierto por `FinanceEventListener` ante `cita_completada`. _(Fase 4)_
- **Facturación local:** tablas `facturas`, `factura_lineas`, `facturacion_contadores`; estados borrador → emitida → anulada; numeración consecutiva atómica por serie; líneas con IVA configurable; emisión transaccional con ingreso automático; impresión HTML; columna `dian_metadata_json` preparada para integración futura. _(Fase 4)_
- **Oxígeno (cámara hiperbárica):** tabla `oxigeno_eventos`, ajustes `oxygen` en `app_config`, registro con validación EXIF de la foto, resumen en Reportes → Cierre de caja y subpestaña Oxígeno. _(Fase 4)_
- **Autenticación local dual:** contraseña de inicio (opcional) y contraseña de administrador, ambas con hashes Argon2 en tablas dedicadas; modo administrador no persiste entre sesiones.
- **Respaldos locales:** comandos `listar_respaldos_locales`, `restaurar_respaldo` y prefijo/extensión estandarizados (`consultorio_*.db`).
- **CI Windows:** workflow de GitHub Actions con lint (ESLint + Prettier), tests (Vitest + `cargo test --locked`), build (`tsc + Vite`), `cargo fmt --check` y `cargo clippy -- -D warnings`. En tags `v*` construye instaladores MSI + NSIS y los publica como artifact.
- **Tooling:** ESLint + Prettier integrados sin conflictos, `rustfmt` con tabs duros y `cargo clippy` estricto.
- **Metadatos del paquete Tauri** alineados con el producto real (descripción, autor, repositorio, homepage en `src-tauri/Cargo.toml`).

[Unreleased]: https://github.com/Tyr21/Proyecto_Renew_Lab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Tyr21/Proyecto_Renew_Lab/releases/tag/v0.1.0
