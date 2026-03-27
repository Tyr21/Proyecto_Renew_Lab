import { useEffect, useState } from "react";
import { saveSettings } from "../../core/api";
import { DEFAULT_SUGGESTED_PRICE_COP } from "../../core/constants";
import { formatCurrency, parseCurrencyDigits } from "../../core/currencyFormat";
import type { AppSettings, ServiceTypeSetting, TimeDisplay } from "../../core/types";

interface SettingsPanelProps {
	settings: AppSettings;
	onSettingsSaved: (s: AppSettings) => void;
}

const DEFAULT_NEW_SERVICE_CAPACITY = 1;

export function SettingsPanel({
	settings,
	onSettingsSaved,
}: SettingsPanelProps) {
	const [draft, setDraft] = useState<AppSettings>(settings);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setDraft(settings);
	}, [settings]);

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			const saved = await saveSettings(draft);
			onSettingsSaved(saved);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
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

				<button
					type="submit"
					disabled={busy}
					className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
				>
					Guardar configuración
				</button>
			</form>
		</div>
	);
}
