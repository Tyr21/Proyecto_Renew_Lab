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

Una fila (`id = 1`) con `settings_json`: configuración global (domingos, formato de hora, duración por defecto, listas de tipos de documento/servicio, capacidades concurrentes, **precio sugerido por tipo de servicio** en moneda local, planes de paquete por servicio, **`billing`**, **`backup`**, **`oxygen`** — etiqueta de unidad, consumo teórico por sesión de cámara **K** y `service_type_id` para contar sesiones atendidas —, y **`adminMode`**). JSON antiguo sin campos nuevos se completa al deserializar con `#[serde(default)]`.

**`adminMode`:** se persiste en JSON durante la sesión de edición/guardado, pero **al iniciar el proceso** (`setup` en `lib.rs`, tras `open_connection`) se ejecuta `commands::ensure_persisted_admin_mode_off`: si venía `true` en disco, se reescribe a `false`. Así el modo administrador **no queda activo por defecto** tras cerrar y reabrir la aplicación.

### Tablas `startup_auth` y `admin_auth`

Cada una con una fila fija (`id = 1`) y columna `password_hash` (nullable). Los hashes son **Argon2**; el frontend solo recibe flags del tipo `hasPassword`, nunca el hash.

| Tabla | Uso |
|-------|-----|
| `startup_auth` | Contraseña opcional para desbloquear la app al arrancar (`verify_startup_password`, `set_startup_password`, etc.). |
| `admin_auth` | Contraseña de administrador: acceso al tab Configuración, verificación al cambiar el modo administrador, y operaciones que exigen validar al admin (p. ej. quitar contraseña de inicio vía `clear_startup_password_with_admin`). |

Migraciones en `db.rs` (`run_startup_auth_migration`, `run_admin_auth_migration`).

### Auditoría: cita con ingreso vinculado

Si existe fila en `ingresos` con el `cita_id` de la cita, `update_appointment` rechaza cambios de **estado**, **fecha/hora** o **tipo de servicio** (`service_type`), con mensaje explícito; el cliente deshabilita los mismos campos cuando `isPaid` es verdadero en la lectura de la cita.

### Tabla `ingresos` (Fase 4 — finanzas)

Registro de pagos/ingresos locales. `cita_id` opcional (texto UUID) para enlazar con una cita; el módulo de UI **no** invoca al calendario: el flujo típico es escuchar `cita_completada` y ofrecer registro con datos pre-rellenados.

| Campo (SQL) | Descripción |
|-------------|-------------|
| `id` | PK (UUID en texto) |
| `cita_id` | Opcional, referencia lógica a `appointments.id` |
| `paciente_nombre` | Nombre del paciente (migración incremental, backfill) |
| `paciente_documento` | Documento del paciente |
| `concepto` | Texto (p. ej. etiqueta o id de servicio) |
| `monto` | REAL |
| `metodo_pago` | `Efectivo` \| `Tarjeta` \| `Transferencia` |
| `fecha_pago` | ISO-8601 |
| `factura_id` | Opcional, referencia lógica a `facturas.id` (agregada por migración) |

### Tabla `facturas` (Fase 4 — facturación local)

Documento de venta con snapshot de datos del cliente y totales persistidos (no recalculados tras emitir).

| Campo (SQL) | Descripción |
|-------------|-------------|
| `id` | PK (UUID en texto) |
| `estado` | `borrador` \| `emitida` \| `anulada` |
| `serie` | Prefijo de la numeración (p. ej. `FV`) |
| `numero` | Consecutivo entero dentro de la serie; NULL en borrador. **UNIQUE** `(serie, numero)` donde `numero IS NOT NULL` |
| `cliente_nombre` | Nombre completo del cliente |
| `cliente_documento_tipo` | Tipo de documento (CC, NIT, etc.) |
| `cliente_documento_numero` | Número de documento |
| `subtotal` | Suma de bases imponibles |
| `impuesto_total` | Suma de impuestos |
| `total` | subtotal + impuesto_total |
| `notas` | Texto libre |
| `cita_id` | Opcional, referencia lógica a `appointments.id` |
| `fecha_emision` | ISO-8601, asignada al emitir |
| `anulacion_motivo` | Texto de motivo (solo si anulada) |
| `anulada_at` | ISO-8601 (solo si anulada) |
| `dian_metadata_json` | Reservado para futura integración DIAN (NULL por ahora) |
| `created_at` / `updated_at` | Marcas de auditoría |

### Tabla `factura_lineas`

Líneas ordenadas de cada factura. Totales calculados y persistidos al guardar/emitir para auditoría.

