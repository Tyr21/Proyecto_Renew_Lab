import {
	CALENDAR_DAY_END_HOUR,
	CALENDAR_DAY_START_HOUR,
	SLOT_HEIGHT_PX,
	dayStartMinutes,
	slotCountForDay,
} from "../../core/constants";
import type { AppSettings, Appointment } from "../../core/types";
import {
	formatTimeLabel,
	generateSlotStarts,
	minutesFromHHMM,
} from "../../core/timeFormat";
import {
	getWeekDates,
	rangeLabelSpanish,
	toISODateLocal,
	weekDayLabels,
} from "../../core/weekUtils";
import {
	layoutDayAppointments,
	serviceColorClasses,
	type LayoutBlock,
} from "./overlapLayout";

interface WeekCalendarViewProps {
	weekStartMonday: Date;
	settings: AppSettings;
	appointments: Appointment[];
	onSlotClick: (dateIso: string, startTime: string) => void;
	onAppointmentClick: (a: Appointment) => void;
	onWeekShift: (deltaWeeks: number) => void;
}

const SLOT_LABELS = generateSlotStarts();
const NUM_SLOTS = slotCountForDay();
const HEADER_TOP_H = 40;

export function WeekCalendarView({
	weekStartMonday,
	settings,
	appointments,
	onSlotClick,
	onAppointmentClick,
	onWeekShift,
}: WeekCalendarViewProps) {
	const days = getWeekDates(weekStartMonday, settings.showSundays);
	const labels = weekDayLabels();

	const gridBodyHeight = NUM_SLOTS * SLOT_HEIGHT_PX;

	function layoutsForDate(iso: string): LayoutBlock[] {
		const dayAppts = appointments.filter((a) => a.appointmentDate === iso);
		return layoutDayAppointments(dayAppts);
	}

	return (
		<div className="flex flex-col h-full min-h-0 bg-slate-50 text-slate-900">
			<header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm shrink-0">
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
						onClick={() => onWeekShift(-1)}
					>
						← Semana anterior
					</button>
					<button
						type="button"
						className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
						onClick={() => onWeekShift(1)}
					>
						Semana siguiente →
					</button>
				</div>
				<h1 className="text-lg font-semibold text-slate-800">
					{rangeLabelSpanish(days)}
				</h1>
				<p className="text-sm text-slate-500">
					Vista semanal · {CALENDAR_DAY_START_HOUR}:00 – {CALENDAR_DAY_END_HOUR}:00
					(slots de 30 min)
				</p>
			</header>

			<div className="flex flex-1 min-h-0 overflow-auto">
				{/* Columna de horas */}
				<div
					className="shrink-0 w-[4.5rem] border-r border-slate-200 bg-white sticky left-0 z-20"
					style={{ paddingTop: HEADER_TOP_H }}
				>
					<div style={{ height: gridBodyHeight }} className="relative">
						{SLOT_LABELS.map((slot, i) => (
							<div
								key={slot}
								className="absolute right-1 text-xs text-slate-500 tabular-nums leading-none"
								style={{
									top: i * SLOT_HEIGHT_PX + 2,
								}}
							>
								{formatTimeLabel(slot, settings.timeDisplay)}
							</div>
						))}
					</div>
				</div>

				{/* Días */}
				<div
					className="grid flex-1 min-w-0"
					style={{
						gridTemplateColumns: `repeat(${days.length}, minmax(110px, 1fr))`,
					}}
				>
					{days.map((d, colIdx) => {
						const iso = toISODateLocal(d);
						const short = labels[colIdx]?.short ?? "";
						const layouts = layoutsForDate(iso);

						return (
							<div
								key={iso}
								className="border-l border-slate-200 bg-white min-w-[110px] flex flex-col"
							>
								<div
									className="sticky top-0 z-10 flex h-10 shrink-0 flex-col items-center justify-center border-b border-slate-200 bg-slate-100/95 backdrop-blur-sm px-1"
									style={{ height: HEADER_TOP_H }}
								>
									<span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
										{short}
									</span>
									<span className="text-sm font-bold text-slate-800">
										{d.getDate()}
									</span>
								</div>

								<div
									className="relative flex-1"
									style={{ height: gridBodyHeight }}
								>
									<div
										className="absolute inset-0 grid"
										style={{
											gridTemplateRows: `repeat(${NUM_SLOTS}, ${SLOT_HEIGHT_PX}px)`,
										}}
									>
										{SLOT_LABELS.map((slot) => (
											<button
												key={`${iso}-${slot}`}
												type="button"
												className="w-full border-b border-slate-100 hover:bg-sky-50/50 transition-colors cursor-pointer"
												onClick={() => onSlotClick(iso, slot)}
												aria-label={`Nueva cita ${iso} ${slot}`}
											/>
										))}
									</div>

									<div className="absolute inset-0 pointer-events-none">
										{layouts.map(({ appointment: a, column, columnCount }) => {
											const sm =
												minutesFromHHMM(a.startTime) ?? dayStartMinutes();
											const em =
												minutesFromHHMM(a.endTime) ?? sm + 30;
											const open = dayStartMinutes();
											const top = ((sm - open) / 30) * SLOT_HEIGHT_PX;
											const height = ((em - sm) / 30) * SLOT_HEIGHT_PX;
											const wPct = 100 / columnCount;
											const leftPct = column * wPct;
											const colors = serviceColorClasses(a.serviceType);
											return (
												<button
													key={a.id}
													type="button"
													className={`pointer-events-auto absolute overflow-hidden rounded border-l-4 px-1 py-0.5 text-left text-xs shadow-sm transition hover:brightness-95 ${colors}`}
													style={{
														top,
														height: Math.max(height - 2, 18),
														left: `calc(${leftPct}% + 2px)`,
														width: `calc(${wPct}% - 4px)`,
													}}
													onClick={(ev) => {
														ev.stopPropagation();
														onAppointmentClick(a);
													}}
												>
													<div className="font-semibold truncate leading-tight">
														{a.patientFullName}
													</div>
													<div className="truncate opacity-90 tabular-nums">
														{formatTimeLabel(
															a.startTime,
															settings.timeDisplay,
														)}{" "}
														–{" "}
														{formatTimeLabel(
															a.endTime,
															settings.timeDisplay,
														)}
													</div>
												</button>
											);
										})}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
