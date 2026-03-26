# Arquitectura — Consultorio Renew Lab

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Shell de escritorio | **Tauri 2** (Rust) |
| Interfaz | **React** + **TypeScript**, empaquetado con **Vite** |
| Estilos | **Tailwind CSS** (v4 con plugin Vite) |
| Datos locales | **SQLite** vía **rusqlite** (feature `bundled`) en el proceso Rust |
| Comunicación UI ↔ datos | Comandos Tauri (`invoke`), sin SQL expuesto al frontend |

La base de datos reside en el directorio de datos de la aplicación (`app_data_dir`), archivo `consultorio.db`.

## Esquema de base de datos (inicial)

### Tabla `appointments` (citas)

Representa una cita agendada. Los nombres de columna coinciden con el modelo persistido en Rust.

| Campo (SQL) | Descripción |
|-------------|-------------|
| `id` | Identificador único (UUID en texto) |
| `patient_full_name` | Nombre completo del paciente |
| `document_type` | Tipo de documento (lista configurable, p. ej. CC, NIT) |
| `document_number` | Número de documento (alfanumérico) |
| `phone_dial_code` | Prefijo internacional sin `+` (p. ej. `57`) |
| `phone_national_number` | Número nacional (dígitos) |
| `birthday_month` | Mes de cumpleaños (1–12), uso comercial; puede ser NULL |
| `appointment_date` | Fecha de la cita (`YYYY-MM-DD`, con año) |
| `start_time` | Hora inicio (`HH:MM`, 24 h internamente) |
| `end_time` | Hora fin (`HH:MM`) |
| `service_type` | Identificador del tipo de servicio (p. ej. `camara_hiperbarica`, `sueroterapia`) |
| `status` | `pendiente` \| `asistio` \| `no_asistio` |
| `created_at` | Marca de creación (ISO-8601) |
| `updated_at` | Marca de actualización (ISO-8601) |

Índice: `appointment_date` para consultas por rango (vista semanal).

### Tabla `app_config`

Una fila (`id = 1`) con `settings_json`: configuración global (domingos, formato de hora, duración por defecto, listas de tipos de documento/servicio y capacidades concurrentes).

## Patrón: arquitectura orientada a eventos local

- Los **módulos de presentación** (calendario, formularios) invocan comandos para **persistir** y, en paralelo, **publican eventos de dominio** en el frontend.
- Un comando Rust opcional **registra en consola** el payload para depuración.
- **No** se acoplan inventario ni facturación al módulo de calendario: solo se preparan **contratos de eventos** para futuros consumidores.

Flujo conceptual:

```text
UI (React) → comandos Tauri → SQLite
     └→ bus de eventos local + log de dominio (Rust)
```

## Definición del payload de eventos

Los eventos como `cita_creada`, `cita_completada` o `cita_cancelada` deben llevar un **payload estandarizado** (campos en snake_case para interoperabilidad):

```json
{
  "cita_id": "<uuid>",
  "paciente_documento": "<documento>",
  "tipo_servicio": "<id de servicio>",
  "estado": "pendiente | asistio | no_asistio",
  "timestamp": "<ISO-8601>"
}
```

- **`tipo_servicio`:** identificador estable (alineado con inventario futuro).
- **`timestamp`:** momento en que se registró la acción en el cliente/servidor local.

## Validación duplicada (Fase 2)

- **Servidor (Rust):** comandos de creación/actualización de citas aplican `validate_against_settings`, ventana horaria (30 min, `07:00`–`20:00`), conteo de solapes por `service_type` frente a `concurrent_capacity`, y **periodo de gracia** (`MAX_GRACE_PERIOD_MINUTES`, 15 min tras el inicio del slot, walk-ins) en **creación** y al **reprogramar** fecha u hora de inicio/fin.
- **Cliente (TypeScript):** `validateAppointmentFormFields`, `countOverlappingSameService` e `isSlotBookableWithGracePeriod` / `gracePeriodBookingErrorMessage` repiten las mismas reglas para feedback inmediato, cupos y huecos; el backend sigue siendo la fuente de verdad.

## Vista semanal: solapes y franja clicable

- El algoritmo de **columnas** para citas solapadas el mismo día está en el frontend (`layoutDayAppointments`); cada bloque muestra nombre, horario y etiqueta de **procedimiento** (resuelta desde `service_types` en configuración).
- La constante **`APPOINTMENT_BLOCK_WIDTH_FRACTION`** (p. ej. `0.85` en `src/core/constants.ts`) define qué fracción del ancho de columna ocupa **en conjunto** la banda de citas solapadas; el resto queda como franja vertical clicable para crear otra cita a la misma hora. Los bloques adyacentes dentro de esa banda se reparten el ancho sin huecos intermedios.

## Panel lateral y carga de datos

- **Resumen de hoy:** lista las citas cuya fecha es el día actual (nombre, procedimiento, rango horario).
- **Rango de consulta:** la petición `list_appointments_range` usa el intervalo que **cubre** tanto la semana visible como la fecha de hoy, para que el panel “Hoy” siga teniendo datos al cambiar de semana.
- **Actualización:** al recargar citas se muestra un indicador discreto (“Actualizando…”) sin vaciar la grilla (menos parpadeo).

## Accesibilidad (modal de cita)

- Contenedor con `role="dialog"`, `aria-modal` y `aria-labelledby` apuntando al título; mensajes de error con `role="alert"` y `aria-live`; foco inicial en el panel al abrir para lectores de pantalla y teclado.

## Documentos relacionados

- [PROJECT.md](./PROJECT.md) — visión y fases.
- [README.md](../README.md) — desarrollo local.
