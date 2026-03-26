import { MAX_GRACE_PERIOD_MINUTES } from "./constants";

function gracePeriodExpiredMessage(): string {
	return `El periodo de gracia (${MAX_GRACE_PERIOD_MINUTES} min) para agendar en este horario ha expirado.`;
}

/**
 * El slot es agendable si la hora local actual no supera el inicio del slot
 * más el periodo de gracia (walk-ins en franjas ya iniciadas).
 */
export function isSlotBookableWithGracePeriod(
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
	const deadlineMs =
		startMs + MAX_GRACE_PERIOD_MINUTES * 60 * 1000;
	return Date.now() <= deadlineMs;
}

/** `null` si válido; mismo criterio que el backend. */
export function gracePeriodBookingErrorMessage(
	dateIso: string,
	startHHMM: string,
): string | null {
	if (isSlotBookableWithGracePeriod(dateIso, startHHMM)) return null;
	return gracePeriodExpiredMessage();
}
