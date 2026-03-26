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

## Documentos relacionados

- [ARQUITECTURA.md](./ARQUITECTURA.md) — stack, base de datos, eventos.
- [README.md](../README.md) — arranque rápido del entorno de desarrollo.
