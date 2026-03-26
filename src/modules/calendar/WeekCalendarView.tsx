import {
	APPOINTMENT_BLOCK_WIDTH_FRACTION,
	SLOT_HEIGHT_PX,
	dayStartMinutes,
	slotCountForDay,
} from "../../core/constants";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
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
	/** Si devuelve false, el hueco no abre el modal de nueva cita (p. ej. antelación mínima). */
	isSlotCreatable?: (dateIso: string, startTime: string) => boolean;
	/** Mientras se recargan citas, indicador suave sin vaciar la grilla. */
	isRefreshing?: boolean;
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
	isSlotCreatable,
	isRefreshing,
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
		<div
			className="flex min-h-0 flex-1 min-w-0 flex-col bg-slate-50 text-slate-900"
			aria-label="Calendario semanal de citas"
		>
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
				{isRefreshing ? (
					<span className="text-xs text-sky-600" aria-live="polite">
						Actualizando citas…
					</span>
				) : null}
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
								className="flex min-w-[110px] flex-col border-l border-slate-200 bg-white"
							>
								<div
									className="sticky top-0 z-10 flex h-10 shrink-0 flex-col items-center justify-center border-b border-slate-200 bg-slate-100/95 px-1 backdrop-blur-sm"
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
										{SLOT_LABELS.map((slot) => {
											const slotCreatable =
												isSlotCreatable?.(iso, slot) ?? true;
											return (
												<button
													key={`${iso}-${slot}`}
													type="button"
													disabled={!slotCreatable}
													className={
														slotCreatable
															? "w-full cursor-pointer border-b border-slate-100 bg-white transition-colors hover:bg-sky-50/50"
															: "w-full cursor-not-allowed border-b border-slate-100 bg-slate-50/90 text-slate-500"
													}
													onClick={() => {
														if (slotCreatable) onSlotClick(iso, slot);
													}}
													aria-label={
														slotCreatable
															? `Nueva cita el ${iso} a las ${slot}`
															: `Horario no disponible para nueva cita el ${iso} a las ${slot} (antelación mínima 30 minutos u otra regla)`
													}
												/>
											);
										})}
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
											// Banda coloreada = APPOINTMENT_BLOCK_WIDTH_FRACTION del ancho; cada columna = banda / columnCount (sin huecos).
											const bandPct =
												APPOINTMENT_BLOCK_WIDTH_FRACTION * 100;
											const widthPct = bandPct / columnCount;
											const leftPct = column * widthPct;
											const colors = serviceColorClasses(a.serviceType);
											const serviceLabel = serviceLabelFromSettings(
												settings,
												a.serviceType,
											);
											const edgeRound = [
												columnCount === 1 && "rounded-md",
												columnCount > 1 && column === 0 && "rounded-l-md",
												columnCount > 1 &&
													column === columnCount - 1 &&
													"rounded-r-md",
											]
												.filter(Boolean)
												.join(" ");
											return (
												<button
													key={a.id}
													type="button"
													className={`pointer-events-auto absolute overflow-hidden border-l-4 px-1 py-0.5 text-left text-xs shadow-sm transition hover:brightness-95 ${colors} ${edgeRound}`}
													style={{
														top,
														height: Math.max(height - 2, 36),
														left: `${leftPct}%`,
														width: `${widthPct}%`,
													}}
													onClick={(ev) => {
														ev.stopPropagation();
														onAppointmentClick(a);
													}}
												>
													<div className="flex min-h-0 flex-col gap-0.5 leading-tight">
														<div className="font-semibold truncate">
															{a.patientFullName}
														</div>
														<div className="truncate tabular-nums opacity-90">
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
														<div className="truncate text-[0.65rem] font-medium opacity-80">
															{serviceLabel}
														</div>
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
