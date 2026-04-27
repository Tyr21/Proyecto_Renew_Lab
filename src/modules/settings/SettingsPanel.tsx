import { useCallback, useEffect, useRef, useState } from "react";
import { saveSettings, verifyAdminPassword } from "../../core/api";
import {
	DEFAULT_NEW_PACKAGE_PLAN_SESSION_COUNT,
	DEFAULT_SUGGESTED_PRICE_COP,
	defaultPackagePlanLabel,
} from "../../core/constants";
import { formatInvokeError } from "../../core/errors";
import { logger } from "../../core/logger";
import { AdminPasswordAdminSection } from "./AdminPasswordAdminSection";
import { BackupRestoreSection } from "./BackupRestoreSection";
import { StartupPasswordAdminSection } from "./StartupPasswordAdminSection";
import { formatCurrency, parseCurrencyDigits } from "../../core/currencyFormat";
import type {
	AppSettings,
	BackupSettings,
	BillingSettings,
	OxygenSettings,
	ServicePackagePlanSetting,
	ServiceTypeSetting,
	TimeDisplay,
} from "../../core/types";

interface SettingsPanelProps {
	settings: AppSettings;
	onSettingsSaved: (s: AppSettings) => void;
	onClose: () => void;
	/** Ref que App.tsx usa para preguntar si hay cambios sin guardar antes de cambiar de tab. */
	dirtyRef?: React.MutableRefObject<boolean>;
}

const DEFAULT_NEW_SERVICE_CAPACITY = 1;

type SettingsSectionId =
	| "calendario"
	| "documentos"
	| "servicios"
	| "facturacion"
	| "respaldos"
	| "oxigeno"
	| "administracion";

const SECTIONS: { id: SettingsSectionId; label: string; description: string }[] = [
	{ id: "calendario", label: "Calendario", description: "Vista semanal y citas" },
	{ id: "documentos", label: "Tipos de documento", description: "Lista y valor por defecto" },
	{ id: "servicios", label: "Tipos de servicio", description: "Capacidad y precios sugeridos" },
	{ id: "facturacion", label: "Facturación", description: "Datos del consultorio en facturas" },
	{ id: "respaldos", label: "Respaldos", description: "Copias automáticas de la base de datos" },
	{
		id: "oxigeno",
		label: "Oxígeno",
		description: "Consumo teórico por sesión de cámara hiperbárica",
	},
	{
		id: "administracion",
		label: "Administración",
		description: "Modo administrador y contraseñas de seguridad",
	},
];

