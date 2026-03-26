import { useEffect, useMemo, useRef, useState } from "react";
import {
	COUNTRY_DIAL_OPTIONS,
	DEFAULT_COUNTRY_DIAL,
} from "../../core/countries";
import { validateAppointmentFormFields } from "../../core/appointmentFormValidation";
import { countOverlappingSameService } from "../../core/appointmentOverlap";
import {
	createAppointment,
	deleteAppointment,
	updateAppointment,
} from "../../core/api";
import { formatInvokeError } from "../../core/errors";
import { gracePeriodBookingErrorMessage } from "../../core/leadTime";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
import { publishDomainEvent } from "../../core/domainEvents";
import {
	addMinutesToHHMM,
	formatTimeLabel,
	generateSlotStarts,
	isValidAppointmentWindow,
	minutesFromHHMM,
} from "../../core/timeFormat";
import type {
	AppSettings,
	Appointment,
	AppointmentInput,
	AppointmentStatus,
} from "../../core/types";
import { isAppointmentPastEnd } from "../../core/weekUtils";

interface PresetSlot {
	date: string;
	startTime: string;
}

interface AppointmentModalProps {
	open: boolean;
	settings: AppSettings;
	/** Citas cargadas en el rango actual (p. ej. semana); sirve para vista previa de cupos */
	weekAppointments: Appointment[];
	mode: "create" | "edit";
	initial: Appointment | null;
	preset: PresetSlot | null;
	onClose: () => void;
	onSaved: () => void;
}

const SLOT_OPTIONS = generateSlotStarts();

function endOptionsForStart(start: string): string[] {
	const sm = minutesFromHHMM(start);
	if (sm === null) return [];
	const close = 20 * 60;
	const out: string[] = [];
	for (let em = sm + 30; em <= close; em += 30) {
		const h = Math.floor(em / 60);
		const m = em % 60;
		out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
	}
	return out;
}

