import { CALENDAR_DAY_END_HOUR, CALENDAR_DAY_START_HOUR, SLOT_MINUTES } from "./constants";
import type { TimeDisplay } from "./types";

export function parseHHMM(s: string): { h: number; m: number } | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (Number.isNaN(h) || Number.isNaN(min)) return null;
	return { h, m: min };
}

export function minutesFromHHMM(s: string): number | null {
	const p = parseHHMM(s);
	if (!p) return null;
	return p.h * 60 + p.m;
}

export function hhmmFromMinutes(total: number): string {
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTimeLabel(hhmm: string, mode: TimeDisplay): string {
	const p = parseHHMM(hhmm);
	if (!p) return hhmm;
	if (mode === "24h") {
		return `${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}`;
	}
	const isPM = p.h >= 12;
	const h12 = p.h % 12 || 12;
	const ap = isPM ? "PM" : "AM";
	return `${h12}:${String(p.m).padStart(2, "0")} ${ap}`;
}

export function generateSlotStarts(): string[] {
	const out: string[] = [];
	for (let m = CALENDAR_DAY_START_HOUR * 60; m < CALENDAR_DAY_END_HOUR * 60; m += SLOT_MINUTES) {
		out.push(hhmmFromMinutes(m));
	}
	return out;
}

export function addMinutesToHHMM(hhmm: string, delta: number): string | null {
	const m = minutesFromHHMM(hhmm);
	if (m === null) return null;
	return hhmmFromMinutes(m + delta);
}

/** Validación de reglas de negocio para citas */
export function isValidAppointmentWindow(start: string, end: string): boolean {
	const sm = minutesFromHHMM(start);
	const em = minutesFromHHMM(end);
	if (sm === null || em === null) return false;
	if (em <= sm) return false;
	const open = CALENDAR_DAY_START_HOUR * 60;
	const close = CALENDAR_DAY_END_HOUR * 60;
	if (sm < open || em > close) return false;
	if (sm % SLOT_MINUTES !== 0 || em % SLOT_MINUTES !== 0) return false;
	if ((em - sm) % SLOT_MINUTES !== 0) return false;
	return true;
}
