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
export const SLOT_HEIGHT_PX = 44;
/**
 * Fracción del ancho de la columna ocupada en total por todas las citas solapadas
 * (suma de bloques adyacentes). El resto queda como franja clicable a la derecha.
 */
export const APPOINTMENT_BLOCK_WIDTH_FRACTION = 0.95;

export const TAURI_COMMANDS = {
	getSettings: "get_settings",
	saveSettings: "save_settings",
	listAppointmentsRange: "list_appointments_range",
	createAppointment: "create_appointment",
	updateAppointment: "update_appointment",
	deleteAppointment: "delete_appointment",
	getAppointment: "get_appointment",
} as const;

export function slotCountForDay(): number {
	const minutes =
		(CALENDAR_DAY_END_HOUR - CALENDAR_DAY_START_HOUR) * 60;
	return minutes / SLOT_MINUTES;
}

export function dayStartMinutes(): number {
	return CALENDAR_DAY_START_HOUR * 60;
}
