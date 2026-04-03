import { useEffect, useMemo, useRef, useState } from "react";
import {
	COUNTRY_DIAL_OPTIONS,
	DEFAULT_COUNTRY_DIAL,
} from "../../core/countries";
import { validateAppointmentFormFields } from "../../core/appointmentFormValidation";
import { countOverlappingSameService } from "../../core/appointmentOverlap";
import {
	actualizarCliente,
	buscarClientes,
	crearCliente,
	createAppointment,
	deleteAppointment,
	updateAppointment,
} from "../../core/api";
import { formatInvokeError } from "../../core/errors";
import { gracePeriodBookingErrorMessage } from "../../core/leadTime";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
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
	Cliente,
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
	/** Cuando está activo, permite eliminar citas pasadas (modo administrador). */
	adminMode?: boolean;
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
	adminMode = false,
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

	// Autocomplete de clientes
	const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
	const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
	const [clienteYaExistia, setClienteYaExistia] = useState(false);
	const [clienteOriginal, setClienteOriginal] = useState<Cliente | null>(null);
	const [mostrarConfirmacionCliente, setMostrarConfirmacionCliente] = useState(false);
	const [guardandoCliente, setGuardandoCliente] = useState(false);
	const debounceNombreRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

	const readOnlyPast =
		mode === "edit" && initial != null && isPast && !adminMode;
	const isPaidLocked = mode === "edit" && initial?.isPaid === true;

	useEffect(() => {
		if (!open) return;
		setSugerencias([]);
		setMostrarSugerencias(false);
		setClienteYaExistia(false);
		setClienteOriginal(null);
		setMostrarConfirmacionCliente(false);
	}, [open]);

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

	async function handleActualizarCliente() {
		if (!clienteOriginal) { onSaved(); onClose(); return; }
		setGuardandoCliente(true);
		try {
			const partes = patientFullName.trim().split(/\s+/);
			const apellidos = partes.length > 1 ? partes[partes.length - 1]! : clienteOriginal.apellidos;
			const nombres = partes.length > 1 ? partes.slice(0, -1).join(" ") : partes[0] ?? patientFullName;
			const bm = birthdayMonth.trim() === "" ? null : Number.parseInt(birthdayMonth, 10);
			await actualizarCliente(clienteOriginal.id, {
				nombres,
				apellidos,
				documentType,
				documentNumber: documentNumber.trim(),
				phoneDialCode: phoneDial,
				phoneNationalNumber: phoneNational.trim(),
				email: clienteOriginal.email,
				birthdayMonth: bm != null && !Number.isNaN(bm) ? bm : null,
				notas: clienteOriginal.notas,
			});
		} catch {
			// Ignorar — la cita ya fue guardada
		} finally {
			setGuardandoCliente(false);
			onSaved();
			onClose();
		}
	}

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
			if (isPaidLocked) {
				setError(
					"No se puede modificar una cita que ya tiene un pago registrado.",
				);
				return;
			}
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
				await createAppointment({ ...input, status: undefined });

				if (clienteYaExistia && clienteOriginal) {
					// Cliente seleccionado del dropdown — verificar si hubo cambios
					const nombreCompleto = `${clienteOriginal.nombres} ${clienteOriginal.apellidos}`.trim();
					const hayDiferencias =
						nombreCompleto !== input.patientFullName.trim() ||
						clienteOriginal.documentType !== input.documentType ||
						clienteOriginal.documentNumber !== input.documentNumber ||
						clienteOriginal.phoneDialCode !== input.phoneDialCode ||
						clienteOriginal.phoneNationalNumber !== input.phoneNationalNumber ||
						(clienteOriginal.birthdayMonth ?? null) !== input.birthdayMonth;

					if (hayDiferencias) {
						// Mantener el modal abierto y mostrar confirmación
						setBusy(false);
						setMostrarConfirmacionCliente(true);
						return;
					}
				} else if (!clienteYaExistia) {
					// Nuevo paciente — auto-crear en clientes si no existe
					try {
						const found = await buscarClientes(input.documentNumber);
						const exacto = found.find((c) => c.documentNumber === input.documentNumber);
						if (!exacto) {
							const partes = input.patientFullName.trim().split(/\s+/);
							const apellidos = partes.length > 1 ? partes[partes.length - 1]! : "";
							const nombres = partes.length > 1 ? partes.slice(0, -1).join(" ") : partes[0] ?? input.patientFullName;
							await crearCliente({
								nombres,
								apellidos,
								documentType: input.documentType,
								documentNumber: input.documentNumber,
								phoneDialCode: input.phoneDialCode,
								phoneNationalNumber: input.phoneNationalNumber,
								email: "",
								birthdayMonth: input.birthdayMonth,
								notas: "",
							});
						}
					} catch {
						// La cita ya fue creada — ignorar error de cliente
					}
				}

				onSaved();
				onClose();
				return;
			}
			if (initial) {
				await updateAppointment(initial.id, input);
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

					{isPaidLocked ? (
						<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
							{readOnlyPast
								? "Esta cita tiene un pago registrado. No puede cambiar el estado de asistencia."
								: "Esta cita tiene un pago registrado. Estado, fecha, hora y servicio están bloqueados; puede actualizar datos de contacto del paciente."}
						</div>
					) : null}

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
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
									value={status}
									disabled={isPaidLocked}
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
							<div className="block text-sm font-medium text-slate-700">
								Nombre completo
								<div className="relative mt-1">
									<input
										className="w-full rounded border border-slate-300 px-2 py-2"
										value={patientFullName}
										onChange={(e) => {
											const val = e.target.value;
											setPatientFullName(val);
											setClienteYaExistia(false);
											if (debounceNombreRef.current) clearTimeout(debounceNombreRef.current);
											if (!val.trim()) { setSugerencias([]); setMostrarSugerencias(false); return; }
											debounceNombreRef.current = setTimeout(() => {
												buscarClientes(val.trim()).then((found) => {
													setSugerencias(found);
													setMostrarSugerencias(found.length > 0);
												}).catch(() => {});
											}, 200);
										}}
										onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
										required
										autoComplete="off"
									/>
									{mostrarSugerencias && sugerencias.length > 0 && (
										<div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
											{sugerencias.map((c) => (
												<button
													key={c.id}
													type="button"
													className="w-full px-3 py-2 text-left text-sm hover:bg-sky-50 border-b border-slate-100 last:border-0"
													onMouseDown={() => {
														setPatientFullName(`${c.nombres} ${c.apellidos}`);
														setDocumentType(c.documentType);
														setDocumentNumber(c.documentNumber);
														setPhoneDial(c.phoneDialCode || DEFAULT_COUNTRY_DIAL.dial);
														setPhoneNational(c.phoneNationalNumber);
														setBirthdayMonth(c.birthdayMonth != null ? String(c.birthdayMonth) : "");
														setClienteYaExistia(true);
														setClienteOriginal(c);
														setSugerencias([]);
														setMostrarSugerencias(false);
													}}
												>
													<span className="font-medium text-slate-800">
														{c.apellidos}, {c.nombres}
													</span>
													<span className="ml-2 text-xs text-slate-500">
														{c.documentType} {c.documentNumber}
													</span>
												</button>
											))}
										</div>
									)}
								</div>
							</div>

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
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
									value={appointmentDate}
									onChange={(e) => setAppointmentDate(e.target.value)}
									disabled={isPaidLocked}
									required
								/>
							</label>

							<div className="grid grid-cols-2 gap-2">
								<label className="block text-sm font-medium text-slate-700">
									Inicio
									<select
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
										value={startTime}
										onChange={(e) => setStartTime(e.target.value)}
										disabled={isPaidLocked}
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
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
										value={endTime}
										onChange={(e) => setEndTime(e.target.value)}
										disabled={isPaidLocked}
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
									className="mt-1 w-full rounded border border-slate-300 px-2 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
									value={serviceType}
									onChange={(e) => setServiceType(e.target.value)}
									disabled={isPaidLocked}
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
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
										value={status}
										onChange={(e) =>
											setStatus(e.target.value as AppointmentStatus)
										}
										disabled={isPaidLocked}
									>
										<option value="pendiente">Pendiente</option>
										<option value="asistio">Asistió</option>
										<option value="no_asistio">No asistió</option>
									</select>
								</label>
							)}
						</>
					)}

					{mostrarConfirmacionCliente && (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
							<p className="text-sm font-medium text-amber-900">
								✅ Cita guardada. Los datos del paciente fueron modificados.
							</p>
							<p className="text-sm text-amber-800">
								¿Desea actualizar también los datos del cliente en la base de datos?
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={guardandoCliente}
									onClick={() => void handleActualizarCliente()}
									className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
								>
									{guardandoCliente ? "Actualizando…" : "Sí, actualizar cliente"}
								</button>
								<button
									type="button"
									disabled={guardandoCliente}
									onClick={() => { onSaved(); onClose(); }}
									className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
								>
									No, solo la cita
								</button>
							</div>
						</div>
					)}

				<div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
						<button
							type="submit"
							disabled={busy || (readOnlyPast && isPaidLocked)}
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
