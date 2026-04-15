import { useState } from "react";
import {
	APPOINTMENT_BLOCK_WIDTH_FRACTION,
	MAX_GRACE_PERIOD_MINUTES,
	SLOT_HEIGHT_PX,
	dayStartMinutes,
	slotCountForDay,
} from "../../core/constants";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
import type { AppSettings, Appointment, Evento } from "../../core/types";
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
import { ContextMenu, type ContextMenuEntry } from "../../components/ContextMenu";
import {
	layoutDayAppointments,
	serviceColorClasses,
	eventoBlockClasses,
	eventoBadgeClasses,
	type LayoutBlock,
} from "./overlapLayout";

interface WeekCalendarViewProps {
	weekStartMonday: Date;
	settings: AppSettings;
	appointments: Appointment[];
	eventos: Evento[];
	/** Si devuelve false, el hueco no abre el modal de nueva cita (p. ej. periodo de gracia vencido). */
	isSlotCreatable?: (dateIso: string, startTime: string) => boolean;
	/** Mientras se recargan citas, indicador suave sin vaciar la grilla. */
	isRefreshing?: boolean;
	onSlotClick: (dateIso: string, startTime: string) => void;
	onAppointmentClick: (a: Appointment) => void;
	onAppointmentStatusChange?: (id: string, status: "asistio" | "no_asistio") => void;
	onEventoClick: (ev: Evento) => void;
	onNewEvento: (dateIso: string) => void;
	onWeekShift: (deltaWeeks: number) => void;
	onGoToToday: () => void;
}

const SLOT_LABELS = generateSlotStarts();
const NUM_SLOTS = slotCountForDay();
const HEADER_TOP_H = 40;

type CtxState = {
	x: number;
	y: number;
	items: ContextMenuEntry[];
} | null;

