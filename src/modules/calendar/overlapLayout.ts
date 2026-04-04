import { minutesFromHHMM } from "../../core/timeFormat";
import type { Appointment, EventoColor } from "../../core/types";

export interface LayoutBlock {
	appointment: Appointment;
	column: number;
	columnCount: number;
}

function overlaps(
	aStart: number,
	aEnd: number,
	bStart: number,
	bEnd: number,
): boolean {
	return aStart < bEnd && bStart < aEnd;
}

type Internal = Appointment & { startM: number; endM: number };

function withMinutes(list: Appointment[]): Internal[] {
	return list.map((a) => {
		const startM = minutesFromHHMM(a.startTime);
		const endM = minutesFromHHMM(a.endTime);
		if (startM === null || endM === null) {
			throw new Error("Horas inválidas en cita");
		}
		return { ...a, startM, endM };
	});
}

/**
 * Distribución tipo Google Calendar: columnas para solapes en un mismo día.
 */
export function layoutDayAppointments(appointments: Appointment[]): LayoutBlock[] {
	if (appointments.length === 0) return [];
	const items = withMinutes(appointments);
	const visited = new Set<string>();
	const clusters: Internal[][] = [];

	for (const e of items) {
		if (visited.has(e.id)) continue;
		const cluster: Internal[] = [];
		const stack: Internal[] = [e];
		while (stack.length) {
			const cur = stack.pop()!;
			if (visited.has(cur.id)) continue;
			visited.add(cur.id);
			cluster.push(cur);
			for (const o of items) {
				if (!visited.has(o.id) && overlaps(cur.startM, cur.endM, o.startM, o.endM)) {
					stack.push(o);
				}
			}
		}
		clusters.push(cluster);
	}

	const layouts: LayoutBlock[] = [];

	for (const cluster of clusters) {
		const points = new Set<number>();
		for (const e of cluster) {
			points.add(e.startM);
			points.add(e.endM);
		}
		const sortedPoints = [...points].sort((x, y) => x - y);
		let mMax = 1;
		for (const t of sortedPoints) {
			const c = cluster.filter((e) => e.startM <= t && e.endM > t).length;
			mMax = Math.max(mMax, c);
		}

		const sorted = [...cluster].sort((a, b) => {
			if (a.startM !== b.startM) return a.startM - b.startM;
			return b.endM - a.endM;
		});

		const colAssign = new Map<string, number>();
		for (let i = 0; i < sorted.length; i++) {
			const e = sorted[i];
			const used = new Set<number>();
			for (let j = 0; j < i; j++) {
				const o = sorted[j];
				if (overlaps(e.startM, e.endM, o.startM, o.endM)) {
					const oc = colAssign.get(o.id);
					if (oc !== undefined) used.add(oc);
				}
			}
			let c = 0;
			while (used.has(c)) c += 1;
			colAssign.set(e.id, c);
		}

		for (const e of cluster) {
			layouts.push({
				appointment: e,
				column: colAssign.get(e.id)!,
				columnCount: mMax,
			});
		}
	}

	return layouts;
}

export function serviceColorClasses(serviceId: string): string {
	const palette: Record<string, string> = {
		camara_hiperbarica:
			"bg-sky-100 border-sky-400 text-sky-950",
		sueroterapia:
			"bg-sky-100 border-sky-400 text-sky-950",
	};
	return (
		palette[serviceId] ??
		"bg-violet-100 border-violet-400 text-violet-950"
	);
}

const EVENTO_COLOR_MAP: Record<EventoColor, { bg: string; border: string; text: string; badge: string }> = {
	amber: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-900", badge: "bg-amber-200 text-amber-900" },
	rose: { bg: "bg-rose-50", border: "border-rose-400", text: "text-rose-900", badge: "bg-rose-200 text-rose-900" },
	violet: { bg: "bg-violet-50", border: "border-violet-400", text: "text-violet-900", badge: "bg-violet-200 text-violet-900" },
	teal: { bg: "bg-teal-50", border: "border-teal-400", text: "text-teal-900", badge: "bg-teal-200 text-teal-900" },
	sky: { bg: "bg-sky-50", border: "border-sky-400", text: "text-sky-900", badge: "bg-sky-200 text-sky-900" },
	slate: { bg: "bg-slate-100", border: "border-slate-400", text: "text-slate-900", badge: "bg-slate-300 text-slate-900" },
};

export function eventoBlockClasses(color: EventoColor): string {
	const c = EVENTO_COLOR_MAP[color] ?? EVENTO_COLOR_MAP.amber;
	return `${c.bg} ${c.border} ${c.text}`;
}

export function eventoBadgeClasses(color: EventoColor): string {
	const c = EVENTO_COLOR_MAP[color] ?? EVENTO_COLOR_MAP.amber;
	return c.badge;
}
