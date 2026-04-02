import { useCallback, useEffect, useMemo, useState } from "react";
import { CitaEventNotifier } from "./components/CitaEventNotifier";
import { FinanceEventListener } from "./components/FinanceEventListener";
import { getSettings, listAppointmentsRange } from "./core/api";
import { INGRESO_REGISTRADO_EVENT } from "./core/constants";
import { isSlotBookableWithGracePeriod } from "./core/leadTime";
import type { AppSettings, Appointment } from "./core/types";
import { addDays, getWeekDates, startOfWeekMonday, toISODateLocal } from "./core/weekUtils";
import { AppointmentModal } from "./modules/appointments/AppointmentModal";
import { TodayAgendaSidebar } from "./modules/calendar/TodayAgendaSidebar";
import { WeekCalendarView } from "./modules/calendar/WeekCalendarView";
import { FinanceDashboard } from "./modules/finances/FinanceDashboard";
import { SettingsPanel } from "./modules/settings/SettingsPanel";

type Tab = "calendario" | "finanzas" | "configuracion";

function App() {
	const [tab, setTab] = useState<Tab>("calendario");
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [weekStartMonday, setWeekStartMonday] = useState(() =>
		startOfWeekMonday(new Date()),
	);
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [calendarRefreshing, setCalendarRefreshing] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<"create" | "edit">("create");
	const [editing, setEditing] = useState<Appointment | null>(null);
	const [presetSlot, setPresetSlot] = useState<{
		date: string;
		startTime: string;
	} | null>(null);

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
		let start = weekRange.start;
		let end = weekRange.end;
		if (today < start) {
			start = today;
		}
		if (today > end) {
			end = today;
		}
		return { start, end };
	}, [weekRange]);

	const refreshAppointments = useCallback(async () => {
		if (!settings || !fetchRange.start) return;
		setCalendarRefreshing(true);
		try {
			const list = await listAppointmentsRange(fetchRange.start, fetchRange.end);
			setAppointments(list);
		} catch (e) {
			console.error(e);
		} finally {
			setCalendarRefreshing(false);
		}
	}, [settings, fetchRange.start, fetchRange.end]);

	useEffect(() => {
		(async () => {
			try {
				const s = await getSettings();
				setSettings(s);
				setLoadError(null);
			} catch (e) {
				setLoadError(
					e instanceof Error ? e.message : "No se pudo cargar la configuración",
				);
			}
		})();
	}, []);

	useEffect(() => {
		void refreshAppointments();
	}, [refreshAppointments]);

	useEffect(() => {
		const onIngreso = () => {
			void refreshAppointments();
		};
		window.addEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
		return () =>
			window.removeEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
	}, [refreshAppointments]);

	function onWeekShift(delta: number) {
		setWeekStartMonday((w) => addDays(w, delta * 7));
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

	if (loadError) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
				<div className="max-w-md rounded-xl bg-white p-6 shadow border border-red-100 text-red-800">
					<p className="font-semibold">Error</p>
					<p className="mt-2 text-sm">{loadError}</p>
					<p className="mt-3 text-xs text-slate-600">
						Esta aplicación requiere el runtime de Tauri y Rust compilado.
						Ejecute <code className="bg-slate-100 px-1">npm run tauri dev</code>.
					</p>
				</div>
			</div>
		);
	}

	if (!settings) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
				Cargando…
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col bg-slate-100">
			<nav className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
				<button
					type="button"
					className={`rounded-lg px-4 py-2 text-sm font-medium ${
						tab === "calendario"
							? "bg-sky-600 text-white"
							: "text-slate-700 hover:bg-slate-100"
					}`}
					onClick={() => setTab("calendario")}
				>
					Calendario
				</button>
				<button
					type="button"
					className={`rounded-lg px-4 py-2 text-sm font-medium ${
						tab === "finanzas"
							? "bg-sky-600 text-white"
							: "text-slate-700 hover:bg-slate-100"
					}`}
					onClick={() => setTab("finanzas")}
				>
					💰 Cierre de caja
				</button>
				<button
					type="button"
					className={`rounded-lg px-4 py-2 text-sm font-medium ${
						tab === "configuracion"
							? "bg-sky-600 text-white"
							: "text-slate-700 hover:bg-slate-100"
					}`}
					onClick={() => setTab("configuracion")}
				>
					Configuración
				</button>
			</nav>

			<main className="flex-1 min-h-0 overflow-hidden">
				{tab === "calendario" ? (
					<div className="flex h-full min-h-0">
						<TodayAgendaSidebar
							settings={settings}
							appointments={appointments}
						/>
						<WeekCalendarView
							weekStartMonday={weekStartMonday}
							settings={settings}
							appointments={appointments}
							isSlotCreatable={(dateIso, startTime) =>
								isSlotBookableWithGracePeriod(dateIso, startTime)
							}
							isRefreshing={calendarRefreshing}
							onSlotClick={openCreate}
							onAppointmentClick={openEdit}
							onWeekShift={onWeekShift}
						/>
					</div>
				) : tab === "finanzas" ? (
					<FinanceDashboard />
				) : (
					<div className="h-full overflow-y-auto bg-slate-50">
						<SettingsPanel
							settings={settings}
							onSettingsSaved={(s) => {
								setSettings(s);
								void refreshAppointments();
							}}
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
			<CitaEventNotifier />
			<FinanceEventListener settings={settings} />
		</div>
	);
}

export default App;
