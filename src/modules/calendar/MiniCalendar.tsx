import { useMemo } from "react";
import { toISODateLocal } from "../../core/weekUtils";

interface MiniCalendarProps {
	/** Año y mes visible (0-indexed month) */
	year: number;
	month: number;
	/** Lunes de la semana actualmente visible en el calendario principal */
	weekStartMonday: Date;
	/** Fechas ISO (YYYY-MM-DD) que tienen al menos una cita */
	datesWithAppointments: Set<string>;
	onMonthChange: (year: number, month: number) => void;
	onDateSelect: (dateIso: string) => void;
}

const DAY_HEADERS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

interface DayCell {
	date: Date;
	iso: string;
	dayNum: number;
	isCurrentMonth: boolean;
}

function buildMonthGrid(year: number, month: number): DayCell[] {
	const firstOfMonth = new Date(year, month, 1);
	let startDow = firstOfMonth.getDay();
	if (startDow === 0) startDow = 7;

	const gridStart = new Date(year, month, 1 - (startDow - 1));
	const cells: DayCell[] = [];
	const totalCells = 42;

	for (let i = 0; i < totalCells; i++) {
		const d = new Date(gridStart);
		d.setDate(gridStart.getDate() + i);
		cells.push({
			date: d,
			iso: toISODateLocal(d),
			dayNum: d.getDate(),
			isCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
		});
	}
	return cells;
}

export function MiniCalendar({
	year,
	month,
	weekStartMonday,
	datesWithAppointments,
	onMonthChange,
	onDateSelect,
}: MiniCalendarProps) {
	const todayIso = useMemo(() => toISODateLocal(new Date()), []);

	const weekMondayIso = useMemo(() => toISODateLocal(weekStartMonday), [weekStartMonday]);
	const weekSundayIso = useMemo(() => {
		const sun = new Date(weekStartMonday);
		sun.setDate(sun.getDate() + 6);
		return toISODateLocal(sun);
	}, [weekStartMonday]);

	const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

	const monthLabel = useMemo(() => {
		const d = new Date(year, month, 1);
		return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
	}, [year, month]);

	function goPrev() {
		const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
		onMonthChange(prev.y, prev.m);
	}

	function goNext() {
		const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
		onMonthChange(next.y, next.m);
	}

	return (
		<div className="select-none px-2 pb-2 pt-1">
			{/* Header con navegacion */}
			<div className="flex items-center justify-between mb-1">
				<button
					type="button"
					onClick={goPrev}
					className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Mes anterior"
				>
					<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
						<path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
					</svg>
				</button>
				<span className="text-[0.7rem] font-semibold capitalize text-slate-700">
					{monthLabel}
				</span>
				<button
					type="button"
					onClick={goNext}
					className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Mes siguiente"
				>
					<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
						<path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
					</svg>
				</button>
			</div>

			{/* Encabezados de dias */}
			<div className="grid grid-cols-7 mb-0.5">
				{DAY_HEADERS.map((d) => (
					<div key={d} className="text-center text-[0.55rem] font-medium text-slate-400 py-0.5">
						{d}
					</div>
				))}
			</div>

			{/* Grid de dias */}
			<div className="grid grid-cols-7">
				{cells.map((cell) => {
					const isToday = cell.iso === todayIso;
					const isInActiveWeek = cell.iso >= weekMondayIso && cell.iso <= weekSundayIso;
					const hasAppt = datesWithAppointments.has(cell.iso);

					return (
						<button
							key={cell.iso}
							type="button"
							onClick={() => onDateSelect(cell.iso)}
							className={[
								"relative flex flex-col items-center justify-center py-[3px] text-[0.65rem] rounded transition-colors",
								cell.isCurrentMonth ? "text-slate-700" : "text-slate-300",
								isInActiveWeek && cell.isCurrentMonth ? "bg-sky-50" : "",
								isToday ? "font-bold" : "",
								cell.isCurrentMonth ? "hover:bg-sky-100" : "hover:bg-slate-50",
							].join(" ")}
							title={cell.iso}
						>
							<span className={isToday ? "flex h-[18px] w-[18px] items-center justify-center rounded-full bg-sky-600 text-white text-[0.6rem]" : ""}>
								{cell.dayNum}
							</span>
							{hasAppt && cell.isCurrentMonth ? (
								<span className="absolute bottom-[1px] h-[4px] w-[4px] rounded-full bg-sky-500" />
							) : null}
						</button>
					);
				})}
			</div>
		</div>
	);
}
