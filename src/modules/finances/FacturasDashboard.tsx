import { useCallback, useEffect, useMemo, useState } from "react";
import { anularFactura, listarFacturas } from "../../core/api";
import { FACTURA_CHANGED_EVENT } from "../../core/constants";
import { formatCurrency } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import type { AppSettings, Factura, FacturaEstado } from "../../core/types";
import { addDays, startOfWeekMonday, toISODateLocal } from "../../core/weekUtils";
import { FacturaEditor } from "./FacturaEditor";

interface FacturasDashboardProps {
	settings: AppSettings;
}

const ESTADO_BADGE: Record<FacturaEstado, string> = {
	borrador: "bg-amber-100 text-amber-800",
	emitida: "bg-emerald-100 text-emerald-800",
	anulada: "bg-red-100 text-red-800",
};

export function FacturasDashboard({ settings }: FacturasDashboardProps) {
	const today = toISODateLocal(new Date());
	const [dateFrom, setDateFrom] = useState(today);
	const [dateTo, setDateTo] = useState(today);
	const [filtroEstado, setFiltroEstado] = useState<string>("");
	const [facturas, setFacturas] = useState<Factura[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [editorOpen, setEditorOpen] = useState(false);
	const [editingFactura, setEditingFactura] = useState<Factura | null>(null);

	const loadFacturas = useCallback(async () => {
		setError(null);
		setLoading(true);
		try {
			const list = await listarFacturas(dateFrom, dateTo, filtroEstado || undefined);
			setFacturas(list);
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudieron cargar las facturas");
		} finally {
			setLoading(false);
		}
	}, [dateFrom, dateTo, filtroEstado]);

	useEffect(() => {
		void loadFacturas();
		const onChange = () => { void loadFacturas(); };
		window.addEventListener(FACTURA_CHANGED_EVENT, onChange);
		return () => window.removeEventListener(FACTURA_CHANGED_EVENT, onChange);
	}, [loadFacturas]);

	const totals = useMemo(() => {
		let emitidas = 0;
		let borradores = 0;
		let anuladas = 0;
		for (const f of facturas) {
			if (f.estado === "emitida") emitidas += f.total;
			else if (f.estado === "borrador") borradores += f.total;
			else anuladas += f.total;
		}
		return { emitidas, borradores, anuladas };
	}, [facturas]);

	function openNew() {
		setEditingFactura(null);
		setEditorOpen(true);
	}

	function openView(f: Factura) {
		setEditingFactura(f);
		setEditorOpen(true);
	}

	async function handleAnular(f: Factura) {
		const motivo = window.prompt("Motivo de anulación:");
		if (!motivo?.trim()) return;
		try {
			await anularFactura(f.id, motivo);
			window.dispatchEvent(new CustomEvent(FACTURA_CHANGED_EVENT));
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudo anular");
		}
	}

	function setHoy() {
		const t = toISODateLocal(new Date());
		setDateFrom(t);
		setDateTo(t);
	}
	function setEstaSemana() {
		const lunes = startOfWeekMonday(new Date());
		setDateFrom(toISODateLocal(lunes));
		setDateTo(toISODateLocal(addDays(lunes, 6)));
	}
	function setEsteMes() {
		const now = new Date();
		setDateFrom(toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1)));
		setDateTo(toISODateLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
	}

	return (
		<>
			<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
				<div className="mx-auto max-w-6xl space-y-6">
					<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h1 className="text-xl font-semibold text-slate-800">Facturas</h1>
							<p className="mt-1 text-sm text-slate-600">
								{dateFrom === dateTo
									? "Facturas del día seleccionado."
									: `Facturas del ${dateFrom} al ${dateTo}.`}
							</p>
						</div>
						<div className="flex flex-col gap-2">
							<div className="flex gap-1 flex-wrap">
								<button type="button" onClick={setHoy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm">Hoy</button>
								<button type="button" onClick={setEstaSemana} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm">Esta semana</button>
								<button type="button" onClick={setEsteMes} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm">Este mes</button>
								<select
									className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm"
									value={filtroEstado}
									onChange={(e) => setFiltroEstado(e.target.value)}
								>
									<option value="">Todos los estados</option>
									<option value="borrador">Borradores</option>
									<option value="emitida">Emitidas</option>
									<option value="anulada">Anuladas</option>
								</select>
								<button
									type="button"
									onClick={openNew}
									className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 shadow-sm"
								>
									+ Nueva factura
								</button>
							</div>
							<div className="flex gap-2 items-end">
								<label className="flex flex-col gap-1 text-sm">
									<span className="font-medium text-slate-700">Desde</span>
									<input
										type="date"
										className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm"
										value={dateFrom}
										onChange={(e) => setDateFrom(e.target.value)}
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm">
									<span className="font-medium text-slate-700">Hasta</span>
									<input
										type="date"
										className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm"
										value={dateTo}
										onChange={(e) => setDateTo(e.target.value)}
									/>
								</label>
							</div>
						</div>
					</header>

					{error ? (
						<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
							{error}
						</div>
					) : null}

					{/* Tarjetas resumen */}
					<section className="grid grid-cols-1 gap-4 md:grid-cols-3">
						<div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
							<p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Emitidas</p>
							<p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">
								{loading ? "…" : formatCurrency(totals.emitidas)}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
							<p className="text-xs font-medium uppercase tracking-wide text-amber-700">Borradores</p>
							<p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
								{loading ? "…" : formatCurrency(totals.borradores)}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
							<p className="text-xs font-medium uppercase tracking-wide text-red-700">Anuladas</p>
							<p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
								{loading ? "…" : formatCurrency(totals.anuladas)}
							</p>
						</div>
					</section>

					{/* Tabla */}
					<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
						<div className="border-b border-slate-200 px-4 py-3">
							<h2 className="text-sm font-medium text-slate-800">Listado</h2>
							<p className="text-xs text-slate-500">{facturas.length} factura{facturas.length === 1 ? "" : "s"}</p>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[700px] text-left text-sm">
								<thead>
									<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
										<th className="px-4 py-3 font-medium">Número</th>
										<th className="px-4 py-3 font-medium">Estado</th>
										<th className="px-4 py-3 font-medium">Cliente</th>
										<th className="px-4 py-3 font-medium">Documento</th>
										<th className="px-4 py-3 font-medium text-right">Total</th>
										<th className="px-4 py-3 font-medium">Fecha</th>
										<th className="px-4 py-3 font-medium" />
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando…</td>
										</tr>
									) : facturas.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-4 py-8 text-center text-slate-500">
												No hay facturas en este período.
											</td>
										</tr>
									) : (
										facturas.map((f) => (
											<tr
												key={f.id}
												className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 cursor-pointer"
												onClick={() => openView(f)}
											>
												<td className="px-4 py-3 tabular-nums text-slate-800">
													{f.numero ? `${f.serie}-${f.numero}` : <span className="italic text-slate-400">—</span>}
												</td>
												<td className="px-4 py-3">
													<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE[f.estado]}`}>
														{f.estado}
													</span>
												</td>
												<td className="px-4 py-3 text-slate-800">{f.clienteNombre}</td>
												<td className="px-4 py-3 text-slate-800">{f.clienteDocumentoNumero}</td>
												<td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
													{formatCurrency(f.total)}
												</td>
												<td className="px-4 py-3 text-slate-700 tabular-nums">
													{f.fechaEmision?.slice(0, 10) ?? f.createdAt.slice(0, 10)}
												</td>
												<td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
													{f.estado === "emitida" && settings.adminMode ? (
														<button
															type="button"
															onClick={() => void handleAnular(f)}
															className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
														>
															Anular
														</button>
													) : null}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			</div>

			{editorOpen ? (
				<FacturaEditor
					settings={settings}
					factura={editingFactura}
					onClose={() => setEditorOpen(false)}
				/>
			) : null}
		</>
	);
}
