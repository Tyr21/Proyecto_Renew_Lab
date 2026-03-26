# Consultorio Renew Lab — Documento maestro

## Visión del producto

Aplicación de **escritorio local** (**Tauri + React + SQLite**) para gestionar citas de **cámaras hiperbáricas** y **sueroterapia**, con **cero costos recurrentes de nube**. Los datos permanecen en el equipo del consultorio.

## Hitos / fases

La numeración sigue el plan acordado: cada fase es un bloque de producto; el **estado** refleja el código vigente.

| Fase | Estado | Contenido |
|------|--------|-----------|
| **Fase 1** | Completada | Setup de **Tauri**, **React (Vite)**, **Tailwind**, **SQLite** y construcción visual del calendario con **CSS Grid** (celdas de **30 min**, citas por defecto de **1 h**), navegación semanal y ajustes de vista (domingos, formato de hora). |
| **Fase 2** | Completada (refinamiento continuo) | **Conexión calendario ↔ base de datos**: CRUD de citas, configuración (tipos de documento/servicio, capacidades concurrentes), validaciones de **choques de horarios** y reglas de negocio ya persistidas. Lo que sigue aquí es pulir UX, pruebas y reglas adicionales según el consultorio. |
| **Fase 3** | En curso | **Bus de eventos local**: emisión desde la UI, registro en terminal vía Rust; pendiente **extender consumidores** (otros módulos que reaccionen al mismo contrato de eventos). |
| **Fase 4** | Futuro | Módulos de **Inventario** y **Facturación**, **desacoplados** del calendario (solo reaccionan a eventos de dominio). |

## Decisiones clave

- **Calendario:** **CSS Grid nativo** (sin librerías tipo FullCalendar) para control total del layout y solapes tipo agenda.
- **Capacidad por tipo de servicio:** configurable; el calendario no calcula inventario ni cifras económicas.
- **Eventos de dominio:** payload estandarizado para integración futura (ver [ARQUITECTURA.md](./ARQUITECTURA.md)).

## Fase 2 — Criterios de aceptación (validados)

Comportamientos que deben mantenerse al evolucionar el código:

1. **Crear cita:** clic en hueco → modal → datos válidos → guardar; la cita aparece en el rango cargado.
2. **Capacidad concurrente:** para un mismo `service_type`, fecha y solape temporal, no se puede superar la capacidad configurada; el modal muestra ocupación (p. ej. `2 / 2`) y bloquea antes de enviar si el cupo está lleno.
3. **Validación en cliente:** documento (alfanumérico) y teléfono nacional (solo dígitos) se validan en la UI alineados con el backend, sin depender solo del error de `invoke`.
4. **Edición según tiempo:** citas **futuras** — todos los campos editables salvo reglas de negocio; citas **pasadas** — solo **asistencia** (asistió / no asistió); no eliminar ni reescribir agenda en pasado.
5. **Antelación mínima:** no crear citas ni reprogramar fecha/hora a un inicio anterior a **30 minutos** respecto al momento actual (hora local); huecos demasiado próximos quedan deshabilitados en el grid y el modal valida antes de enviar.
6. **Panel “Hoy”:** barra lateral con resumen del **día actual** (paciente, procedimiento, horario); la carga de datos incluye siempre la fecha de hoy aunque la semana visible no la contenga.

## Pruebas y calidad

- **Frontend (Vitest):** en la raíz, `npm run test` — solapes, validación de formulario y antelación mínima (`src/core/*.test.ts`).
- **Backend (Rust):** `cd src-tauri` y `cargo test` — `time_rules` (ventana, solapes, antelación) e integración mínima en `commands` (capacidad concurrente con BD en memoria).
- **Manual:** `npm run tauri dev` — recorrer los flujos de la lista anterior tras cambios en calendario o citas.

## Documentos relacionados

- [ARQUITECTURA.md](./ARQUITECTURA.md) — stack, base de datos, eventos.
- [README.md](../README.md) — arranque rápido del entorno de desarrollo.
