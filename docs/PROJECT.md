# Consultorio Renew Lab — Documento maestro

## Visión del producto

Aplicación de **escritorio local** (**Tauri + React + SQLite**) para gestionar citas de **cámaras hiperbáricas** y **sueroterapia**, con **cero costos recurrentes de nube**. Los datos permanecen en el equipo del consultorio.

## Hitos / fases

La numeración sigue el plan acordado: cada fase es un bloque de producto; el **estado** refleja el código vigente.

| Fase       | Estado                             | Contenido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fase 1** | Completada                         | Setup de **Tauri**, **React (Vite)**, **Tailwind**, **SQLite** y construcción visual del calendario con **CSS Grid** (celdas de **30 min**, citas por defecto de **1 h**), navegación semanal y ajustes de vista (domingos, formato de hora).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Fase 2** | Completada (refinamiento continuo) | **Conexión calendario ↔ base de datos**: CRUD de citas, configuración (tipos de documento/servicio, capacidades concurrentes), validaciones de **choques de horarios** y reglas de negocio ya persistidas. Lo que sigue aquí es pulir UX, pruebas y reglas adicionales según el consultorio.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Fase 3** | Completada                         | **Bus de eventos local**: emisión **solo desde Rust** tras persistir (`tauri::Emitter::emit` + payload JSON en `commands.rs`); el frontend se suscribe con `@tauri-apps/api/event` (`listen`). Consumidor de prueba: `CitaEventNotifier` (consola + toast). **Extender consumidores** (Inventario/Finanzas) en fases posteriores sin acoplar al calendario.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Fase 4** | En curso                           | **Finanzas:** tabla `ingresos`, comandos `crear_ingreso` / `obtener_ingresos`, modal de pago abierto por **`FinanceEventListener`** al evento `cita_completada`. **Facturación local:** tablas `facturas`, `factura_lineas`, `facturacion_contadores`; estados borrador → emitida → anulada; numeración consecutiva atómica por serie; líneas con IVA configurable; emisión con ingreso automático en una transacción; impresión HTML; datos fiscales del consultorio en `BillingSettings`; opción de generar factura desde el modal de pago rápido. Diseño preparado para futura integración DIAN (columna `dian_metadata_json`). **Oxígeno (cámara hiperbárica):** tabla `oxigeno_eventos`, ajustes `oxygen` en `app_config`, registro con validación EXIF de la foto, resumen en **Reportes → Cierre de caja** y subpestaña **Oxígeno**. **Inventario** (otros insumos) pendiente. |

## Decisiones clave

- **Calendario:** **CSS Grid nativo** (sin librerías tipo FullCalendar) para control total del layout y solapes tipo agenda.
- **Capacidad por tipo de servicio:** configurable; el calendario no calcula inventario ni cifras económicas.
- **Eventos de dominio:** payload estandarizado para integración futura (ver [ARQUITECTURA.md](./ARQUITECTURA.md)).
- **Autenticación local:** dos secretos distintos — **contraseña de inicio** (opcional, para abrir la app) y **contraseña de administrador** (acceso a Configuración y confirmación del modo administrador). Hashes **Argon2** en tablas dedicadas; el modo administrador (`adminMode` en `app_config`) **no permanece activo entre sesiones**: al arrancar la aplicación se fuerza a `false` en base de datos. Detalle técnico en [ARQUITECTURA.md](./ARQUITECTURA.md) (secciones _Autenticación local y tablas de seguridad_ y _Consideraciones de seguridad_).

## Autenticación local (resumen de producto)