export function SettingsPanel({
	settings,
	onSettingsSaved,
	onClose,
	dirtyRef,
}: SettingsPanelProps) {
	const [draft, setDraft] = useState<AppSettings>(settings);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [successToast, setSuccessToast] = useState(false);
	const savedSettingsRef = useRef<string>(JSON.stringify(settings));
	const [activeSection, setActiveSection] = useState<SettingsSectionId>("calendario");

	const [adminModeModalOpen, setAdminModeModalOpen] = useState(false);
	const [adminModePwd, setAdminModePwd] = useState("");
	const [adminModeErr, setAdminModeErr] = useState<string | null>(null);
	const [adminModeBusy, setAdminModeBusy] = useState(false);

	function openAdminModeToggle(target: boolean) {
		if (target === (draft.adminMode ?? false)) return;
		if (!target) {
			setDraft((d) => ({ ...d, adminMode: false }));
			return;
		}
		setAdminModePwd("");
		setAdminModeErr(null);
		setAdminModeModalOpen(true);
	}

	async function confirmAdminModeToggle() {
		setAdminModeErr(null);
		if (!adminModePwd.trim()) {
			setAdminModeErr("Introduzca la contraseña de administrador");
			return;
		}
		setAdminModeBusy(true);
		try {
			await verifyAdminPassword(adminModePwd);
			setDraft((d) => ({ ...d, adminMode: true }));
			setAdminModeModalOpen(false);
			setAdminModePwd("");
		} catch (e) {
			void logger.invokeError("settings.verifyAdminPassword", e);
			setAdminModeErr(formatInvokeError(e));
		} finally {
			setAdminModeBusy(false);
		}
	}

	useEffect(() => {
		setDraft(settings);
		savedSettingsRef.current = JSON.stringify(settings);
	}, [settings]);

	const isDirty = useCallback(() => {
		return JSON.stringify(draft) !== savedSettingsRef.current;
	}, [draft]);

	useEffect(() => {
		if (dirtyRef) {
			dirtyRef.current = isDirty();
		}
	}, [dirtyRef, isDirty]);

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			const saved = await saveSettings(draft);
			savedSettingsRef.current = JSON.stringify(saved);
			onSettingsSaved(saved);
			setSuccessToast(true);
			setTimeout(() => {
				setSuccessToast(false);
				onClose();
			}, 1500);
		} catch (err) {
			void logger.invokeError("settings.save", err);
			setError(formatInvokeError(err) || "No se pudo guardar la configuración");
		} finally {
			setBusy(false);
		}
	}

	function handleCancel() {
		if (isDirty()) {
			if (!window.confirm("Hay cambios sin guardar en la configuración. ¿Desea salir sin guardar?")) {
				return;
			}
		}
		setDraft(settings);
		onClose();
	}

	function updateDocumentTypes(text: string) {
		const parts = text
			.split(/[,;\n]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		setDraft((d) => ({ ...d, documentTypes: parts }));
	}

	function addService() {
		const id = `servicio_${Date.now()}`;
		const next: ServiceTypeSetting = {
			id,
			label: "Nuevo servicio",
			concurrentCapacity: DEFAULT_NEW_SERVICE_CAPACITY,
			suggestedPrice: DEFAULT_SUGGESTED_PRICE_COP,
			packagePlans: [],
		};
		setDraft((d) => ({ ...d, serviceTypes: [...d.serviceTypes, next] }));
	}

	function updateService(index: number, patch: Partial<ServiceTypeSetting>) {
		setDraft((d) => {
			const arr = [...d.serviceTypes];
			arr[index] = { ...arr[index]!, ...patch };
			return { ...d, serviceTypes: arr };
		});
	}

	function removeService(index: number) {
		setDraft((d) => ({
			...d,
			serviceTypes: d.serviceTypes.filter((_, i) => i !== index),
		}));
	}

	function addPackagePlan(serviceIndex: number) {
		const id =
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
		const sessionCount = DEFAULT_NEW_PACKAGE_PLAN_SESSION_COUNT;
		const blank: ServicePackagePlanSetting = {
			id,
			label: defaultPackagePlanLabel(sessionCount),
			sessionCount,
			priceBeforeVat: 0,
		};
		setDraft((d) => {
			const arr = [...d.serviceTypes];
			const s = arr[serviceIndex]!;
			const plans = [...(s.packagePlans ?? []), blank];
			arr[serviceIndex] = { ...s, packagePlans: plans };
			return { ...d, serviceTypes: arr };
		});
	}

	function updatePackagePlan(
		serviceIndex: number,
		planIndex: number,
		patch: Partial<ServicePackagePlanSetting>,
	) {
		setDraft((d) => {
			const arr = [...d.serviceTypes];
			const s = arr[serviceIndex]!;
			const plans = [...(s.packagePlans ?? [])];
			plans[planIndex] = { ...plans[planIndex]!, ...patch };
			arr[serviceIndex] = { ...s, packagePlans: plans };
			return { ...d, serviceTypes: arr };
		});
	}

	function removePackagePlan(serviceIndex: number, planIndex: number) {
		setDraft((d) => {
			const arr = [...d.serviceTypes];
			const s = arr[serviceIndex]!;
			const plans = (s.packagePlans ?? []).filter((_, i) => i !== planIndex);
			arr[serviceIndex] = { ...s, packagePlans: plans };
			return { ...d, serviceTypes: arr };
		});
	}

	function discountVsListPct(
		suggestedPrice: number,
		sessionCount: number,
		priceBeforeVat: number,
	): number | null {
		if (
			suggestedPrice <= 0 ||
			sessionCount < 1 ||
			priceBeforeVat <= 0 ||
			!Number.isFinite(suggestedPrice) ||
			!Number.isFinite(priceBeforeVat)
		) {
			return null;
		}
		const lista = suggestedPrice * sessionCount;
		if (lista <= 0) return null;
		return 100 * (1 - priceBeforeVat / lista);
	}

	function updateBilling(patch: Partial<BillingSettings>) {
		setDraft((d) => ({ ...d, billing: { ...d.billing, ...patch } }));
	}

	function updateBackup(patch: Partial<BackupSettings>) {
		setDraft((d) => ({ ...d, backup: { ...d.backup, ...patch } }));
	}

	function updateOxygen(patch: Partial<OxygenSettings>) {
		setDraft((d) => ({
			...d,
			oxygen: { ...d.oxygen, ...patch },
		}));
	}

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:flex-row md:items-start md:gap-8 md:p-6">
			<header className="md:hidden">
				<h1 className="text-xl font-semibold text-slate-800">Configuración</h1>
				<p className="mt-1 text-sm text-slate-600">
					Toda la configuración se guarda localmente en SQLite.
				</p>
			</header>

			<nav
				className="shrink-0 md:w-56"
				aria-label="Secciones de configuración"
			>
				<div className="hidden md:block md:sticky md:top-4">
					<h1 className="text-lg font-semibold text-slate-800">Configuración</h1>
					<p className="mt-1 text-xs text-slate-500">
						Datos locales en SQLite.
					</p>
					<ul className="mt-4 flex flex-col gap-1 border-b border-slate-200 pb-4 md:border-b-0 md:pb-0">
						{SECTIONS.map((s) => (
							<li key={s.id}>
								<button
									type="button"
									onClick={() => setActiveSection(s.id)}
									aria-current={activeSection === s.id ? "true" : undefined}
									className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
										activeSection === s.id
											? "bg-sky-100 font-medium text-sky-900"
											: "text-slate-700 hover:bg-slate-100"
									}`}
								>
									<span className="block">{s.label}</span>
									<span className="mt-0.5 block text-xs font-normal text-slate-500">
										{s.description}
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>

				<div className="md:hidden">
					<label className="sr-only" htmlFor="settings-section-select">
						Sección
					</label>
					<select
						id="settings-section-select"
						className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
						value={activeSection}
						onChange={(e) => setActiveSection(e.target.value as SettingsSectionId)}
					>
						{SECTIONS.map((s) => (
							<option key={s.id} value={s.id}>
								{s.label}
							</option>
						))}
					</select>
				</div>
			</nav>

			<div className="min-w-0 flex-1">
				<form onSubmit={handleSave} className="space-y-6">
					{error && (
						<div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
							{error}
						</div>
					)}

					{activeSection === "calendario" && (
						<section
							className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
							aria-labelledby="settings-calendario-heading"
						>
							<h2 id="settings-calendario-heading" className="text-base font-semibold text-slate-800">
								Calendario
							</h2>
							<p className="mt-1 text-xs text-slate-500">
								Afecta la vista semanal y los valores por defecto al crear citas.
							</p>

							<div className="mt-6 space-y-6">
								<div className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
									<h3 className="text-sm font-medium text-slate-700">Formato de hora</h3>
									<p className="mt-0.5 text-xs text-slate-500">
										Cómo se muestran las horas en el calendario y formularios.
									</p>
									<label className="mt-3 block text-sm">
										<span className="sr-only">Formato de hora</span>
										<select
											className="w-full max-w-xs rounded border border-slate-300 px-2 py-2"
											value={draft.timeDisplay}
											onChange={(e) =>
												setDraft((d) => ({
													...d,
													timeDisplay: e.target.value as TimeDisplay,
												}))
											}
										>
											<option value="12h">12 h (AM/PM)</option>
											<option value="24h">24 h</option>
										</select>
									</label>
								</div>

								<div className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
									<h3 className="text-sm font-medium text-slate-700">Duración por defecto</h3>
									<p className="mt-0.5 text-xs text-slate-500">
										Duración inicial al crear una cita nueva (múltiplo de 30 minutos).
									</p>
									<label className="mt-3 block text-sm">
										<span className="sr-only">Duración por defecto</span>
										<select
											className="w-full max-w-xs rounded border border-slate-300 px-2 py-2"
											value={draft.defaultDurationMinutes}
											onChange={(e) =>
												setDraft((d) => ({
													...d,
													defaultDurationMinutes: Number(e.target.value),
												}))
											}
										>
											{[30, 60, 90, 120, 150, 180].map((m) => (
												<option key={m} value={m}>
													{m} min
												</option>
											))}
										</select>
									</label>
								</div>

								<div>
									<h3 className="text-sm font-medium text-slate-700">Vista semanal</h3>
									<p className="mt-0.5 text-xs text-slate-500">
										Incluir o excluir el domingo en la cuadrícula del calendario.
									</p>
									<label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
										<input
											type="checkbox"
											checked={draft.showSundays}
											onChange={(e) =>
												setDraft((d) => ({ ...d, showSundays: e.target.checked }))
											}
										/>
										Mostrar domingos en la vista semanal
									</label>
								</div>
							</div>
						</section>
					)}

					{activeSection === "documentos" && (
						<section
							className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
							aria-labelledby="settings-documentos-heading"
						>
							<h2 id="settings-documentos-heading" className="text-base font-semibold text-slate-800">
								Tipos de documento
							</h2>
							<p className="mt-1 text-xs text-slate-500">
								Usados en citas y clientes. Debe existir al menos un tipo y el valor por defecto debe estar en la lista.
							</p>

							<div className="mt-6 space-y-6">
								<div className="border-b border-slate-100 pb-5">
									<h3 className="text-sm font-medium text-slate-700">Lista de tipos</h3>
									<p className="mt-0.5 text-xs text-slate-500">
										Separados por coma o salto de línea.
									</p>
									<textarea
										className="mt-3 w-full rounded border border-slate-300 px-2 py-2 font-mono text-sm"
										rows={4}
										value={draft.documentTypes.join(", ")}
										onChange={(e) => updateDocumentTypes(e.target.value)}
									/>
								</div>

								<div>
									<h3 className="text-sm font-medium text-slate-700">Tipo por defecto</h3>
									<p className="mt-0.5 text-xs text-slate-500">
										Se selecciona automáticamente en formularios nuevos.
									</p>
									<label className="mt-3 block text-sm">
										<span className="sr-only">Tipo por defecto</span>
										<select
											className="w-full max-w-xs rounded border border-slate-300 px-2 py-2"
											value={draft.defaultDocumentType}
											onChange={(e) =>
												setDraft((d) => ({
													...d,
													defaultDocumentType: e.target.value,
												}))
											}
										>
											{draft.documentTypes.map((t) => (
												<option key={t} value={t}>
													{t}
												</option>
											))}
										</select>
									</label>
								</div>
							</div>
						</section>
					)}

					{activeSection === "servicios" && (
						<section
							className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
							aria-labelledby="settings-servicios-heading"
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h2 id="settings-servicios-heading" className="text-base font-semibold text-slate-800">
										Tipos de servicio
									</h2>
									<p className="mt-1 text-xs text-slate-500">
										<code className="text-xs">id</code> estable para enlazar con citas; capacidad = citas concurrentes del mismo tipo. El precio sugerido se usa al registrar pagos tras completar una cita. Los planes de paquete definen precio total antes de IVA por cantidad de sesiones para la venta de prepagos.
									</p>
								</div>
								<button
									type="button"
									onClick={addService}
									className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
								>
									Añadir servicio
								</button>
							</div>

							<ul className="mt-6 space-y-4">
								{draft.serviceTypes.map((s, i) => (
									<li
										key={s.id}
										className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4"
									>
										<h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
											Servicio {i + 1}
										</h3>
										<div className="grid grid-cols-1 gap-2 md:grid-cols-12">
											<label className="md:col-span-3 text-sm">
												<span className="text-slate-600">Id</span>
												<input
													className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
													value={s.id}
													onChange={(e) =>
														updateService(i, { id: e.target.value.trim() })
													}
												/>
											</label>
											<label className="md:col-span-5 text-sm">
												<span className="text-slate-600">Etiqueta</span>
												<input
													className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
													value={s.label}
													onChange={(e) =>
														updateService(i, { label: e.target.value })
													}
												/>
											</label>
											<label className="md:col-span-2 text-sm">
												<span className="text-slate-600">Capacidad</span>
												<input
													type="number"
													min={1}
													className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
													value={s.concurrentCapacity}
													onChange={(e) =>
														updateService(i, {
															concurrentCapacity: Math.max(
																1,
																Number.parseInt(e.target.value, 10) || 1,
															),
														})
													}
												/>
											</label>
											<div className="md:col-span-2 flex items-end">
												<button
													type="button"
													onClick={() => removeService(i)}
													className="w-full rounded border border-red-200 py-1.5 text-sm text-red-700 hover:bg-red-50"
												>
													Quitar
												</button>
											</div>
										</div>
										<label className="block text-sm md:max-w-xs">
											<span className="text-slate-600">
												Precio sugerido (COP, 0 = sin sugerencia)
											</span>
											<input
												type="text"
												inputMode="numeric"
												autoComplete="off"
												className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
												value={
													s.suggestedPrice === 0
														? ""
														: formatCurrency(s.suggestedPrice)
												}
												onChange={(e) =>
													updateService(i, {
														suggestedPrice: parseCurrencyDigits(
															e.target.value,
														),
													})
												}
											/>
										</label>
										<div className="rounded-lg border border-slate-200 bg-white/80 p-3 space-y-2">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
													Planes de paquete (venta por volumen)
												</h4>
												<button
													type="button"
													onClick={() => addPackagePlan(i)}
													className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
												>
													Añadir plan
												</button>
											</div>
											<p className="text-[0.65rem] text-slate-500 leading-snug">
												Defina el precio total <strong>antes de IVA</strong> por el número de sesiones. En el modal de venta solo se elegirá el plan; el cobro se confirma después.
											</p>
											{(s.packagePlans ?? []).length === 0 ? (
												<p className="text-xs text-slate-400 italic">
													Sin planes. Añada uno para ofrecerlo al vender un paquete de este servicio.
												</p>
											) : (
												<ul className="space-y-3">
													{(s.packagePlans ?? []).map((p, pi) => {
														const dPct = discountVsListPct(
															s.suggestedPrice,
															p.sessionCount,
															p.priceBeforeVat,
														);
														return (
															<li
																key={p.id}
																className="rounded border border-slate-100 bg-slate-50/90 p-2 space-y-2"
															>
																<div className="flex flex-wrap items-end gap-2">
																	<label className="min-w-[8rem] flex-1 text-xs">
																		<span className="text-slate-600">Etiqueta</span>
																		<input
																			className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
																			value={p.label}
																			onChange={(e) =>
																				updatePackagePlan(i, pi, {
																					label: e.target.value,
																				})
																			}
																			placeholder="Ej. 10 sesiones · -10%"
																		/>
																	</label>
																	<label className="w-20 text-xs">
																		<span className="text-slate-600">Sesiones</span>
																		<input
																			type="number"
																			min={1}
																			className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
																			value={p.sessionCount}
																			onChange={(e) =>
																				updatePackagePlan(i, pi, {
																					sessionCount: Math.max(
																						1,
																						Number.parseInt(
																							e.target.value,
																							10,
																						) || 1,
																					),
																				})
																			}
																		/>
																	</label>
																	<label className="min-w-[9rem] flex-1 text-xs">
																		<span className="text-slate-600">
																			Total antes IVA (COP)
																		</span>
																		<input
																			type="text"
																			inputMode="numeric"
																			autoComplete="off"
																			className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm tabular-nums"
																			value={
																				p.priceBeforeVat === 0
																					? ""
																					: formatCurrency(p.priceBeforeVat)
																			}
																			onChange={(e) =>
																				updatePackagePlan(i, pi, {
																					priceBeforeVat: parseCurrencyDigits(
																						e.target.value,
																					),
																				})
																			}
																		/>
																	</label>
																	<button
																		type="button"
																		onClick={() => removePackagePlan(i, pi)}
																		className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
																	>
																		Quitar
																	</button>
																</div>
																{dPct !== null && dPct > 0.009 ? (
																	<p className="text-[0.65rem] text-slate-500">
																		≈ {dPct.toFixed(1)}% menos vs.{" "}
																		{formatCurrency(s.suggestedPrice)} ×{" "}
																		{p.sessionCount} sesiones
																	</p>
																) : dPct !== null && dPct <= 0.009 ? (
																	<p className="text-[0.65rem] text-slate-500">
																		Alineado con precio lista × sesiones
																	</p>
																) : null}
															</li>
														);
													})}
												</ul>
											)}
										</div>
									</li>
								))}
							</ul>
						</section>
					)}

					{activeSection === "facturacion" && (
						<section
							className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
							aria-labelledby="settings-facturacion-heading"
						>
							<h2 id="settings-facturacion-heading" className="text-base font-semibold text-slate-800">
								Facturación
							</h2>
							<p className="mt-1 text-xs text-slate-500">
								Datos del consultorio en documentos de venta. La serie y el IVA por defecto se aplican al crear nuevas facturas.
							</p>

							<div className="mt-6 space-y-6">
								<div>
									<h3 className="text-sm font-medium text-slate-700">Datos del consultorio</h3>
									<div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
										<label className="block text-sm">
											<span className="font-medium text-slate-700">Razón social</span>
											<input
												className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
												value={draft.billing?.razonSocial ?? ""}
												onChange={(e) => updateBilling({ razonSocial: e.target.value })}
											/>
										</label>
										<label className="block text-sm">
											<span className="font-medium text-slate-700">NIT</span>
											<input
												className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
												value={draft.billing?.nit ?? ""}
												onChange={(e) => updateBilling({ nit: e.target.value })}
											/>
										</label>
										<label className="block text-sm">
											<span className="font-medium text-slate-700">Dirección</span>
											<input
												className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
												value={draft.billing?.direccion ?? ""}
												onChange={(e) => updateBilling({ direccion: e.target.value })}
											/>
										</label>
										<label className="block text-sm">
											<span className="font-medium text-slate-700">Teléfono</span>
											<input
												className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
												value={draft.billing?.telefono ?? ""}
												onChange={(e) => updateBilling({ telefono: e.target.value })}
											/>
										</label>
									</div>
								</div>

								<div className="border-t border-slate-100 pt-5">
									<h3 className="text-sm font-medium text-slate-700">Valores por defecto en facturas</h3>
									<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
										<label className="block text-sm">
											<span className="font-medium text-slate-700">Serie / prefijo</span>
											<input
												className="mt-1 w-full max-w-[120px] rounded border border-slate-300 px-2 py-2 text-sm font-mono"
												value={draft.billing?.serieDefault ?? "FV"}
												onChange={(e) =>
													updateBilling({ serieDefault: e.target.value.toUpperCase().trim() })
												}
											/>
										</label>
										<label className="block text-sm">
											<span className="font-medium text-slate-700">IVA por defecto (%)</span>
											<input
												type="number"
												min={0}
												max={100}
												step="0.01"
												className="mt-1 w-full max-w-[120px] rounded border border-slate-300 px-2 py-2 text-sm tabular-nums"
												value={draft.billing?.ivaDefaultPct ?? 19}
												onChange={(e) =>
													updateBilling({ ivaDefaultPct: Math.max(0, Number(e.target.value) || 0) })
												}
											/>
										</label>
									</div>
								</div>
							</div>
						</section>
					)}

					{activeSection === "oxigeno" && (
						<section
							className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
							aria-labelledby="settings-oxigeno-heading"
						>
							<h2 id="settings-oxigeno-heading" className="text-base font-semibold text-slate-800">
								Oxígeno (cámara hiperbárica)
							</h2>
							<p className="mt-1 text-xs text-slate-500">
								Estos valores alimentan el resumen en cierre de caja y el registro diario de lecturas. El consumo teórico del día es sesiones atendidas (estado “asistió”) del tipo de servicio elegido, multiplicado por la cantidad indicada.
							</p>
							<div className="mt-6 space-y-5">
								<label className="block text-sm md:max-w-md">
									<span className="font-medium text-slate-700">Etiqueta de unidad</span>
									<input
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
										placeholder="m³, unidades, bar…"
										value={draft.oxygen?.unitsLabel ?? ""}
										onChange={(e) => updateOxygen({ unitsLabel: e.target.value })}
									/>
								</label>
								<label className="block text-sm md:max-w-xs">
									<span className="font-medium text-slate-700">
										Consumo teórico por sesión (K)
									</span>
									<input
										type="number"
										min={0}
										step="any"
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm tabular-nums"
										value={draft.oxygen?.perHyperbaricSession ?? 1}
										onChange={(e) =>
											updateOxygen({
												perHyperbaricSession: Math.max(
													0,
													Number.parseFloat(e.target.value) || 0,
												),
											})
										}
									/>
								</label>
								<label className="block text-sm md:max-w-md">
									<span className="font-medium text-slate-700">
										Tipo de servicio para contar sesiones
									</span>
									<select
										className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
										value={draft.oxygen?.serviceTypeId ?? "camara_hiperbarica"}
										onChange={(e) => updateOxygen({ serviceTypeId: e.target.value })}
									>
										{draft.serviceTypes.map((s) => (
											<option key={s.id} value={s.id}>
												{s.label} ({s.id})
											</option>
										))}
									</select>
								</label>
							</div>
						</section>
					)}

					{activeSection === "respaldos" && (
						<section
							className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
							aria-labelledby="settings-respaldos-heading"
						>
							<h2 id="settings-respaldos-heading" className="text-base font-semibold text-slate-800">
								Respaldos automáticos
							</h2>
							<p className="mt-1 text-xs text-slate-500">
								Al iniciar la aplicación se copia la base de datos en la carpeta local de respaldos. Si configura una carpeta externa (por ejemplo sincronizada con la nube), también se guardará allí.
							</p>

							<div className="mt-6 space-y-6">
								<div>
									<h3 className="text-sm font-medium text-slate-700">Activación</h3>
									<label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
										<input
											type="checkbox"
											checked={draft.backup?.enabled ?? true}
											onChange={(e) => updateBackup({ enabled: e.target.checked })}
										/>
										Respaldos automáticos activados
									</label>
								</div>

								<div className="border-t border-slate-100 pt-5">
									<h3 className="text-sm font-medium text-slate-700">Retención</h3>
									<p className="mt-0.5 text-xs text-slate-500">
										Número de copias recientes que se conservan en cada ubicación.
									</p>
									<label className="mt-3 block text-sm">
										<span className="font-medium text-slate-700">Cantidad de respaldos a conservar</span>
										<input
											type="number"
											min={1}
											max={90}
											className="mt-1 w-full max-w-[120px] rounded border border-slate-300 px-2 py-2 text-sm"
											value={draft.backup?.retentionCount ?? 7}
											onChange={(e) =>
												updateBackup({ retentionCount: Math.max(1, Math.min(90, Number(e.target.value) || 7)) })
											}
											disabled={!draft.backup?.enabled}
										/>
									</label>
								</div>

								<div className="border-t border-slate-100 pt-5">
									<h3 className="text-sm font-medium text-slate-700">Carpeta externa (opcional)</h3>
									<p className="mt-0.5 text-xs text-slate-500">
										Ruta absoluta a una carpeta adicional, por ejemplo una sincronizada con OneDrive, Google Drive o Dropbox.
									</p>
									<label className="mt-3 block text-sm">
										<span className="sr-only">Carpeta externa</span>
										<input
											className="w-full rounded border border-slate-300 px-2 py-2 text-sm font-mono"
											placeholder="C:\Users\...\OneDrive\Backups\RenewLab"
											value={draft.backup?.externalPath ?? ""}
											onChange={(e) => updateBackup({ externalPath: e.target.value })}
											disabled={!draft.backup?.enabled}
										/>
									</label>
								</div>

								<BackupRestoreSection adminModeActive={draft.adminMode ?? false} />
							</div>
						</section>
					)}

					{activeSection === "administracion" && (
						<section
							className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm md:p-5"
							aria-labelledby="settings-admin-heading"
						>
							<h2 id="settings-admin-heading" className="text-base font-semibold text-amber-800">
								Administración
							</h2>
							<p className="mt-1 text-xs text-amber-700/90">
								El modo administrador permite operaciones destructivas que requieren cuidado.
							</p>

							<div className="mt-6">
								<h3 className="text-sm font-medium text-amber-900">Modo administrador</h3>
								<label className="mt-3 flex items-start gap-2 text-sm text-amber-900">
									<input
										type="checkbox"
										className="mt-0.5"
										checked={draft.adminMode ?? false}
										onChange={() =>
											openAdminModeToggle(!(draft.adminMode ?? false))
										}
									/>
									<span>
										<span className="font-medium">Activar modo administrador</span>
										<span className="mt-1 block text-amber-800/95">
											Permite eliminar citas pasadas, ingresos, clientes y anular facturas según las reglas de la aplicación. Al marcar la casilla se pide la contraseña de administrador; al desmarcarla no.
										</span>
									</span>
								</label>
							</div>

							<StartupPasswordAdminSection adminModeActive={draft.adminMode ?? false} />
							{(draft.adminMode ?? false) ? <AdminPasswordAdminSection /> : null}
						</section>
					)}

					<div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
						<button
							type="submit"
							disabled={busy}
							className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
						>
							{busy ? "Guardando…" : "Guardar configuración"}
						</button>
						<button
							type="button"
							onClick={handleCancel}
							disabled={busy}
							className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							Cancelar
						</button>
					</div>
				</form>
			</div>

			{successToast ? (
				<div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
					Configuración guardada correctamente
				</div>
			) : null}

			{adminModeModalOpen ? (
				<div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
					<div
						className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="admin-mode-verify-title"
					>
						<h2 id="admin-mode-verify-title" className="text-base font-semibold text-slate-800">
							Contraseña de administrador
						</h2>
						<p className="mt-2 text-sm text-slate-600">
							Introduzca la contraseña de administrador para activar el modo
							administrador.
						</p>
						{adminModeErr ? (
							<div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{adminModeErr}</div>
						) : null}
						<label className="mt-4 block text-sm">
							<span className="font-medium text-slate-700">Contraseña</span>
							<input
								type="password"
								autoComplete="current-password"
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={adminModePwd}
								onChange={(e) => setAdminModePwd(e.target.value)}
								autoFocus
							/>
						</label>
						<div className="mt-5 flex flex-wrap gap-2">
							<button
								type="button"
								disabled={adminModeBusy}
								onClick={() => void confirmAdminModeToggle()}
								className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
							>
								{adminModeBusy ? "Comprobando…" : "Confirmar"}
							</button>
							<button
								type="button"
								disabled={adminModeBusy}
								onClick={() => {
									setAdminModeModalOpen(false);
									setAdminModePwd("");
									setAdminModeErr(null);
								}}
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Cancelar
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
