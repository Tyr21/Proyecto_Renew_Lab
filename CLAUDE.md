# Consultorio Renew Lab — Documentación para IA

Aplicación de escritorio para gestión de citas médicas y finanzas de un consultorio de cámara hiperbárica y sueroterapia.

---

## ⚠️ Reglas generales de desarrollo

### Stack: diseño local, sin SaaS innecesarios

- **Mantener todo local:** Base de datos SQLite local, cálculos en Rust/React, sin servicios en la nube (AWS, Firebase, Azure, etc.) salvo solicitud explícita del usuario.
- **No proponer sustitutos SaaS:** Si algo puede resolverse con tecnología local ya en el stack (Tauri + SQLite + React), hacerlo así.
- **Arquitectura de escritorio:** El proyecto es una app local de escritorio — sus ventajas son independencia, privacidad de datos y control total.

### Calendario: mantener simple, sin librerías externas

El calendario semanal está implementado con **CSS Grid puro + React** (`WeekCalendarView.tsx`). Esta es una decisión deliberada y no debe cambiarse.

**No usar:**
- FullCalendar, React Big Calendar, DayPilot ni ninguna librería de calendario
- Capas adicionales de abstracción sobre el grid
- Librerías de drag & drop externas

**Por qué:** El propietario del proyecto prioriza que el código sea fácil de leer, editar y mantener. Las librerías de calendario son difíciles de personalizar, mezclan estilos propios con Tailwind y generan deuda técnica innecesaria para un caso de uso acotado.

**Cómo está implementado hoy:**
- CSS Grid con columnas `repeat(N, minmax(110px, 1fr))` donde N = días visibles
- Slots de 30 min, rango 07:00–20:00, altura fija `SLOT_HEIGHT_PX` por slot
- Citas posicionadas con `position: absolute`, `top` y `height` calculados en píxeles desde los minutos
- Solapamiento resuelto en `overlapLayout.ts` con un algoritmo de columnas propio
- Navegación semanal con `addDays(weekStart, ±7)`

**Si se necesita una mejora en el calendario**, implementarla extendiendo la lógica existente en `WeekCalendarView.tsx` y `overlapLayout.ts`, no reemplazando con una librería.

### Modularidad: separación de dominios

- **Módulo de calendario:** Solo coordina vistas de citas y entrada de usuario. No contiene lógica de inventario, finanzas ni otras capas de negocio.
- **Reacción a eventos:** Otros módulos (finanzas, reportes) reaccionan a eventos locales (`window.dispatchEvent()`) que emite el calendario u otros dominios — sin dependencias acopladas.
- **Ejemplo:** Cuando se registra un ingreso, el módulo de finanzas dispara `INGRESO_REGISTRADO_EVENT` para que el calendario se refresque. El calendario no depende de finanzas.

### Cambios grandes: revisar y actualizar documentación

- **Antes de cambios arquitectónicos** (tablas nuevas, restructuración de comandos, cambios en tipos principales): revisar `docs/PROJECT.md` y `docs/ARQUITECTURA.md` (si existen) para entender el contexto de decisiones previas.
- **Después de cambios relevantes:** Actualizar la documentación afectada — que la realidad y los docs permanezcan sincronizados.
- **"Cambios grandes" = cualquier cosa que afecte múltiples módulos o agregue filas nuevas en `CLAUDE.md`.**

### Validación de citas: coherencia Rust ↔ TypeScript

- **Lógica duplicada es intencional:** Las mismas reglas de validación existen en:
  - `src-tauri/src/time_rules.rs` (backend Rust)
  - `src/core/appointmentFormValidation.ts` (frontend TypeScript)
  - `src/core/appointmentOverlap.ts` (detección de solapamiento frontend)
- **Si cambia una regla:** cambiarla en ambos lados y actualizar la doc en `docs/ARQUITECTURA.md` si afecta la lógica de negocio.
- **Razón:** El formulario valida antes de enviar (UX rápida); el backend valida después de recibir (seguridad); ambos deben concordar.

