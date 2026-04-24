/** Horario operativo [7:00, 20:00) en la misma fecha local */
export const CALENDAR_DAY_START_HOUR = 7;
export const CALENDAR_DAY_END_HOUR = 20;
export const SLOT_MINUTES = 30;
/**
 * Tras el inicio del slot, solo se puede agendar (walk-in) hasta este máximo
 * (alineado con backend). Misma unidad que SLOT_MINUTES.
 */
export const MAX_GRACE_PERIOD_MINUTES = 15;
/** Altura de cada franja de 30 min (legibilidad en pantalla) */
export const SLOT_HEIGHT_PX = 35;
/** Actualización de la línea “hora actual” en la vista semanal (ms). */
export const CALENDAR_NOW_LINE_TICK_MS = 60_000;
/**
 * Fracción del ancho de la columna ocupada en total por todas las citas solapadas
 * (suma de bloques adyacentes). El resto queda como franja clicable a la derecha.
 */
export const APPOINTMENT_BLOCK_WIDTH_FRACTION = 0.95;

/** Valor inicial al añadir un tipo de servicio nuevo (COP). */
export const DEFAULT_SUGGESTED_PRICE_COP = 150_000;

/** Sesiones iniciales al añadir un plan de paquete en configuración. */
export const DEFAULT_NEW_PACKAGE_PLAN_SESSION_COUNT = 10;

/** Etiqueta inicial del plan; el usuario puede editarla antes de guardar. */
export function defaultPackagePlanLabel(sessionCount: number): string {
	return `Paquete de ${sessionCount} sesiones`;
}

/** Alineado con backend `startup_auth` y `admin_auth` (Argon2). */
export const STARTUP_PASSWORD_MIN_LENGTH = 8;
export const STARTUP_PASSWORD_MAX_LENGTH = 128;
export const ADMIN_PASSWORD_MIN_LENGTH = STARTUP_PASSWORD_MIN_LENGTH;
export const ADMIN_PASSWORD_MAX_LENGTH = STARTUP_PASSWORD_MAX_LENGTH;

/** Evento nativo en `window` tras persistir un ingreso (refresco de citas / `isPaid`). */
export const INGRESO_REGISTRADO_EVENT = "ingreso_registrado";

/**
 * Apellido sustituto cuando el nombre completo tiene una sola palabra.
 * El backend exige apellidos no vacíos; este marcador es explícito y editable luego en la ficha.
 */
export const CLIENTE_APELLIDO_PLACEHOLDER = ".";

export const TAURI_COMMANDS = {
	getSettings: "get_settings",
	saveSettings: "save_settings",
	listAppointmentsRange: "list_appointments_range",
	createAppointment: "create_appointment",
	updateAppointment: "update_appointment",
	deleteAppointment: "delete_appointment",
	getAppointment: "get_appointment",
	crearIngreso: "crear_ingreso",
	obtenerIngresos: "obtener_ingresos",
	listarMovimientosFinancierosDetalle: "listar_movimientos_financieros_detalle",
	eliminarIngreso: "eliminar_ingreso",
	estadisticasCitasPorMes: "estadisticas_citas_por_mes",
	estadisticasIngresosPorMes: "estadisticas_ingresos_por_mes",
	estadisticasServicios: "estadisticas_servicios",
	estadisticasMetodosPago: "estadisticas_metodos_pago",
	crearCliente: "crear_cliente",
	actualizarCliente: "actualizar_cliente",
	buscarClientes: "buscar_clientes",
	obtenerCliente: "obtener_cliente",
	obtenerResumenClienteDashboard: "obtener_resumen_cliente_dashboard",
	eliminarCliente: "eliminar_cliente",
	crearPaquete: "crear_paquete",
	crearClienteYPaquete: "crear_cliente_y_paquete",
	listarPaquetesCliente: "listar_paquetes_cliente",
	listarFacturas: "listar_facturas",
	obtenerFactura: "obtener_factura",
	guardarBorradorFactura: "guardar_borrador_factura",
	emitirFactura: "emitir_factura",
	anularFactura: "anular_factura",
	listarEventosRango: "listar_eventos_rango",
	crearEvento: "crear_evento",
	actualizarEvento: "actualizar_evento",
	eliminarEvento: "eliminar_evento",
	getStartupAuthStatus: "get_startup_auth_status",
	verifyStartupPassword: "verify_startup_password",
	setStartupPassword: "set_startup_password",
	clearStartupPasswordWithAdmin: "clear_startup_password_with_admin",
	setStartupPasswordWithAdmin: "set_startup_password_with_admin",
	getAdminAuthStatus: "get_admin_auth_status",
	verifyAdminPassword: "verify_admin_password",
	setAdminPassword: "set_admin_password",
	clearAdminPassword: "clear_admin_password",
	listarOxigenoPorRango: "listar_oxigeno_por_rango",
	registrarEventoOxigeno: "registrar_evento_oxigeno",
	resumenOxigenoRango: "resumen_oxigeno_rango",
	leerFotoOxigeno: "leer_foto_oxigeno",
} as const;

export const FACTURA_CHANGED_EVENT = "factura_changed";
export const EVENTO_CHANGED_EVENT = "evento_changed";

export function slotCountForDay(): number {
	const minutes =
		(CALENDAR_DAY_END_HOUR - CALENDAR_DAY_START_HOUR) * 60;
	return minutes / SLOT_MINUTES;
}

export function dayStartMinutes(): number {
	return CALENDAR_DAY_START_HOUR * 60;
}