| Campo | Descripción |
|-------|-------------|
| `id` | PK (UUID) |
| `factura_id` | FK a `facturas.id` (CASCADE al eliminar) |
| `orden` | Posición (0-based) |
| `descripcion` | Texto del concepto |
| `cantidad` | REAL > 0 |
| `precio_unitario` | REAL >= 0 |
| `tasa_impuesto_pct` | 0–100 |
| `base_imponible` | cantidad × precio_unitario |
| `impuesto` | base_imponible × (tasa/100) |
| `total_linea` | base_imponible + impuesto |

### Tabla `facturacion_contadores`

Una fila por `serie` (PK). `ultimo_numero` se incrementa atómicamente bajo el `Mutex<Connection>` al emitir.

### Tabla `eventos` (calendario — recordatorios)

Eventos genéricos de calendario: mantenimiento programado, revisiones, alertas internas. No son citas de pacientes.

| Campo | Descripción |
|-------|-------------|
| `id` | PK (UUID) |
| `titulo` | Título del evento |
| `descripcion` | Texto libre opcional |
| `fecha` | `YYYY-MM-DD` |
| `todo_el_dia` | `1` (todo el día) o `0` (hora específica) |
| `hora_inicio` | `HH:MM`, NULL si todo el día |
| `hora_fin` | `HH:MM`, NULL si todo el día |
| `color` | Identificador de color: `amber` \| `rose` \| `violet` \| `teal` \| `sky` \| `slate` |
| `created_at` / `updated_at` | Marcas de auditoría |

Se cargan junto con las citas en `refreshAppointments` y se muestran en el calendario semanal (badges para todo-el-día, bloques con borde punteado para hora específica) y en la sidebar de hoy. El evento `evento_changed` en `window` refresca la vista.

### Tabla `oxigeno_eventos` (control de oxígeno — cámara hiperbárica)

Registro de eventos operativos por día (`fecha_operacion` en `YYYY-MM-DD`): tipo (`recarga_pipeta`, `cierre`; valores históricos `balance_inicial`, `extra` u otros pueden existir en filas antiguas), lecturas `medidor_a` / `medidor_b`, `notas`, ruta relativa de foto bajo el directorio de datos (`oxigeno_fotos/...`), fecha EXIF validada al guardar, `created_at`. La columna `saldo_enfermeria` puede existir en bases antiguas; el formulario actual no la captura (nuevos registros con valor nulo). Índice por `fecha_operacion`.

Las fotos se escriben solo desde comandos Rust en `app_data_dir` (subcarpeta `oxigeno_fotos`). Comandos Tauri: `listar_oxigeno_por_rango`, `registrar_evento_oxigeno`, `resumen_oxigeno_rango`, `leer_foto_oxigeno`, `obtener_ultima_lectura_oxigeno` (módulo `oxigeno.rs`). El resumen por rango cruza estas lecturas con citas `asistio` del `service_type_id` configurado en `oxygen` para el consumo teórico (sesiones × **K**) y deltas entre primera y última lectura del día.

### Reglas de transición de facturas

- **Borrador → Emitida:** asigna número consecutivo, registra `fecha_emision`, opcionalmente crea ingreso vinculado (con `metodo_pago` y `factura_id` + `cita_id`).
- **Emitida → Anulada:** requiere modo administrador y motivo; elimina el ingreso vinculado a la `factura_id`.
- **Borrador:** CRUD libre de cabecera y líneas.
- **Emitida/Anulada:** solo lectura e impresión.

### Extensión DIAN (futura)

La columna `dian_metadata_json` queda reservada para almacenar UUID de documento electrónico, track ID y respuesta del proveedor tecnológico. No se usa actualmente. La numeración local y los estados existentes son compatibles con el flujo DIAN estándar (borrador → envío → aceptación → anulación con nota crédito).

## Patrón: arquitectura orientada a eventos local

- La UI **solo invoca** comandos Tauri (`invoke`), sin publicar eventos de dominio duplicados en el cliente.
- Tras una transacción SQLite exitosa en `commands.rs`, Rust emite eventos con **`AppHandle::emit`** (Tauri 2), visibles para todos los webviews (`listen` en el frontend).
- **No** se acoplan inventario ni facturación al módulo de calendario: los consumidores se suscriben al mismo **contrato de payload** (snake_case). Ejemplo: `FinanceEventListener` escucha solo `cita_completada` y abre el modal de pago con el monto pre-llenado según el **precio sugerido** del `tipo_servicio` en configuración; el calendario no importa ese componente.
- Tras persistir un ingreso desde el modal de pago, la UI dispara en el `window` el evento nativo **`ingreso_registrado`** para que la vista principal vuelva a cargar citas y refleje `isPaid` sin estado obsoleto.
- Al crear, emitir o anular una factura, la UI dispara **`factura_changed`** para que `FacturasDashboard` recargue su listado. Si la emisión incluyó un ingreso, también se dispara `ingreso_registrado`.
- Al crear, editar o eliminar un evento/recordatorio, la UI dispara **`evento_changed`** para que `App.tsx` recargue citas y eventos.

