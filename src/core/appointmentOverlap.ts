import type { Appointment } from "./types";
import { minutesFromHHMM } from "./timeFormat";

/** Misma regla que `overlaps_intervals` en Rust: [start, end) semiclosed en minutos desde medianoche */
export function intervalsOverlapMinutes(
	startA: number,
	endA: number,
	startB: number,
	endB: number,
): boolean {
	return startA < endB && startB < endA;
}

/**
 * Cuenta citas del mismo servicio en la misma fecha que solapan con [startTime, endTime).
 * Excluye `excludeAppointmentId` (p. ej. la cita en edición).
 */
export function countOverlappingSameService(
	appointments: Appointment[],
	appointmentDate: string,
	serviceType: string,
	startTime: string,
	endTime: string,
	excludeAppointmentId?: string,
): number {
	const sm = minutesFromHHMM(startTime);
	const em = minutesFromHHMM(endTime);
	if (sm === null || em === null) return 0;

	let n = 0;
	for (const a of appointments) {
		if (a.appointmentDate !== appointmentDate || a.serviceType !== serviceType) {
			continue;
		}
		if (excludeAppointmentId && a.id === excludeAppointmentId) {
			continue;
		}
		const as = minutesFromHHMM(a.startTime);
		const ae = minutesFromHHMM(a.endTime);
		if (as === null || ae === null) continue;
		if (intervalsOverlapMinutes(sm, em, as, ae)) {
			n += 1;
		}
	}
	return n;
}
