import { MIN_LEAD_MINUTES_FOR_NEW_APPOINTMENT } from "./constants";

const LEAD_TIME_MESSAGE =
	"La cita debe programarse con al menos 30 minutos de antelación respecto a la hora actual.";

/** Inicio de cita (fecha local + HH:MM) debe ser ≥ ahora + antelación mínima. */
export function isSlotBookableWithLeadTime(
	dateIso: string,
	startHHMM: string,
): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
	const m = /^(\d{1,2}):(\d{2})$/.exec(startHHMM.trim());
	if (!m) return false;
	const y = Number(dateIso.slice(0, 4));
	const mo = Number(dateIso.slice(5, 7));
	const d = Number(dateIso.slice(8, 10));
	const h = Number(m[1]);
	const min = Number(m[2]);
	const startMs = new Date(y, mo - 1, d, h, min, 0, 0).getTime();
	const limit =
		Date.now() + MIN_LEAD_MINUTES_FOR_NEW_APPOINTMENT * 60 * 1000;
	return startMs >= limit;
}

/** `null` si válido; mismo texto que el backend en español. */
export function leadTimeErrorMessage(
	dateIso: string,
	startHHMM: string,
): string | null {
	if (isSlotBookableWithLeadTime(dateIso, startHHMM)) return null;
	return LEAD_TIME_MESSAGE;
}
