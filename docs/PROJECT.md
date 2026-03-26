# Consultorio Renew Lab — Documento maestro

## Visión del producto

Aplicación de **escritorio local** (**Tauri + React + SQLite**) para gestionar citas de **cámaras hiperbáricas** y **sueroterapia**, con **cero costos recurrentes de nube**. Los datos permanecen en el equipo del consultorio.

## Hitos / fases

| Fase | Estado | Contenido |
|------|--------|-----------|
| **Fase 1** | Completada / actual | Setup de Tauri, React (Vite), Tailwind, SQLite y construcción visual del calendario basado en **CSS Grid** (celdas de **30 min**, citas por defecto de **1 h**). Incluye navegación semanal, configuración (domingos, formato de hora, tipos de documento/servicio, capacidades), formulario de citas y persistencia local. |
| **Fase 2** | Próxima | Profundizar la **conexión calendario ↔ datos**: refinamiento de UX, pruebas de carga, reglas adicionales de negocio y validaciones de **choques de horarios** según evolución del consultorio. *(Parte del CRUD y validaciones básicas ya existe en el código base; esta fase formaliza evolución y endurecimiento.)* |
| **Fase 3** | Planificada | **Bus de eventos local** consumido por otros módulos (hoy ya hay emisión y registro en terminal; falta extender consumidores). |
| **Fase 4** | Futuro | Módulos de **Inventario** y **Facturación**, **desacoplados** del calendario (solo reaccionan a eventos de dominio). |

## Decisiones clave

- **Calendario:** **CSS Grid nativo** (sin librerías tipo FullCalendar) para control total del layout y solapes tipo agenda.
- **Capacidad por tipo de servicio:** configurable; el calendario no calcula inventario ni cifras económicas.
- **Eventos de dominio:** payload estandarizado para integración futura (ver [ARQUITECTURA.md](./ARQUITECTURA.md)).

## Documentos relacionados

- [ARQUITECTURA.md](./ARQUITECTURA.md) — stack, base de datos, eventos.
- [README.md](../README.md) — arranque rápido del entorno de desarrollo.
