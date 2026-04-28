import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CitaEventNotifier } from "./components/CitaEventNotifier";
import { FinanceEventListener } from "./components/FinanceEventListener";
import { HelpModal } from "./components/HelpModal";
import { StartupSplash } from "./components/StartupSplash";
import { ToastHost } from "./components/ToastHost";
import { ConfigAdminGate } from "./components/ConfigAdminGate";
import { StartupLoginScreen } from "./components/StartupLoginScreen";
import {
	getAdminAuthStatus,
	getAppointment,
	getSettings,
	getStartupAuthStatus,
	listAppointmentsRange,
	listarEventosRango,
	updateAppointment,
} from "./core/api";
import { formatInvokeError } from "./core/errors";
import { logger } from "./core/logger";
import { showToast } from "./core/toastBus";
import { check } from "@tauri-apps/plugin-updater";
import { APP_VERSION, EVENTO_CHANGED_EVENT, INGRESO_REGISTRADO_EVENT } from "./core/constants";
import { isSlotBookableWithGracePeriod } from "./core/leadTime";
import type { AppSettings, Appointment, Evento } from "./core/types";
import { addDays, getWeekDates, startOfWeekMonday, toISODateLocal } from "./core/weekUtils";
import { AppointmentModal } from "./modules/appointments/AppointmentModal";
import { EventoModal } from "./modules/calendar/EventoModal";
import { TodayAgendaSidebar } from "./modules/calendar/TodayAgendaSidebar";
import { WeekCalendarView } from "./modules/calendar/WeekCalendarView";
import { ClientesDashboard } from "./modules/clientes/ClientesDashboard";
import { ReportesModuleView } from "./modules/reports/ReportesModuleView";
import { SettingsPanel } from "./modules/settings/SettingsPanel";

type Tab = "calendario" | "reportes" | "clientes" | "configuracion";

/** Sin contraseña o ya verificada: se puede cargar configuración y UI principal. */
type StartupGate = "checking" | "password" | "ready";

/** Acceso al módulo Configuración (contraseña de administrador). */
type ConfigAdminPhase = "na" | "loading" | "bootstrap" | "verify" | "ready";