| Concepto                                  | Comportamiento                                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inicio de la app**                      | Si existe contraseña de inicio en BD, pantalla de verificación antes del resto de la UI.                                                                                          |
| **Configuración**                         | Requiere contraseña de administrador al entrar al tab (creación la primera vez, o verificación si ya existe). Al salir del tab y volver, se vuelve a pedir.                       |
| **Modo administrador**                    | Checkbox en Administración: activar/desactivar pide contraseña de administrador. Tras guardar, puede usarse en la sesión; **al cerrar y reabrir la app** queda desactivado.       |
| **Contraseña de inicio (gestión)**        | Solo con modo administrador activo en el borrador de configuración: establecer, cambiar, restablecer con admin, o quitar (solo con contraseña de administrador, no la de inicio). |
| **Contraseña de administrador (gestión)** | Solo con modo administrador activo: cambiar o eliminar la contraseña de admin.                                                                                                    |

> La BD SQLite permanece **sin cifrado** por defecto; la protección es adecuada frente a uso casual, no frente a copia física del archivo por un atacante avanzado (ver _Consideraciones de seguridad_ en [ARQUITECTURA.md](./ARQUITECTURA.md)).

## Fase 2 — Criterios de aceptación (validados)

Comportamientos que deben mantenerse al evolucionar el código:

1. **Crear cita:** clic en hueco → modal → datos válidos → guardar; la cita aparece en el rango cargado.
2. **Capacidad concurrente:** para un mismo `service_type`, fecha y solape temporal, no se puede superar la capacidad configurada; el modal muestra ocupación (p. ej. `2 / 2`) y bloquea antes de enviar si el cupo está lleno.
3. **Validación en cliente:** documento (alfanumérico) y teléfono nacional (solo dígitos) se validan en la UI alineados con el backend, sin depender solo del error de `invoke`.
4. **Edición según tiempo:** citas **futuras** — todos los campos editables salvo reglas de negocio; citas **pasadas** — solo **asistencia** (asistió / no asistió); no eliminar ni reescribir agenda en pasado.
5. **Periodo de gracia:** crear o reprogramar solo si la hora actual no supera el **inicio del slot + 15 minutos** (hora local), para permitir walk-ins en franjas ya iniciadas sin exceder el alistamiento clínico; el grid deshabilita huecos fuera de esa ventana y el modal valida antes de enviar.
6. **Panel “Hoy”:** barra lateral con resumen del **día actual** (paciente, procedimiento, horario); la carga de datos incluye siempre la fecha de hoy aunque la semana visible no la contenga.

## Pruebas y calidad

- **Frontend (Vitest):** en la raíz, `npm run test` — solapes, validación de formulario, periodo de gracia y cálculos de totales de factura (`src/core/*.test.ts`).
- **Backend (Rust):** `cd src-tauri` y `cargo test` — `time_rules` (ventana, solapes, periodo de gracia), integración en `commands` (capacidad concurrente con BD en memoria), `facturacion` (borrador → emisión → consecutivo → ingreso, edición rechazada en emitida), y `oxigeno` (parseo EXIF / conteo de sesiones en pruebas).
- **Manual:** `npm run tauri dev` — recorrer los flujos de la lista anterior tras cambios en calendario o citas; al crear/editar/eliminar citas, comprobar consola del WebView y toast inferior por eventos de dominio (`cita_*`).

## Documentos relacionados

- [PRINCIPIANTES_VERSIONES_Y_ACTUALIZACIONES.md](./PRINCIPIANTES_VERSIONES_Y_ACTUALIZACIONES.md) — vocabulario sencillo: instalador, versión, actualizaciones.
- [MANUAL_USUARIO.md](./MANUAL_USUARIO.md) — guía de uso para personal del consultorio (pantallas, opciones, seguridad y actualizaciones in-app).
- [UPDATES.md](./UPDATES.md) — referencia técnica del updater (HTTPS, minisign).
- [RELEASE_QUICKSTART.md](./RELEASE_QUICKSTART.md) — checklist para publicar versiones y manifiesto del updater.
- [UPDATER_LAB_PASO_A_PASO.md](./UPDATER_LAB_PASO_A_PASO.md) — prueba guiada del updater sin claves de producción.
- [ARQUITECTURA.md](./ARQUITECTURA.md) — stack, base de datos, eventos.
- [README.md](../README.md) — arranque rápido del entorno de desarrollo.