Flujo conceptual:

```text
UI (React) → comandos Tauri → SQLite
                    └→ emit (Rust) → listen (React / otros consumidores)
```

## Definición del payload de eventos

Los eventos como `cita_creada`, `cita_actualizada`, `cita_completada` o `cita_cancelada` se emiten desde **Rust** (`Emitter::emit`) y deben llevar un **payload estandarizado** (campos en snake_case para interoperabilidad):

```json
{
  "cita_id": "<uuid>",
  "paciente_nombre": "<nombre completo>",
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

## Autenticación local y tablas de seguridad

- **Módulos Rust:** `startup_auth.rs`, `admin_auth.rs`; registro de comandos en `lib.rs`.
- **Frontend:** `StartupLoginScreen` (bloqueo al arranque si hay contraseña de inicio); `ConfigAdminGate` (crear o verificar contraseña de administrador antes de mostrar `SettingsPanel`); secciones `StartupPasswordAdminSection` y `AdminPasswordAdminSection` bajo Administración cuando el modo administrador está activo en el borrador de configuración.
- **Formularios anidados:** los formularios de contraseña en configuración no usan `<form>` internos dentro del formulario principal de “Guardar configuración” (evita envíos accidentales del padre); botones `type="button"` y manejadores `onClick` / tecla Enter acotada.
- **Comandos relevantes (resumen):** `get_startup_auth_status`, `verify_startup_password`, `set_startup_password`, `clear_startup_password_with_admin`, `set_startup_password_with_admin`; `get_admin_auth_status`, `verify_admin_password`, `set_admin_password`, `clear_admin_password`.

## Respaldos y restauración

- **Generación automática (al iniciar):** `run_startup_backup` (`backup.rs`) copia `consultorio.db` con prefijo `consultorio_<timestamp>.db` a `app_data_dir/backups` y, si está configurada en `BackupSettings.external_path`, también a una ruta externa (sincronizable con la nube). La retención (`retention_count`) se aplica por carpeta.
- **Listado y restauración manual:** módulo `backup_commands.rs` con dos comandos Tauri:
	- `listar_respaldos_locales`: devuelve `Vec<BackupFileInfo>` (nombre, ruta absoluta, tamaño y fecha de modificación) leyendo solo `app_data_dir/backups`. Para archivos fuera de esa carpeta el frontend usa el diálogo nativo (`@tauri-apps/plugin-dialog`, capability `dialog:allow-open`).
	- `restaurar_respaldo`: recibe `source_path` y `admin_password`. Exige modo administrador activo (`settings.admin_mode == true`) y verifica el hash Argon2 con `verify_admin_password_with_conn`. La operación:
		1. Hace checkpoint del WAL y reemplaza la `Connection` activa por una `open_in_memory` para liberar handles (Windows no permite renombrar un archivo abierto).
		2. Valida la fuente (prefijo `consultorio_`, extensión `.db`, cabecera SQLite y `PRAGMA schema_version` legible).
		3. Copia a `consultorio.db.restore.tmp`, elimina los archivos auxiliares `consultorio.db-wal` / `-shm` y hace `fs::rename` atómico sobre `consultorio.db`.
		4. Reabre la BD restaurada con `db::open_connection` (aplica migraciones) y la reinstala en el `Mutex<Connection>` compartido.
- **UX:** componente `BackupRestoreSection` en `Configuración → Respaldos`. Lista los respaldos locales, permite elegir un archivo externo, exige confirmación con contraseña de administrador y, tras la restauración exitosa, ofrece cerrar la aplicación para que cualquier estado en memoria se reconstruya al volver a abrirla.

## Consideraciones de seguridad

- **Modelo de amenaza:** aplicación de escritorio con datos en disco; la protección apunta a **uso casual** y **separación de roles** en el consultorio, no a resistencia a copia offline del archivo `consultorio.db` ni a malware con privilegios en el equipo.
- **Sin cifrado de BD en el estado actual:** quien obtenga una copia del archivo puede intentar ataques offline contra los hashes (mitigar con contraseñas largas) o manipular filas si controla el disco.
- **Mejora futura opcional:** cifrado de SQLite (p. ej. SQLCipher) + gestión de clave vía keyring del SO; coste de complejidad y recuperación ante pérdida de clave.

## Documentos relacionados

- [PROJECT.md](./PROJECT.md) — visión y fases.
- [MANUAL_USUARIO.md](./MANUAL_USUARIO.md) — instrucciones para usuarios finales.
- [README.md](../README.md) — desarrollo local.