function App() {
	const [tab, setTab] = useState<Tab>("calendario");
	const [configAdminPhase, setConfigAdminPhase] = useState<ConfigAdminPhase>("na");
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [startupGate, setStartupGate] = useState<StartupGate>("checking");
	const [weekStartMonday, setWeekStartMonday] = useState(() => startOfWeekMonday(new Date()));
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [eventos, setEventos] = useState<Evento[]>([]);
	const [calendarRefreshing, setCalendarRefreshing] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<"create" | "edit">("create");
	const [editing, setEditing] = useState<Appointment | null>(null);
	const [presetSlot, setPresetSlot] = useState<{
		date: string;
		startTime: string;
	} | null>(null);
	const settingsDirtyRef = useRef(false);
	const [miniCalYear, setMiniCalYear] = useState(() => new Date().getFullYear());
	const [miniCalMonth, setMiniCalMonth] = useState(() => new Date().getMonth());
	const [eventoModalOpen, setEventoModalOpen] = useState(false);
	const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
	const [eventoPresetDate, setEventoPresetDate] = useState<string | null>(null);
	const [eventoPresetTime, setEventoPresetTime] = useState<string | null>(null);
	const [helpOpen, setHelpOpen] = useState(false);
	const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
	/** Tras contraseña de inicio correcta, mientras se obtiene `getSettings`. */
	const [postPasswordLoading, setPostPasswordLoading] = useState(false);

	const weekRange = useMemo(() => {
		if (!settings) return { start: "", end: "" };
		const days = getWeekDates(weekStartMonday, settings.showSundays);
		return {
			start: toISODateLocal(days[0]!),
			end: toISODateLocal(days[days.length - 1]!),
		};
	}, [weekStartMonday, settings]);

	/** Incluye el día de hoy aunque la semana visible no lo muestre (sidebar “Hoy”). */
	const fetchRange = useMemo(() => {
		if (!weekRange.start) return { start: "", end: "" };
		const today = toISODateLocal(new Date());
		const miniStart = toISODateLocal(new Date(miniCalYear, miniCalMonth, 1));
		const miniEnd = toISODateLocal(new Date(miniCalYear, miniCalMonth + 1, 0));
		let start = weekRange.start;
		let end = weekRange.end;
		if (today < start) start = today;
		if (today > end) end = today;
		if (miniStart < start) start = miniStart;
		if (miniEnd > end) end = miniEnd;
		return { start, end };
	}, [weekRange, miniCalYear, miniCalMonth]);

	const refreshAppointments = useCallback(async () => {
		if (!settings || !fetchRange.start) return;
		setCalendarRefreshing(true);
		try {
			const [list, evts] = await Promise.all([
				listAppointmentsRange(fetchRange.start, fetchRange.end),
				listarEventosRango(fetchRange.start, fetchRange.end),
			]);
			setAppointments(list);
			setEventos(evts);
		} catch (e) {
			void logger.invokeError("calendar.refresh", e);
		} finally {
			setCalendarRefreshing(false);
		}
	}, [settings, fetchRange.start, fetchRange.end]);

	const loadSettingsAfterAuth = useCallback(async () => {
		const s = await getSettings();
		setSettings(s);
		setLoadError(null);
		setStartupGate("ready");
	}, []);

	useEffect(() => {
		(async () => {
			try {
				const status = await getStartupAuthStatus();
				if (status.hasPassword) {
					setStartupGate("password");
				} else {
					await loadSettingsAfterAuth();
				}
			} catch (e) {
				void logger.invokeError("app.bootstrap", e);
				setLoadError(e instanceof Error ? e.message : "No se pudo cargar la configuración");
				setStartupGate("ready");
			}
		})();
	}, [loadSettingsAfterAuth]);

	useEffect(() => {
		if (startupGate !== "ready" || import.meta.env.DEV) return;
		let cancelled = false;
		(async () => {
			try {
				const update = await check({ timeout: 12_000 });
				if (cancelled || !update) return;
				showToast({
					level: "info",
					message: `Hay una nueva versión (${update.version}). Abra Configuración → Actualizaciones para instalarla.`,
					durationMs: 8000,
				});
			} catch {
				/* modo degradado: no bloquear arranque */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [startupGate]);

	useEffect(() => {
		void refreshAppointments();
	}, [refreshAppointments]);

	useEffect(() => {
		const onRefresh = () => {
			void refreshAppointments();
		};
		window.addEventListener(INGRESO_REGISTRADO_EVENT, onRefresh);
		window.addEventListener(EVENTO_CHANGED_EVENT, onRefresh);
		return () => {
			window.removeEventListener(INGRESO_REGISTRADO_EVENT, onRefresh);
			window.removeEventListener(EVENTO_CHANGED_EVENT, onRefresh);
		};
	}, [refreshAppointments]);

	useEffect(() => {
		if (tab !== "configuracion") {
			setConfigAdminPhase("na");
			return;
		}
		let cancelled = false;
		setConfigAdminPhase("loading");
		(async () => {
			try {
				const s = await getAdminAuthStatus();
				if (cancelled) return;
				setConfigAdminPhase(s.hasPassword ? "verify" : "bootstrap");
			} catch {
				if (!cancelled) setConfigAdminPhase("bootstrap");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [tab]);

	function switchTab(next: Tab) {
		if (tab === "configuracion" && next !== "configuracion" && settingsDirtyRef.current) {
			if (
				!window.confirm("Hay cambios sin guardar en la configuración. ¿Desea salir sin guardar?")
			) {
				return;
			}
		}
		setTab(next);
	}

	const datesWithAppointments = useMemo(() => {
		const s = new Set<string>();
		for (const a of appointments) s.add(a.appointmentDate);
		return s;
	}, [appointments]);

	function handleMiniCalMonthChange(y: number, m: number) {
		setMiniCalYear(y);
		setMiniCalMonth(m);
	}

	function handleMiniCalDateSelect(dateIso: string) {
		const d = new Date(dateIso + "T00:00:00");
		setWeekStartMonday(startOfWeekMonday(d));
		setMiniCalYear(d.getFullYear());
		setMiniCalMonth(d.getMonth());
	}

	function onWeekShift(delta: number) {
		setWeekStartMonday((w) => {
			const next = addDays(w, delta * 7);
			setMiniCalYear(next.getFullYear());
			setMiniCalMonth(next.getMonth());
			return next;
		});
	}

	function onGoToToday() {
		const now = new Date();
		setWeekStartMonday(startOfWeekMonday(now));
		setMiniCalYear(now.getFullYear());
		setMiniCalMonth(now.getMonth());
	}

	function openCreate(date: string, startTime: string) {
		setModalMode("create");
		setEditing(null);
		setPresetSlot({ date, startTime });
		setModalOpen(true);
	}

	function openEdit(a: Appointment) {
		setModalMode("edit");
		setEditing(a);
		setPresetSlot(null);
		setModalOpen(true);
	}

	function openEventoCreate(dateIso: string, startTime?: string) {
		setEditingEvento(null);
		setEventoPresetDate(dateIso);
		setEventoPresetTime(startTime ?? null);
		setEventoModalOpen(true);
	}

	async function handleQuickStatus(appointmentId: string, status: "asistio" | "no_asistio") {
		try {
			const appt = await getAppointment(appointmentId);
			await updateAppointment(appointmentId, {
				patientFullName: appt.patientFullName,
				documentType: appt.documentType,
				documentNumber: appt.documentNumber,
				phoneDialCode: appt.phoneDialCode,
				phoneNationalNumber: appt.phoneNationalNumber,
				birthdayMonth: appt.birthdayMonth,
				appointmentDate: appt.appointmentDate,
				startTime: appt.startTime,
				endTime: appt.endTime,
				serviceType: appt.serviceType,
				status,
			});
			void refreshAppointments();
		} catch (err) {
			void logger.invokeError("calendar.quickStatus", err);
			showToast({
				level: "error",
				message: formatInvokeError(err) || "No se pudo actualizar la cita",
			});
		}
	}

	function openEventoEdit(ev: Evento) {
		setEditingEvento(ev);
		setEventoPresetDate(null);
		setEventoPresetTime(null);
		setEventoModalOpen(true);
	}

	useEffect(() => {
		function block(e: MouseEvent) {
			e.preventDefault();
		}
		document.addEventListener("contextmenu", block);
		return () => document.removeEventListener("contextmenu", block);
	}, []);

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		(async () => {
			try {
				const { getCurrentWindow } = await import("@tauri-apps/api/window");
				const appWindow = getCurrentWindow();
				unlisten = await appWindow.onCloseRequested((event) => {
					event.preventDefault();
					setConfirmCloseOpen(true);
				});
			} catch (e) {
				void logger.error(`No se pudo registrar confirmación de cierre: ${formatInvokeError(e)}`, {
					target: "app.window",
				});
			}
		})();
		return () => {
			unlisten?.();
		};
	}, []);

	async function handleConfirmClose() {
		try {
			const { getCurrentWindow } = await import("@tauri-apps/api/window");
			await getCurrentWindow().destroy();
		} catch (e) {
			void logger.error(`No se pudo cerrar la ventana: ${formatInvokeError(e)}`, {
				target: "app.window",
			});
			setConfirmCloseOpen(false);
		}
	}

	if (loadError) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
				<div className="max-w-md rounded-xl bg-white p-6 shadow border border-red-100 text-red-800">
					<p className="font-semibold">Error</p>
					<p className="mt-2 text-sm">{loadError}</p>
					<p className="mt-3 text-xs text-slate-600">
						Esta aplicación requiere el runtime de Tauri y Rust compilado. Ejecute{" "}
						<code className="bg-slate-100 px-1">npm run tauri dev</code>.
					</p>
				</div>
			</div>
		);
	}

	if (startupGate === "checking") {
		return <StartupSplash />;
	}

	if (startupGate === "password") {
		if (postPasswordLoading) {
			return <StartupSplash />;
		}
		return (
			<StartupLoginScreen
				onSuccess={async () => {
					setPostPasswordLoading(true);
					try {
						await loadSettingsAfterAuth();
					} catch (e) {
						setLoadError(e instanceof Error ? e.message : "No se pudo cargar la configuración");
					} finally {
						setPostPasswordLoading(false);
					}
				}}
			/>
		);
	}

	if (!settings) {
		return <StartupSplash />;
	}

	return (
		<div className="h-screen flex flex-col bg-slate-100">
			<nav className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
				<div className="flex flex-wrap items-center gap-1">
					<button
						type="button"
						className={`rounded-lg px-4 py-2 text-sm font-medium ${
							tab === "calendario" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
						}`}
						onClick={() => switchTab("calendario")}
					>
						Calendario
					</button>
					<button
						type="button"
						className={`rounded-lg px-4 py-2 text-sm font-medium ${
							tab === "reportes" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
						}`}
						onClick={() => switchTab("reportes")}
					>
						📊 Reportes
					</button>
					<button
						type="button"
						className={`rounded-lg px-4 py-2 text-sm font-medium ${
							tab === "clientes" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
						}`}
						onClick={() => switchTab("clientes")}
					>
						👥 Clientes
					</button>
					<button
						type="button"
						className={`rounded-lg px-4 py-2 text-sm font-medium ${
							tab === "configuracion"
								? "bg-sky-600 text-white"
								: "text-slate-700 hover:bg-slate-100"
						}`}
						onClick={() => switchTab("configuracion")}
					>
						Configuración
					</button>
				</div>
				<button
					type="button"
					onClick={() => setHelpOpen(true)}
					className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					title={`Ayuda (v${APP_VERSION}) — guía, versión y contacto del autor`}
				>
					<svg
						className="h-4 w-4 shrink-0 text-sky-600"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
						aria-hidden
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.45-.994.9V15m0 3h.01M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"
						/>
					</svg>
					Ayuda
				</button>
			</nav>

			<main className="flex-1 min-h-0 overflow-hidden">
				{tab === "calendario" ? (
					<div className="flex h-full min-h-0">
						<TodayAgendaSidebar
							settings={settings}
							appointments={appointments}
							eventos={eventos}
							onEventoClick={openEventoEdit}
							miniCalYear={miniCalYear}
							miniCalMonth={miniCalMonth}
							weekStartMonday={weekStartMonday}
							datesWithAppointments={datesWithAppointments}
							onMiniCalMonthChange={handleMiniCalMonthChange}
							onMiniCalDateSelect={handleMiniCalDateSelect}
						/>
						<WeekCalendarView
							weekStartMonday={weekStartMonday}
							settings={settings}
							appointments={appointments}
							eventos={eventos}
							isSlotCreatable={(dateIso, startTime) =>
								isSlotBookableWithGracePeriod(dateIso, startTime)
							}
							isRefreshing={calendarRefreshing}
							onSlotClick={openCreate}
							onAppointmentClick={openEdit}
							onAppointmentStatusChange={(id, st) => void handleQuickStatus(id, st)}
							onEventoClick={openEventoEdit}
							onNewEvento={(dateIso) => openEventoCreate(dateIso)}
							onWeekShift={onWeekShift}
							onGoToToday={onGoToToday}
						/>
					</div>
				) : tab === "reportes" ? (
					<ReportesModuleView settings={settings} />
				) : tab === "clientes" ? (
					<ClientesDashboard settings={settings} />
				) : configAdminPhase === "ready" ? (
					<div className="h-full overflow-y-auto bg-slate-50">
						<SettingsPanel
							settings={settings}
							onSettingsSaved={(s) => {
								setSettings(s);
								void refreshAppointments();
							}}
							onClose={() => setTab("calendario")}
							dirtyRef={settingsDirtyRef}
						/>
					</div>
				) : (
					<div className="h-full min-h-0 overflow-y-auto bg-slate-50">
						<ConfigAdminGate
							phase={
								configAdminPhase === "bootstrap"
									? "bootstrap"
									: configAdminPhase === "verify"
										? "verify"
										: "loading"
							}
							onBootstrapComplete={() => setConfigAdminPhase("ready")}
							onVerifyComplete={() => setConfigAdminPhase("ready")}
							onCancel={() => setTab("calendario")}
						/>
					</div>
				)}
			</main>

			<AppointmentModal
				open={modalOpen}
				settings={settings}
				weekAppointments={appointments}
				mode={modalMode}
				initial={editing}
				preset={presetSlot}
				onClose={() => setModalOpen(false)}
				onSaved={() => void refreshAppointments()}
				adminMode={settings.adminMode ?? false}
			/>
			<EventoModal
				open={eventoModalOpen}
				initial={editingEvento}
				presetDate={eventoPresetDate}
				presetTime={eventoPresetTime}
				adminMode={settings.adminMode ?? false}
				onClose={() => setEventoModalOpen(false)}
			/>
			<CitaEventNotifier />
			<FinanceEventListener settings={settings} />
			<ToastHost />
			<HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
			{confirmCloseOpen && (
				<div
					className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="confirm-close-title"
				>
					<div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
						<h2 id="confirm-close-title" className="text-lg font-semibold text-slate-800">
							Cerrar aplicación
						</h2>
						<p className="mt-2 text-sm text-slate-600">¿Desea cerrar la aplicación?</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmCloseOpen(false)}
								className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={() => void handleConfirmClose()}
								className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
							>
								Cerrar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