export function WeekCalendarView({
	weekStartMonday,
	settings,
	appointments,
	eventos,
	isSlotCreatable,
	isRefreshing,
	onSlotClick,
	onAppointmentClick,
	onAppointmentStatusChange,
	onEventoClick,
	onNewEvento,
	onWeekShift,
	onGoToToday,
}: WeekCalendarViewProps) {
	const [ctxMenu, setCtxMenu] = useState<CtxState>(null);
	const days = getWeekDates(weekStartMonday, settings.showSundays);
	const todayIso = toISODateLocal(new Date());
	const isCurrentWeek = days.some((d) => toISODateLocal(d) === todayIso);
	const labels = weekDayLabels();

	const gridBodyHeight = NUM_SLOTS * SLOT_HEIGHT_PX;

	const allDayByDate = new Map<string, Evento[]>();
	const timedByDate = new Map<string, Evento[]>();
	for (const ev of eventos) {
		if (ev.todoElDia) {
			const arr = allDayByDate.get(ev.fecha) ?? [];
			arr.push(ev);
			allDayByDate.set(ev.fecha, arr);
		} else {
			const arr = timedByDate.get(ev.fecha) ?? [];
			arr.push(ev);
			timedByDate.set(ev.fecha, arr);
		}
	}

	const hasAnyAllDay = Array.from(allDayByDate.values()).some((a) => a.length > 0);
	const ALL_DAY_ROW_H = hasAnyAllDay ? 28 : 0;

	/** Altura total del cuerpo del calendario (cabecera alineada + slots); la columna de horas debe cubrirla siempre en blanco. */
	const scrollBodyMinHeight = HEADER_TOP_H + ALL_DAY_ROW_H + gridBodyHeight;

	function layoutsForDate(iso: string): LayoutBlock[] {
		const dayAppts = appointments.filter((a) => a.appointmentDate === iso);
		return layoutDayAppointments(dayAppts);
	}

	function openSlotContextMenu(e: React.MouseEvent, dateIso: string, slot: string, creatable: boolean) {
		e.preventDefault();
		e.stopPropagation();
		const items: ContextMenuEntry[] = [];
		if (creatable) {
			items.push({ label: "Nueva cita aquí", onClick: () => onSlotClick(dateIso, slot) });
		}
		items.push({ label: "Nuevo evento aquí", onClick: () => onNewEvento(dateIso) });
		if (items.length > 0) setCtxMenu({ x: e.clientX, y: e.clientY, items });
	}

	function openApptContextMenu(e: React.MouseEvent, a: Appointment) {
		e.preventDefault();
		e.stopPropagation();
		const items: ContextMenuEntry[] = [
			{ label: "Editar cita", onClick: () => onAppointmentClick(a) },
		];
		if (onAppointmentStatusChange && a.status !== "asistio") {
			items.push({ label: "Marcar: Asistió", onClick: () => onAppointmentStatusChange(a.id, "asistio") });
		}
		if (onAppointmentStatusChange && a.status !== "no_asistio") {
			items.push({ label: "Marcar: No asistió", onClick: () => onAppointmentStatusChange(a.id, "no_asistio") });
		}
		setCtxMenu({ x: e.clientX, y: e.clientY, items });
	}

	return (
		<div
			className="flex min-h-0 flex-1 min-w-0 flex-col bg-slate-50 text-slate-900"
			aria-label="Calendario semanal de citas"
		>
			<header className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-4 py-3 shadow-sm shrink-0">
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
					<button
						type="button"
						disabled={isCurrentWeek}
						className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-default disabled:opacity-40"
						onClick={onGoToToday}
					>
						Hoy
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
				<button
					type="button"
					className="ml-auto rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
					onClick={() => onNewEvento(todayIso)}
				>
					+ Evento
				</button>
			</header>

			<div className="flex flex-1 min-h-0 overflow-auto">
				{/* Columna de horas: independiente del estado de los slots (siempre fondo base uniforme) */}
				<div
					className="sticky left-0 z-20 flex w-[4.5rem] min-w-[4.5rem] shrink-0 flex-col border-r border-slate-300 bg-white"
					style={{
						minHeight: scrollBodyMinHeight,
					}}
				>
					{/* Esquina fija: por encima de cabeceras de día y de citas al hacer scroll */}
					<div
						className="sticky top-0 z-40 shrink-0 border-b border-r border-slate-300 bg-white"
						style={{ height: HEADER_TOP_H + ALL_DAY_ROW_H }}
						aria-hidden
					/>
					<div className="flex w-full flex-col bg-white">
						{SLOT_LABELS.map((slot) => (
							<div
								key={slot}
								className="flex shrink-0 items-start justify-end bg-white pr-1 pt-0.5 text-xs text-slate-500 tabular-nums leading-none"
								style={{ height: SLOT_HEIGHT_PX }}
							>
								{formatTimeLabel(slot, settings.timeDisplay)}
							</div>
						))}
					</div>
				</div>

				{/* Días: columna = flex-col + border-r; celdas = border-b; citas = única capa absolute */}
				<div
					className="grid min-w-0 flex-1"
					style={{
						gridTemplateColumns: `repeat(${days.length}, minmax(110px, 1fr))`,
					}}
				>
					{days.map((d, colIdx) => {
						const iso = toISODateLocal(d);
						const short = labels[colIdx]?.short ?? "";
						const layouts = layoutsForDate(iso);
						const dayAllDay = allDayByDate.get(iso) ?? [];
						const dayTimed = timedByDate.get(iso) ?? [];

						return (
							<div
								key={iso}
								className="flex min-w-[110px] flex-col border-r border-slate-200 bg-white"
							>
								<div
									className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-slate-100 px-1"
									style={{ height: HEADER_TOP_H + ALL_DAY_ROW_H }}
								>
									<div className="flex flex-col items-center justify-center" style={{ height: HEADER_TOP_H }}>
										<span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
											{short}
										</span>
										<span className="text-sm font-bold text-slate-800">
											{d.getDate()}
										</span>
									</div>
									{hasAnyAllDay ? (
										<div className="flex gap-0.5 overflow-hidden px-0.5" style={{ height: ALL_DAY_ROW_H }}>
											{dayAllDay.length > 0
												? dayAllDay.map((ev) => (
													<button
														key={ev.id}
														type="button"
														className={`truncate rounded px-1 py-0.5 text-[0.6rem] font-medium leading-tight ${eventoBadgeClasses(ev.color)}`}
														title={ev.titulo}
														onClick={(e) => {
															e.stopPropagation();
															onEventoClick(ev);
														}}
													>
														{ev.titulo}
													</button>
												))
												: <span className="text-[0.6rem] text-transparent select-none">&nbsp;</span>}
										</div>
									) : null}
								</div>

								<div
									className="relative flex shrink-0 flex-col"
									style={{ height: gridBodyHeight }}
								>
									{SLOT_LABELS.map((slot) => {
										const slotCreatable =
											isSlotCreatable?.(iso, slot) ?? true;
										return (
											<button
												key={`${iso}-${slot}`}
												type="button"
												disabled={!slotCreatable}
												style={{ height: SLOT_HEIGHT_PX }}
												className={
													"w-full shrink-0 border-b border-slate-200 " +
													(slotCreatable
														? "cursor-pointer bg-white transition-colors hover:bg-sky-50/50"
														: "cursor-not-allowed bg-slate-100 text-slate-500")
												}
												onClick={() => {
													if (slotCreatable) onSlotClick(iso, slot);
												}}
												onContextMenu={(e) => openSlotContextMenu(e, iso, slot, slotCreatable)}
												aria-label={
													slotCreatable
														? `Nueva cita el ${iso} a las ${slot}`
														: `Horario no disponible para nueva cita el ${iso} a las ${slot} (periodo de gracia de ${MAX_GRACE_PERIOD_MINUTES} min vencido u otra regla)`
												}
											/>
										);
									})}

									<div className="pointer-events-none absolute inset-0 z-0">
										{layouts.map(({ appointment: a, column, columnCount }) => {
											const sm =
												minutesFromHHMM(a.startTime) ?? dayStartMinutes();
											const em =
												minutesFromHHMM(a.endTime) ?? sm + 30;
											const open = dayStartMinutes();
											const top = ((sm - open) / 30) * SLOT_HEIGHT_PX;
											const height = ((em - sm) / 30) * SLOT_HEIGHT_PX;
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
													onClick={(clickEv) => {
														clickEv.stopPropagation();
														onAppointmentClick(a);
													}}
													onContextMenu={(e) => openApptContextMenu(e, a)}
												>
													<div className="flex min-h-0 flex-col gap-0.5 leading-tight">
														<div className="flex items-center gap-1 font-semibold truncate">
															<span className="truncate">{a.patientFullName}</span>
															{a.isPaid ? (
																<span
																	className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
																	title="Pagada"
																	aria-label="Cita pagada"
																/>
															) : null}
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
										{dayTimed.map((ev) => {
											const sm = minutesFromHHMM(ev.horaInicio ?? "") ?? dayStartMinutes();
											const em = minutesFromHHMM(ev.horaFin ?? "") ?? sm + 30;
											const open = dayStartMinutes();
											const top = ((sm - open) / 30) * SLOT_HEIGHT_PX;
											const height = ((em - sm) / 30) * SLOT_HEIGHT_PX;
											const evColors = eventoBlockClasses(ev.color);
											return (
												<button
													key={`ev-${ev.id}`}
													type="button"
													className={`pointer-events-auto absolute right-0 overflow-hidden rounded-md border-l-4 border-dashed px-1 py-0.5 text-left text-xs shadow-sm transition hover:brightness-95 ${evColors}`}
													style={{
														top,
														height: Math.max(height - 2, 28),
														width: "30%",
													}}
													onClick={(clickEv) => {
														clickEv.stopPropagation();
														onEventoClick(ev);
													}}
													title={ev.descripcion || ev.titulo}
												>
													<div className="flex min-h-0 flex-col gap-0.5 leading-tight">
														<span className="truncate font-semibold">{ev.titulo}</span>
														<span className="truncate tabular-nums opacity-90">
															{formatTimeLabel(ev.horaInicio ?? "", settings.timeDisplay)}
															{" – "}
															{formatTimeLabel(ev.horaFin ?? "", settings.timeDisplay)}
														</span>
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

			{ctxMenu ? (
				<ContextMenu
					x={ctxMenu.x}
					y={ctxMenu.y}
					items={ctxMenu.items}
					onClose={() => setCtxMenu(null)}
				/>
			) : null}
		</div>
	);
}
