import { useMemo } from "react";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
import { formatTimeLabel } from "../../core/timeFormat";
import type { AppSettings, Appointment, Evento } from "../../core/types";
import { toISODateLocal } from "../../core/weekUtils";
import { MiniCalendar } from "./MiniCalendar";
import { eventoBadgeClasses } from "./overlapLayout";

interface TodayAgendaSidebarProps {
	settings: AppSettings;
	appointments: Appointment[];
	eventos: Evento[];
	onEventoClick?: (ev: Evento) => void;
	/** Estado del mini calendario */
	miniCalYear: number;
	miniCalMonth: number;
	weekStartMonday: Date;
	datesWithAppointments: Set<string>;
	onMiniCalMonthChange: (year: number, month: number) => void;
	onMiniCalDateSelect: (dateIso: string) => void;
}

export function TodayAgendaSidebar({
	settings,
	appointments,
	eventos,
	onEventoClick,
	miniCalYear,
	miniCalMonth,
	weekStartMonday,
	datesWithAppointments,
	onMiniCalMonthChange,
	onMiniCalDateSelect,
}: TodayAgendaSidebarProps) {
	const now = new Date();
	const todayIso = toISODateLocal(now);
	const todayLabel = new Intl.DateTimeFormat("es-CO", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(now);

	const todayList = useMemo(() => {
		return appointments
			.filter((a) => a.appointmentDate === todayIso)
			.slice()
			.sort((a, b) => a.startTime.localeCompare(b.startTime));
	}, [appointments, todayIso]);

	const todayEventos = useMemo(() => {
		return eventos
			.filter((ev) => ev.fecha === todayIso)
			.slice()
			.sort((a, b) => {
				if (a.todoElDia && !b.todoElDia) return -1;
				if (!a.todoElDia && b.todoElDia) return 1;
				return (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "");
			});
	}, [eventos, todayIso]);

	const isEmpty = todayList.length === 0 && todayEventos.length === 0;

	return (
		<aside
			className="flex w-[14.4rem] shrink-0 flex-col border-r border-slate-200 bg-white"
			aria-label="Mini calendario y citas del día"
		>
			<div className="border-b border-slate-200">
				<MiniCalendar
					year={miniCalYear}
					month={miniCalMonth}
					weekStartMonday={weekStartMonday}
					datesWithAppointments={datesWithAppointments}
					onMonthChange={onMiniCalMonthChange}
					onDateSelect={onMiniCalDateSelect}
				/>
			</div>
			<div className="border-b border-slate-200 px-3 py-2">
				<h2 className="text-sm font-semibold capitalize text-slate-800">Hoy</h2>
				<p className="text-xs text-slate-500">{todayLabel}</p>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
				{todayEventos.length > 0 ? (
					<div className="mb-3 space-y-1.5">
						<p className="px-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
							Eventos
						</p>
						{todayEventos.map((ev) => (
							<button
								key={ev.id}
								type="button"
								className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${eventoBadgeClasses(ev.color)}`}
								onClick={() => onEventoClick?.(ev)}
							>
								<div className="font-medium line-clamp-2">{ev.titulo}</div>
								<div className="mt-0.5 text-[0.65rem] opacity-80">
									{ev.todoElDia
										? "Todo el día"
										: `${formatTimeLabel(ev.horaInicio ?? "", settings.timeDisplay)} – ${formatTimeLabel(ev.horaFin ?? "", settings.timeDisplay)}`}
								</div>
							</button>
						))}
					</div>
				) : null}

				{isEmpty ? (
					<p className="px-1 text-sm text-slate-500">
						No hay citas ni eventos programados para hoy.
					</p>
				) : todayList.length > 0 ? (
					<>
						{todayEventos.length > 0 ? (
							<p className="px-1 mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
								Citas
							</p>
						) : null}
						<ul className="space-y-2">
							{todayList.map((a) => (
								<li
									key={a.id}
									className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-sm"
								>
									<div className="flex items-center gap-1.5 font-medium text-slate-900">
										<span className="line-clamp-2">{a.patientFullName}</span>
										{a.isPaid ? (
											<span
												className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
												title="Pagada"
												aria-label="Cita pagada"
											/>
										) : null}
										{a.paqueteId ? (
											<span
												className="shrink-0 rounded bg-violet-200/90 px-0.5 text-[0.55rem] font-semibold text-violet-900"
												title="Paquete prepago"
											>
												Paq.
											</span>
										) : null}
									</div>
									<div className="mt-0.5 text-xs text-slate-600">
										{serviceLabelFromSettings(settings, a.serviceType)}
									</div>
									<div className="mt-0.5 text-xs tabular-nums text-slate-700">
										{formatTimeLabel(a.startTime, settings.timeDisplay)} –{" "}
										{formatTimeLabel(a.endTime, settings.timeDisplay)}
									</div>
								</li>
							))}
						</ul>
					</>
				) : null}
			</div>
		</aside>
	);
}
