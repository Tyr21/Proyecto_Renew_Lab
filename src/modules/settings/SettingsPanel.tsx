import { useCallback, useEffect, useRef, useState } from "react";
import { saveSettings } from "../../core/api";
import { DEFAULT_SUGGESTED_PRICE_COP } from "../../core/constants";
import { formatCurrency, parseCurrencyDigits } from "../../core/currencyFormat";
import type { AppSettings, BackupSettings, BillingSettings, ServiceTypeSetting, TimeDisplay } from "../../core/types";

interface SettingsPanelProps {
	settings: AppSettings;
	onSettingsSaved: (s: AppSettings) => void;
	onClose: () => void;
	/** Ref que App.tsx usa para preguntar si hay cambios sin guardar antes de cambiar de tab. */
	dirtyRef?: React.MutableRefObject<boolean>;
}

const DEFAULT_NEW_SERVICE_CAPACITY = 1;

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
			setError(err instanceof Error ? err.message : String(err));
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

	function updateBilling(patch: Partial<BillingSettings>) {
		setDraft((d) => ({ ...d, billing: { ...d.billing, ...patch } }));
	}

	function updateBackup(patch: Partial<BackupSettings>) {
		setDraft((d) => ({ ...d, backup: { ...d.backup, ...patch } }));
	}

	return (
		<div className="mx-auto max-w-2xl p-6">
			<h1 className="text-xl font-semibold text-slate-800">
				Configuración
			</h1>
			<p className="mt-1 text-sm text-slate-600">
				Toda la configuración se guarda localmente en SQLite.
			</p>

			<form onSubmit={handleSave} className="mt-6 space-y-6">
				{error && (
					<div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
						{error}
					</div>
				)}

				<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
					<h2 className="font-medium text-slate-800">Calendario</h2>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={draft.showSundays}
							onChange={(e) =>
								setDraft((d) => ({ ...d, showSundays: e.target.checked }))
							}
						/>
						Mostrar domingos en la vista semanal
					</label>
					<label className="block text-sm">
						<span className="font-medium text-slate-700">Formato de hora</span>
						<select
							className="mt-1 w-full max-w-xs rounded border border-slate-300 px-2 py-2"
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
					<label className="block text-sm">
						<span className="font-medium text-slate-700">
							Duración por defecto de citas (minutos, múltiplo de 30)
						</span>
						<select
							className="mt-1 w-full max-w-xs rounded border border-slate-300 px-2 py-2"
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
				</section>

				<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
					<h2 className="font-medium text-slate-800">Tipos de documento</h2>
					<p className="text-xs text-slate-500">
						Separados por coma o salto de línea. Debe incluir el valor por
						defecto.
					</p>
					<textarea
						className="w-full rounded border border-slate-300 px-2 py-2 font-mono text-sm"
						rows={3}
						value={draft.documentTypes.join(", ")}
						onChange={(e) => updateDocumentTypes(e.target.value)}
					/>
					<label className="block text-sm">
						<span className="font-medium text-slate-700">Por defecto</span>
						<select
							className="mt-1 w-full max-w-xs rounded border border-slate-300 px-2 py-2"
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
				</section>

				<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
					<div className="flex items-center justify-between gap-2">
						<h2 className="font-medium text-slate-800">Tipos de servicio</h2>
						<button
							type="button"
							onClick={addService}
							className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
						>
							Añadir servicio
						</button>
					</div>
					<p className="text-xs text-slate-500">
						<code className="text-xs">id</code> interno estable (inventario
						futuro); capacidad = citas concurrentes del mismo tipo. El precio
						sugerido se usa al registrar pagos tras completar una cita.
					</p>
					<ul className="space-y-3">
						{draft.serviceTypes.map((s, i) => (
							<li
								key={s.id}
								className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
							>
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
							</li>
						))}
					</ul>
				</section>

				<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
					<h2 className="font-medium text-slate-800">Facturación</h2>
					<p className="text-xs text-slate-500">
						Datos del consultorio para documentos de venta. La serie y el IVA
						por defecto se usan al crear nuevas facturas.
					</p>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
				</section>

				<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
					<h2 className="font-medium text-slate-800">Respaldos automáticos</h2>
					<p className="text-xs text-slate-500">
						Al iniciar la aplicación se copia la base de datos en la carpeta local de respaldos.
						Si configura una carpeta externa (puede ser una sincronizada con la nube), también se guardará allí.
					</p>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={draft.backup?.enabled ?? true}
							onChange={(e) => updateBackup({ enabled: e.target.checked })}
						/>
						Respaldos automáticos activados
					</label>
					<label className="block text-sm">
						<span className="font-medium text-slate-700">
							Cantidad de respaldos a conservar
						</span>
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
					<label className="block text-sm">
						<span className="font-medium text-slate-700">
							Carpeta externa (opcional)
						</span>
						<p className="text-xs text-slate-400 mb-1">
							Ruta absoluta a una carpeta adicional, por ejemplo una sincronizada con OneDrive, Google Drive o Dropbox.
						</p>
						<input
							className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-mono"
							placeholder="C:\Users\...\OneDrive\Backups\RenewLab"
							value={draft.backup?.externalPath ?? ""}
							onChange={(e) => updateBackup({ externalPath: e.target.value })}
							disabled={!draft.backup?.enabled}
						/>
					</label>
				</section>

				<section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm space-y-3">
					<h2 className="font-medium text-amber-800">Administración</h2>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={draft.adminMode ?? false}
							onChange={(e) =>
								setDraft((d) => ({ ...d, adminMode: e.target.checked }))
							}
						/>
						<span>
							<span className="font-medium text-amber-900">Modo Administrador</span>
							<span className="ml-1 text-amber-700">— permite eliminar citas pasadas</span>
						</span>
					</label>
				</section>

			<div className="flex gap-3">
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

		{successToast ? (
			<div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
				Configuración guardada correctamente
			</div>
		) : null}
	</div>
);
}
