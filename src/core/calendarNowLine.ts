import { CALENDAR_DAY_END_HOUR, SLOT_HEIGHT_PX, SLOT_MINUTES, dayStartMinutes } from "./constants";

/**
 * Posición vertical en px (desde el inicio de la franja horaria del calendario)
 * para la línea "hora actual", o null si la hora local está fuera del rango visible
 * [inicio operativo, fin operativo).
 */
export function calendarNowLineTopPx(now: Date): number | null {
	const open = dayStartMinutes();
	const close = CALENDAR_DAY_END_HOUR * 60;
	const fractionalMinutes =
		now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
	if (fractionalMinutes < open || fractionalMinutes >= close) {
		return null;
	}
	return ((fractionalMinutes - open) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}