export function AppointmentModal({
	open,
	settings,
	weekAppointments,
	mode,
	initial,
	preset,
	onClose,
	onSaved,
}: AppointmentModalProps) {
	const [patientFullName, setPatientFullName] = useState("");
	const [documentType, setDocumentType] = useState(
		settings.defaultDocumentType,
	);
	const [documentNumber, setDocumentNumber] = useState("");
	const [phoneDial, setPhoneDial] = useState(DEFAULT_COUNTRY_DIAL.dial);
	const [phoneNational, setPhoneNational] = useState("");
	const [birthdayMonth, setBirthdayMonth] = useState<string>("");
	const [appointmentDate, setAppointmentDate] = useState("");
	const [startTime, setStartTime] = useState("07:00");
	const [endTime, setEndTime] = useState("08:00");
	const [serviceType, setServiceType] = useState(
		settings.serviceTypes[0]?.id ?? "",
	);
	const [status, setStatus] = useState<AppointmentStatus>("pendiente");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const ends = useMemo(() => endOptionsForStart(startTime), [startTime]);

	const scheduleChanged = useMemo(() => {
		if (mode !== "edit" || !initial) return false;
		return (
			appointmentDate !== initial.appointmentDate ||
			startTime !== initial.startTime ||
			endTime !== initial.endTime
		);
	}, [mode, initial, appointmentDate, startTime, endTime]);

	const currentServiceLabel = useMemo(
		() => serviceLabelFromSettings(settings, serviceType),
		[settings, serviceType],
	);

	const capacityPreview = useMemo(() => {
		const st = settings.serviceTypes.find((s) => s.id === serviceType);
		if (!st || !appointmentDate) {
			return { cap: null as number | null, used: 0, label: "" };
		}
		const used = countOverlappingSameService(
			weekAppointments,
			appointmentDate,
			serviceType,
			startTime,
			endTime,
			mode === "edit" && initial ? initial.id : undefined,
		);
		return { cap: st.concurrentCapacity, used, label: st.label };
	}, [
		settings.serviceTypes,
		weekAppointments,
		appointmentDate,
		serviceType,
		startTime,
		endTime,
		mode,
		initial,
	]);

	const isPast = useMemo(() => {
		if (!appointmentDate || !endTime) return false;
		return isAppointmentPastEnd(appointmentDate, endTime);
	}, [appointmentDate, endTime]);

	const readOnlyPast = mode === "edit" && initial && isPast;

	useEffect(() => {
		if (!open) return;
		setError(null);
		if (mode === "edit" && initial) {
			setPatientFullName(initial.patientFullName);
			setDocumentType(initial.documentType);
			setDocumentNumber(initial.documentNumber);
			setPhoneDial(initial.phoneDialCode);
			setPhoneNational(initial.phoneNationalNumber);
			setBirthdayMonth(
				initial.birthdayMonth != null ? String(initial.birthdayMonth) : "",
			);
			setAppointmentDate(initial.appointmentDate);
			setStartTime(initial.startTime);
			setEndTime(initial.endTime);
			setServiceType(initial.serviceType);
			const ended = isAppointmentPastEnd(
				initial.appointmentDate,
				initial.endTime,
			);
			let st = initial.status;
			if (ended && st === "pendiente") {
				st = "asistio";
			}
			setStatus(st);
			return;
		}
		if (mode === "create") {
			setPatientFullName("");
			setDocumentType(settings.defaultDocumentType);
			setDocumentNumber("");
			setPhoneDial(DEFAULT_COUNTRY_DIAL.dial);
			setPhoneNational("");
			setBirthdayMonth("");
			setStatus("pendiente");
			const date = preset?.date ?? "";
			const start = preset?.startTime ?? "07:00";
			setAppointmentDate(date);
			setStartTime(start);
			const dur = settings.defaultDurationMinutes;
			const end =
				addMinutesToHHMM(start, dur) ?? endOptionsForStart(start)[0] ?? "08:00";
			setEndTime(end);
			setServiceType(settings.serviceTypes[0]?.id ?? "");
		}
	}, [open, mode, initial, preset, settings]);

	useEffect(() => {
		if (!ends.includes(endTime) && ends.length) {
			setEndTime(ends[0]!);
		}
	}, [ends, endTime]);

	useEffect(() => {
		if (!open) return;
		const id = window.setTimeout(() => panelRef.current?.focus(), 0);
		return () => clearTimeout(id);
	}, [open]);

	if (!open) return null;

	function buildInput(): AppointmentInput {
		const bm =
			birthdayMonth.trim() === ""
				? null
				: Number.parseInt(birthdayMonth, 10);
		const birthdayMonthVal =
			bm != null && !Number.isNaN(bm) && bm >= 1 && bm <= 12 ? bm : null;

		return {
			patientFullName: patientFullName.trim(),
			documentType,
			documentNumber: documentNumber.trim(),
			phoneDialCode: phoneDial,
			phoneNationalNumber: phoneNational.trim(),
			birthdayMonth: birthdayMonthVal,
			appointmentDate,
			startTime,
			endTime,
			serviceType,
			status,
		};
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const input = buildInput();

		if (readOnlyPast) {
			if (status !== "asistio" && status !== "no_asistio") {
				setError("Seleccione asistió o no asistió.");
				return;
			}
		} else {
			const fieldErr = validateAppointmentFormFields(input, settings);
			if (fieldErr) {
				setError(fieldErr);
				return;
			}
			if (!isValidAppointmentWindow(startTime, endTime)) {
				setError(
					"Horario inválido: use franjas de 30 min entre 07:00 y 20:00 (fin máx. 20:00).",
				);
				return;
			}
			if (capacityPreview.cap != null && capacityPreview.used >= capacityPreview.cap) {
				setError(
					`Capacidad superada para este servicio (máx. ${capacityPreview.cap} concurrentes). Cambie horario, servicio o amplíe la capacidad en configuración.`,
				);
				return;
			}
			if (mode === "create" || scheduleChanged) {
				const graceErr = gracePeriodBookingErrorMessage(
					appointmentDate,
					startTime,
				);
				if (graceErr) {
					setError(graceErr);
					return;
				}
			}
		}

		setBusy(true);
		try {
			if (mode === "create") {
				const row = await createAppointment({ ...input, status: undefined });
				await publishDomainEvent("cita_creada", row);
				onSaved();
				onClose();
				return;
			}
			if (initial) {
				const prevStatus = initial.status;
				const row = await updateAppointment(initial.id, input);
				if (
					(row.status === "asistio" || row.status === "no_asistio") &&
					prevStatus !== row.status
				) {
					await publishDomainEvent("cita_completada", row);
				}
				onSaved();
				onClose();
			}
		} catch (err) {
			setError(formatInvokeError(err) || "No se pudo guardar");
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (!initial || readOnlyPast) return;
		if (!confirm("¿Eliminar esta cita?")) return;
		setBusy(true);
		setError(null);
		try {
			await deleteAppointment(initial.id);
			await publishDomainEvent("cita_cancelada", initial);
			onSaved();
			onClose();
		} catch (err) {
			setError(formatInvokeError(err) || "No se pudo eliminar");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="appointment-modal-title"
		>
			<div
				ref={panelRef}
				tabIndex={-1}
				className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl outline-none ring-0"
			>
				<div className="border-b border-slate-200 px-5 py-4">
					<h2
						id="appointment-modal-title"
						className="text-lg font-semibold text-slate-800"
					>
						{readOnlyPast
							? "Asistencia (cita pasada)"
							: mode === "create"
								? "Nueva cita"
								: "Editar cita"}
					</h2>
					<p className="mt-1.5 text-sm text-slate-600">
						<span className="font-medium text-slate-700">
							Procedimiento:
						</span>{" "}
						<span className="text-slate-800">{currentServiceLabel}</span>
					</p>
				</div>

				<form
					onSubmit={handleSubmit}
					className="space-y-3 px-5 py-4"
					aria-describedby={error ? "appointment-modal-error" : undefined}
				>
					{error && (
						<div
							id="appointment-modal-error"
							role="alert"
							aria-live="assertive"
							className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
						>
							{error}
						</div>
					)}

					{readOnlyPast ? (
						<div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
							<p>
								<span className="font-medium">Paciente:</span>{" "}
								{patientFullName}
							</p>
							<p>
								<span className="font-medium">Procedimiento:</span>{" "}
								{currentServiceLabel}
							</p>
							<p>
								<span className="font-medium">Documento:</span> {documentType}{" "}
								{documentNumber}
							</p>
							<p>
								<span className="font-medium">Cuándo:</span> {appointmentDate}{" "}
								{formatTimeLabel(startTime, settings.timeDisplay)} –{" "}
								{formatTimeLabel(endTime, settings.timeDisplay)}
							</p>
							<label className="block pt-2 font-medium text-slate-800">
								Asistencia
								<select
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
									value={status}
									onChange={(ev) =>
										setStatus(ev.target.value as AppointmentStatus)
									}
								>
									<option value="asistio">Asistió</option>
									<option value="no_asistio">No asistió</option>
								</select>
							</label>
						</div>
					) : (
						<>
							<label className="block text-sm font-medium text-slate-700">
								Nombre completo
								<input
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
									value={patientFullName}
									onChange={(e) => setPatientFullName(e.target.value)}
									required
								/>
							</label>

							<div className="grid grid-cols-2 gap-2">
								<label className="block text-sm font-medium text-slate-700">
									Tipo documento
									<select
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
										value={documentType}
										onChange={(e) => setDocumentType(e.target.value)}
									>
										{settings.documentTypes.map((d) => (
											<option key={d} value={d}>
												{d}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm font-medium text-slate-700">
									Número documento
									<input
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
										value={documentNumber}
										onChange={(e) => setDocumentNumber(e.target.value)}
										required
									/>
								</label>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<label className="block text-sm font-medium text-slate-700">
									País / prefijo
									<select
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
										value={phoneDial}
										onChange={(e) => setPhoneDial(e.target.value)}
									>
										{COUNTRY_DIAL_OPTIONS.map((c) => (
											<option key={c.code} value={c.dial}>
												{c.name} (+{c.dial})
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm font-medium text-slate-700">
									Teléfono
									<input
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
										inputMode="numeric"
										value={phoneNational}
										onChange={(e) => setPhoneNational(e.target.value)}
										required
									/>
								</label>
							</div>

							<label className="block text-sm font-medium text-slate-700">
								Mes de cumpleaños (opcional, 1–12)
								<input
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
									inputMode="numeric"
									placeholder="Ej. 3"
									value={birthdayMonth}
									onChange={(e) => setBirthdayMonth(e.target.value)}
								/>
							</label>

							<label className="block text-sm font-medium text-slate-700">
								Día de la cita
								<input
									type="date"
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
									value={appointmentDate}
									onChange={(e) => setAppointmentDate(e.target.value)}
									required
								/>
							</label>

							<div className="grid grid-cols-2 gap-2">
								<label className="block text-sm font-medium text-slate-700">
									Inicio
									<select
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
										value={startTime}
										onChange={(e) => setStartTime(e.target.value)}
									>
										{SLOT_OPTIONS.map((s) => (
											<option key={s} value={s}>
												{formatTimeLabel(s, settings.timeDisplay)}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm font-medium text-slate-700">
									Fin
									<select
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
										value={endTime}
										onChange={(e) => setEndTime(e.target.value)}
									>
										{ends.map((s) => (
											<option key={s} value={s}>
												{formatTimeLabel(s, settings.timeDisplay)}
											</option>
										))}
									</select>
								</label>
							</div>

							<label className="block text-sm font-medium text-slate-700">
								Tipo de servicio (procedimiento)
								<select
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
									value={serviceType}
									onChange={(e) => setServiceType(e.target.value)}
								>
									{settings.serviceTypes.map((s) => (
										<option key={s.id} value={s.id}>
											{s.label} (cap. {s.concurrentCapacity})
										</option>
									))}
								</select>
							</label>

							{appointmentDate && capacityPreview.cap != null && (
								<p
									className={`text-xs ${
										capacityPreview.used >= capacityPreview.cap
											? "font-medium text-amber-800"
											: "text-slate-600"
									}`}
								>
									Ocupación en este horario ({capacityPreview.label}):{" "}
									{capacityPreview.used} / {capacityPreview.cap} citas solapadas
									(mismo servicio).{" "}
									{capacityPreview.used >= capacityPreview.cap
										? "No hay cupo adicional en esta franja."
										: null}
								</p>
							)}

							{mode === "edit" && initial && !isPast && (
								<label className="block text-sm font-medium text-slate-700">
									Estado
									<select
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
										value={status}
										onChange={(e) =>
											setStatus(e.target.value as AppointmentStatus)
										}
									>
										<option value="pendiente">Pendiente</option>
										<option value="asistio">Asistió</option>
										<option value="no_asistio">No asistió</option>
									</select>
								</label>
							)}
						</>
					)}

					<div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
						<button
							type="submit"
							disabled={busy}
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
						>
							Guardar
						</button>
						<button
							type="button"
							onClick={onClose}
							disabled={busy}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
						>
							Cancelar
						</button>
						{mode === "edit" && initial && !readOnlyPast && (
							<button
								type="button"
								onClick={handleDelete}
								disabled={busy}
								className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 ml-auto"
							>
								Eliminar
							</button>
						)}
					</div>
				</form>
			</div>
		</div>
	);
}