### UI/CSS (KISS): simplicidad y HTML natural

- **Preferir flex/grid + HTML natural:** No crear "capas estructurales" con `div` vacíos para simular márgenes o separadores.
- **Ejemplo ❌:**
  ```jsx
  <div className="absolute inset-0">
    <div className="flex">
      <div className="h-1 bg-gray-200" />
      {/* contenido */}
    </div>
  </div>
  ```
- **Ejemplo ✅:**
  ```jsx
  <div className="border-b border-gray-300 p-4">{/* contenido */}</div>
  ```
- **`absolute` / `z-index` solo para flotantes:** Usar posicionamiento absoluto solo para elementos que flotan sobre el flujo (modales, tooltips, notificaciones, tarjetas de citas en grid).
- **Estados (deshabilitado, hover, etc.):** Aplicar colores y propiedades directamente en el elemento (`disabled:opacity-40`, `hover:bg-slate-50`), sin crear overlays invisibles para simular estado.
- **Resultado:** CSS más limpio, menos especificidad, más fácil de leer y mantener.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Desktop runtime | Tauri 2.0 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS v4 |
| Base de datos | SQLite via `rusqlite` (local, sin servidor) |
| State management | React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`) |

## Cómo ejecutar

```bash
npm run tauri dev      # Desarrollo (compila Rust + Vite en hot-reload)
npm run build          # Build de producción
```

> El frontend solo (Vite) puede iniciarse con el servidor de preview, pero mostrará error `Cannot read properties of undefined (reading 'invoke')` porque requiere el runtime de Tauri para funcionar.

---

## Estructura de archivos

```
src/
├── App.tsx                          # Raíz de la app — navegación por tabs
├── core/
│   ├── api.ts                       # Todas las funciones invoke() al backend Rust
│   ├── constants.ts                 # TAURI_COMMANDS + nombres de eventos
│   ├── types.ts                     # Todos los tipos/interfaces TypeScript
│   ├── weekUtils.ts                 # Utilidades de fechas (semana, ISO local)
│   ├── timeFormat.ts                # Formato de horas, slots de 30 min
│   ├── currencyFormat.ts            # formatCurrency() para pesos colombianos
│   ├── ingresoDate.ts               # fechaIngresoLocalISODate(), formatHoraPago()
│   ├── countries.ts                 # Códigos de marcación internacional
│   ├── errors.ts                    # formatInvokeError()
│   ├── leadTime.ts                  # Período de gracia para crear citas
│   ├── appointmentFormValidation.ts # Validación del formulario de citas
│   ├── appointmentOverlap.ts        # Detección de solapamiento de citas
│   └── serviceLabels.ts             # Etiquetas de servicios desde settings
├── components/
│   ├── CitaEventNotifier.tsx        # Escucha eventos Rust → notificaciones
│   └── FinanceEventListener.tsx     # Escucha ingreso_registrado
└── modules/
    ├── appointments/
    │   └── AppointmentModal.tsx     # Modal crear/editar cita (con autocomplete clientes)
    ├── calendar/
    │   ├── WeekCalendarView.tsx     # Vista semanal CSS Grid (slots 30 min)
    │   ├── TodayAgendaSidebar.tsx   # Panel lateral con citas y eventos del día
    │   ├── EventoModal.tsx          # Modal crear/editar evento/recordatorio
    │   └── overlapLayout.ts         # Algoritmo de columnas + colores de servicios/eventos
    ├── clientes/
    │   ├── ClientesDashboard.tsx    # Búsqueda en tiempo real top 5 clientes
    │   └── ClienteModal.tsx         # Modal crear/editar cliente
    ├── finances/
    │   ├── FinanceDashboard.tsx     # Cierre de caja con filtros de fecha
    │   └── PaymentModal.tsx         # Modal registrar pago de cita
    ├── reports/
    │   └── ReportsDashboard.tsx     # Estadísticas con filtros de período
    └── settings/
        └── SettingsPanel.tsx        # Configuración de la app

