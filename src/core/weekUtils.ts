/** Lunes como inicio de semana (es-ES) */

export function startOfWeekMonday(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	const day = x.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	x.setDate(x.getDate() + diff);
	return x;
}

export function addDays(d: Date, n: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}

export function toISODateLocal(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function parseISODateLocal(s: string): Date {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function weekDayLabels(): { key: string; short: string }[] {
	return [
		{ key: "mon", short: "Lun" },
		{ key: "tue", short: "Mar" },
		{ key: "wed", short: "Mié" },
		{ key: "thu", short: "Jue" },
		{ key: "fri", short: "Vie" },
		{ key: "sat", short: "Sáb" },
		{ key: "sun", short: "Dom" },
	];
}

export function getWeekDates(weekStartMonday: Date, includeSunday: boolean): Date[] {
	const days: Date[] = [];
	const count = includeSunday ? 7 : 6;
	for (let i = 0; i < count; i++) {
		days.push(addDays(weekStartMonday, i));
	}
	return days;
}

export function rangeLabelSpanish(dates: Date[]): string {
	if (!dates.length) return "";
	const opts: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "short",
		year: "numeric",
	};
	const a = dates[0].toLocaleDateString("es-CO", opts);
	const b = dates[dates.length - 1].toLocaleDateString("es-CO", opts);
	return `${a} – ${b}`;
}

export function isAppointmentPastEnd(appointmentDate: string, endTime: string): boolean {
	const endM = endTime.split(":").map(Number);
	const end = new Date(appointmentDate + "T00:00:00");
	end.setHours(endM[0], endM[1], 0, 0);
	return Date.now() >= end.getTime();
}
