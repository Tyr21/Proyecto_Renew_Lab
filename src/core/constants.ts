/** Horario operativo [7:00, 20:00) en la misma fecha local */
export const CALENDAR_DAY_START_HOUR = 7;
export const CALENDAR_DAY_END_HOUR = 20;
export const SLOT_MINUTES = 30;
/** Altura de cada franja de 30 min (legibilidad en pantalla) */
export const SLOT_HEIGHT_PX = 44;

export const TAURI_COMMANDS = {
	getSettings: "get_settings",
	saveSettings: "save_settings",
	listAppointmentsRange: "list_appointments_range",
	createAppointment: "create_appointment",
	updateAppointment: "update_appointment",
	deleteAppointment: "delete_appointment",
	logDomainEvent: "log_domain_event",
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