src-tauri/src/
├── lib.rs                           # Punto de entrada Tauri — registra todos los comandos
├── main.rs                          # main() de Rust
├── db.rs                            # Conexión SQLite + migraciones + seed
├── commands.rs                      # DbConn type alias (Mutex<Connection>)
├── appointment_model.rs             # Structs AppointmentRow / AppointmentInput
├── settings_model.rs                # Struct AppSettings (serializada como JSON)
├── finance.rs                       # CRUD ingresos (crear, obtener con filtro fechas, eliminar)
├── clientes.rs                      # CRUD clientes (crear, actualizar, buscar, obtener, eliminar)
├── eventos.rs                       # CRUD eventos/recordatorios de calendario
├── reports.rs                       # Estadísticas agregadas (citas/mes, ingresos/mes, servicios, métodos pago)
└── time_rules.rs                    # Reglas de horario y período de gracia
```

---

## Base de datos SQLite

El archivo se llama `consultorio.db` y vive en el directorio de datos de la app (gestionado por Tauri). Las migraciones usan `CREATE TABLE IF NOT EXISTS` — son no destructivas y se ejecutan en cada arranque.

### Tabla `appointments`

```sql
CREATE TABLE appointments (
    id                   TEXT PRIMARY KEY,
    patient_full_name    TEXT NOT NULL,
    document_type        TEXT NOT NULL,   -- CC, CE, TI, PA, RC, NIT
    document_number      TEXT NOT NULL,
    phone_dial_code      TEXT NOT NULL,   -- ej: +57
    phone_national_number TEXT NOT NULL,
    birthday_month       INTEGER,         -- 1-12, nullable
    appointment_date     TEXT NOT NULL,   -- YYYY-MM-DD
    start_time           TEXT NOT NULL,   -- HH:MM
    end_time             TEXT NOT NULL,   -- HH:MM
    service_type         TEXT NOT NULL,   -- ID del servicio (ej: "camara_hiperbarica")
    status               TEXT NOT NULL,   -- pendiente | asistio | no_asistio
    created_at           TEXT NOT NULL,   -- RFC3339 UTC
    updated_at           TEXT NOT NULL    -- RFC3339 UTC
);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
```

### Tabla `ingresos`

```sql
CREATE TABLE ingresos (
    id                  TEXT PRIMARY KEY,
    cita_id             TEXT,             -- nullable, FK implícita a appointments.id
    paciente_nombre     TEXT NOT NULL DEFAULT '',
    paciente_documento  TEXT NOT NULL,
    concepto            TEXT NOT NULL,
    monto               REAL NOT NULL,
    metodo_pago         TEXT NOT NULL,    -- Efectivo | Tarjeta | Transferencia
    fecha_pago          TEXT NOT NULL     -- RFC3339 UTC
);
CREATE INDEX idx_ingresos_fecha ON ingresos(fecha_pago);
```

> `fecha_pago` se guarda en UTC. Para filtrar por fecha local usar `date(fecha_pago, 'localtime')` en SQL.

### Tabla `clientes`

```sql
CREATE TABLE clientes (
    id                   TEXT PRIMARY KEY,
    nombres              TEXT NOT NULL,
    apellidos            TEXT NOT NULL,
    document_type        TEXT NOT NULL,
    document_number      TEXT NOT NULL,   -- UNIQUE
    phone_dial_code      TEXT NOT NULL DEFAULT '',
    phone_national_number TEXT NOT NULL DEFAULT '',
    email                TEXT NOT NULL DEFAULT '',
    birthday_month       INTEGER,         -- 1-12, nullable
    notas                TEXT NOT NULL DEFAULT '',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_clientes_document ON clientes(document_number);
CREATE INDEX idx_clientes_nombres ON clientes(nombres, apellidos);
```

### Tabla `eventos`

```sql
CREATE TABLE eventos (
    id              TEXT PRIMARY KEY,
    titulo          TEXT NOT NULL,
    descripcion     TEXT NOT NULL DEFAULT '',
    fecha           TEXT NOT NULL,    -- YYYY-MM-DD
    todo_el_dia     INTEGER NOT NULL DEFAULT 1,  -- 1 = todo el día, 0 = hora específica
    hora_inicio     TEXT,             -- HH:MM (null si todo_el_dia)
    hora_fin        TEXT,             -- HH:MM (null si todo_el_dia)
    color           TEXT NOT NULL DEFAULT 'amber',  -- amber|rose|violet|teal|sky|slate
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX idx_eventos_fecha ON eventos(fecha);
```

### Tabla `app_config`

Singleton (id = 1). Guarda toda la configuración como JSON en `settings_json`.

---

## Tabs de la aplicación

`App.tsx` gestiona 5 tabs:

| Tab | Componente | Descripción |
|-----|-----------|-------------|
| `calendario` | `WeekCalendarView` + `TodayAgendaSidebar` | Vista semanal de citas |
| `finanzas` | `FinanceDashboard` | Cierre de caja con filtros de fecha |
| `reportes` | `ReportsDashboard` | Estadísticas y gráficas por período |
| `clientes` | `ClientesDashboard` | Maestro de clientes con búsqueda fluida |
| `configuracion` | `SettingsPanel` | Configuración general |

---

## Comandos Tauri (backend → frontend)

Todos los comandos están registrados en `lib.rs` → `generate_handler!`. Convención de nombres: `snake_case` en Rust → `camelCase` en TypeScript (mapeado en `constants.ts → TAURI_COMMANDS`).

### Citas
| Rust | TypeScript | Descripción |
|------|-----------|-------------|
| `create_appointment` | `createAppointment(input)` | Crea una cita nueva |
| `update_appointment` | `updateAppointment(id, input)` | Actualiza cita existente |
| `delete_appointment` | `deleteAppointment(id)` | Elimina (solo adminMode o futuras) |
| `list_appointments_range` | `listAppointmentsRange(start, end)` | Citas en rango de fechas |
| `log_domain_event` | — | Registra evento en terminal Rust |

### Ingresos / Finanzas
| Rust | TypeScript | Descripción |
|------|-----------|-------------|
| `crear_ingreso` | `crearIngreso(input)` | Registra un pago |
| `obtener_ingresos` | `obtenerIngresos(startDate, endDate)` | Ingresos filtrados por fecha en SQL |
| `eliminar_ingreso` | `eliminarIngreso(id)` | Elimina un ingreso (adminMode) |

### Clientes
| Rust | TypeScript | Descripción |
|------|-----------|-------------|
| `crear_cliente` | `crearCliente(input)` | Crea cliente nuevo |
| `actualizar_cliente` | `actualizarCliente(id, input)` | Actualiza datos del cliente |
| `buscar_clientes` | `buscarClientes(query)` | Búsqueda LIKE top 5 (nombres/apellidos/documento) |
| `obtener_cliente` | `obtenerCliente(id)` | Obtiene cliente por id |
| `eliminar_cliente` | `eliminarCliente(id)` | Elimina cliente (adminMode) |

### Reportes / Estadísticas
| Rust | TypeScript | Descripción |
|------|-----------|-------------|
| `estadisticas_citas_por_mes` | `estadisticasCitasPorMes(start, end)` | COUNT citas agrupadas por mes |
| `estadisticas_ingresos_por_mes` | `estadisticasIngresosPorMes(start, end)` | SUM ingresos agrupados por mes |
| `estadisticas_servicios` | `estadisticasServicios(start, end)` | Conteo por tipo de servicio |
| `estadisticas_metodos_pago` | `estadisticasMetodosPago(start, end)` | Totales por método de pago |

### Eventos / Recordatorios
| Rust | TypeScript | Descripción |
|------|-----------|-------------|
| `listar_eventos_rango` | `listarEventosRango(start, end)` | Eventos en rango de fechas |
| `crear_evento` | `crearEvento(input)` | Crea un evento nuevo |
| `actualizar_evento` | `actualizarEvento(id, input)` | Actualiza evento existente |
| `eliminar_evento` | `eliminarEvento(id)` | Elimina un evento |

### Configuración
| Rust | TypeScript | Descripción |
|------|-----------|-------------|
| `get_settings` | `getSettings()` | Lee configuración desde SQLite |
| `save_settings` | `saveSettings(settings)` | Guarda configuración en SQLite |

---

## Convenciones de código

- **Rust**: `snake_case` para todo. Structs con `#[serde(rename_all = "camelCase")]` para serializar a JSON.
- **TypeScript**: `camelCase` para variables y funciones. `PascalCase` para componentes e interfaces.
- **SQL**: Los filtros de fecha en `ingresos` usan `date(fecha_pago, 'localtime')` para respetar zona horaria local (UTC → local).
- **Errores**: En Rust se retorna `Result<T, String>`. En TypeScript se usa `formatInvokeError(e)` para extraer el mensaje.
- **Debounce**: Las búsquedas en tiempo real usan `setTimeout` de 200ms con `clearTimeout` en `useRef`.
- **Eventos custom**: `INGRESO_REGISTRADO_EVENT` se dispara al registrar un pago para refrescar el calendario.

---

## Módulo de Clientes — flujo especial en AppointmentModal

Al crear una cita, el campo "Nombre completo" actúa como autocomplete:

1. **Al escribir** → llama `buscarClientes(query)` con debounce 200ms → muestra dropdown top 5.
2. **Al seleccionar del dropdown** → auto-llena documento, teléfono, mes de cumpleaños. Se guarda el objeto `clienteOriginal`.
3. **Al guardar la cita**:
   - Si se seleccionó cliente y **no hubo cambios** → solo crea la cita.
   - Si se seleccionó cliente y **hubo cambios en los datos** → crea la cita y muestra confirmación: *"¿Desea actualizar también los datos del cliente?"* (Sí / No).
   - Si se escribió manualmente (sin seleccionar) → crea la cita y **auto-crea el cliente** en `clientes` si no existe ya con ese número de documento. El nombre completo se divide: última palabra = apellidos, el resto = nombres.

---

## Configuración (`AppSettings`)

Guardada como JSON en `app_config`. Campos principales:

```typescript
interface AppSettings {
  showSundays: boolean;
  timeDisplay: "12h" | "24h";
  defaultDurationMinutes: number;        // múltiplo de 30
  documentTypes: string[];               // ["CC", "CE", "TI", "PA", "RC", "NIT"]
  defaultDocumentType: string;
  serviceTypes: ServiceType[];           // id, label, concurrentCapacity, suggestedPrice
  adminMode: boolean;                    // permite eliminar citas pasadas e ingresos
}
```

**Admin Mode**: cuando está activo, aparece el botón de eliminar en citas pasadas, ingresos y clientes. Se activa en Configuración.

---

## Filtros de fechas

- **Cierre de caja**: el filtro (`dateFrom`/`dateTo`) se pasa al backend — SQLite filtra con `WHERE date(fecha_pago, 'localtime') BETWEEN ?1 AND ?2`. No hay filtrado en el frontend.
- **Reportes**: mismo patrón, con presets: Hoy, Esta semana, Este mes, Mes pasado, Últimos 12 meses, Personalizado.
- **Clientes**: búsqueda en tiempo real, sin filtro de fecha.

---

## Patrones de UI

- **Modales**: `fixed inset-0 z-[110] bg-black/40` + `max-w-md/lg rounded-xl bg-white shadow-xl`.
- **Tabs activo**: `bg-sky-600 text-white`, inactivo: `text-slate-700 hover:bg-slate-100`.
- **Cards de métricas**: `rounded-xl border border-slate-200 bg-white p-4 shadow-sm`.
- **Tablas**: `overflow-x-auto` wrapper, filas con `hover:bg-slate-50/80`, cabecera `bg-slate-50`.
- **Botones primarios**: `bg-sky-600 hover:bg-sky-700 text-white rounded-lg`.
- **Botones de eliminar**: `text-red-600 hover:bg-red-50` (solo visibles en adminMode).
- **Estados vacíos**: borde `border-dashed` con texto centrado en gris.
