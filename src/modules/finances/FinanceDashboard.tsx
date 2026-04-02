import { useCallback, useEffect, useMemo, useState } from "react";
import { eliminarIngreso, obtenerIngresos } from "../../core/api";
import { INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import { fechaIngresoLocalISODate, formatHoraPago } from "../../core/ingresoDate";
import type { Ingreso } from "../../core/types";
import { addDays, startOfWeekMonday, toISODateLocal } from "../../core/weekUtils";

interface FinanceDashboardProps {
	adminMode?: boolean;
}

function generarCSV(rows: Ingreso[]): string {
	const encabezado = ["Fecha", "Hora", "Paciente", "Documento", "Concepto", "Metodo", "Monto"].join(",");
	const lineas = rows.map((r) => {
		const fecha = fechaIngresoLocalISODate(r.fechaPago);
		const hora = formatHoraPago(r.fechaPago);
		const nombre = `"${r.pacienteNombre.replace(/"/g, '""')}"`;
		const doc = `"${r.pacienteDocumento.replace(/"/g, '""')}"`;
		const concepto = `"${r.concepto.replace(/"/g, '""')}"`;
		const metodo = r.metodoPago;
		const monto = r.monto.toFixed(0);
		return [fecha, hora, nombre, doc, concepto, metodo, monto].join(",");
	});
	return [encabezado, ...lineas].join("\r\n");
}

function sumByMethod(rows: Ingreso[]): {
	efectivo: number;
	bancos: number;
	total: number;
} {
	let efectivo = 0;
	let bancos = 0;
	let total = 0;
	for (const r of rows) {
		const m = r.monto;
		if (!Number.isFinite(m)) continue;
		total += m;
		if (r.metodoPago === "Efectivo") {
			efectivo += m;
		} else if (
			r.metodoPago === "Tarjeta" ||
			r.metodoPago === "Transferencia"
		) {
			bancos += m;
		}
	}
	return { efectivo, bancos, total };
}

export function FinanceDashboard({ adminMode = false }: FinanceDashboardProps) {
	const today = toISODateLocal(new Date());
	const [dateFrom, setDateFrom] = useState(today);
	const [dateTo, setDateTo] = useState(today);
	const [allIngresos, setAllIngresos] = useState<Ingreso[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const loadIngresos = useCallback(async () => {
		setError(null);
		setLoading(true);
		try {
			const list = await obtenerIngresos();
			setAllIngresos(list);
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudieron cargar los ingresos");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadIngresos();
		const onIngreso = () => { void loadIngresos(); };
		window.addEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
		return () => window.removeEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
	}, [loadIngresos]);

	const rowsEnRango = useMemo(() => {
		return allIngresos
			.filter((i) => {
				const d = fechaIngresoLocalISODate(i.fechaPago);
				return d >= dateFrom && d <= dateTo;
			})
			.sort((a, b) => b.fechaPago.localeCompare(a.fechaPago));
	}, [allIngresos, dateFrom, dateTo]);

	const totals = useMemo(() => sumByMethod(rowsEnRango), [rowsEnRango]);

	const reportePorServicio = useMemo(() => {
		const mapa = new Map<string, { total: number; cantidad: number }>();
		for (const r of rowsEnRango) {
			const clave = r.concepto.trim() || "(sin concepto)";
			const prev = mapa.get(clave) ?? { total: 0, cantidad: 0 };
			mapa.set(clave, { total: prev.total + r.monto, cantidad: prev.cantidad + 1 });
		}
		return Array.from(mapa.entries())
			.map(([concepto, datos]) => ({ concepto, ...datos }))
			.sort((a, b) => b.total - a.total);
	}, [rowsEnRango]);

	const handleDelete = useCallback(async (id: string) => {
		if (!window.confirm("¿Confirmar eliminación del ingreso?")) return;
		setDeletingId(id);
		try {
			await eliminarIngreso(id);
			await loadIngresos();
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudo eliminar el ingreso");
		} finally {
			setDeletingId(null);
		}
	}, [loadIngresos]);

	const handleExportCSV = useCallback(() => {
		if (rowsEnRango.length === 0) return;
		const csv = generarCSV(rowsEnRango);
		const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		const label = dateFrom === dateTo ? dateFrom : `${dateFrom}_${dateTo}`;
		a.download = `ingresos_${label}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [rowsEnRango, dateFrom, dateTo]);

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
		const first = new Date(now.getFullYear(), now.getMonth(), 1);
		const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		setDateFrom(toISODateLocal(first));
		setDateTo(toISODateLocal(last));
	}

	const colSpan = adminMode ? 7 : 6;

	return (
		<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold text-slate-800">
							Cierre de caja / Ingresos
						</h1>
						<p className="mt-1 text-sm text-slate-600">
							{dateFrom === dateTo
								? "Ingresos del día seleccionado."
								: `Ingresos del ${dateFrom} al ${dateTo}.`}
						</p>
					</div>
					<div className="flex flex-col gap-2">
						{/* Botones rápidos */}
						<div className="flex gap-1">
							<button
								type="button"
								onClick={setHoy}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
							>
								Hoy
							</button>
							<button
								type="button"
								onClick={setEstaSemana}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
							>
								Esta semana
							</button>
							<button
								type="button"
								onClick={setEsteMes}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
							>
								Este mes
							</button>
							<button
								type="button"
								onClick={handleExportCSV}
								disabled={rowsEnRango.length === 0 || loading}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
							>
								Exportar CSV
							</button>
						</div>
						{/* Inputs de rango */}
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
					<div
						className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
						role="alert"
					>
						{error}
					</div>
				) : null}

				{/* Tarjetas de totales */}
				<section className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
							Total efectivo
						</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
							{loading ? "…" : formatCurrency(totals.efectivo)}
						</p>
					</div>
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
							Total bancos
						</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
							{loading ? "…" : formatCurrency(totals.bancos)}
						</p>
						<p className="mt-1 text-xs text-slate-500">
							Tarjeta y transferencia
						</p>
					</div>
					<div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
						<p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
							{dateFrom === dateTo ? "Total del día" : "Total del rango"}
						</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">
							{loading ? "…" : formatCurrency(totals.total)}
						</p>
					</div>
				</section>

				{/* Reporte por servicio */}
				{reportePorServicio.length > 0 ? (
					<section>
						<h2 className="mb-3 text-sm font-medium text-slate-700">
							Resumen por servicio
						</h2>
						<div className="flex flex-wrap gap-3">
							{reportePorServicio.map(({ concepto, total, cantidad }) => (
								<div
									key={concepto}
									className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-[180px]"
								>
									<p
										className="text-xs font-medium text-slate-500 truncate"
										title={concepto}
									>
										{concepto}
									</p>
									<p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
										{formatCurrency(total)}
									</p>
									<p className="mt-1 text-xs text-slate-500">
										{cantidad} ingreso{cantidad === 1 ? "" : "s"}
									</p>
								</div>
							))}
						</div>
					</section>
				) : null}

				{/* Tabla de detalle */}
				<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-sm font-medium text-slate-800">
							Detalle del período
						</h2>
						<p className="text-xs text-slate-500">
							{rowsEnRango.length} movimiento
							{rowsEnRango.length === 1 ? "" : "s"}
						</p>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-left text-sm">
							<thead>
								<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
									<th className="px-4 py-3 font-medium">Hora</th>
									<th className="px-4 py-3 font-medium">Paciente</th>
									<th className="px-4 py-3 font-medium">Documento</th>
									<th className="px-4 py-3 font-medium">Concepto</th>
									<th className="px-4 py-3 font-medium">Método</th>
									<th className="px-4 py-3 font-medium text-right">Monto</th>
									{adminMode ? <th className="px-4 py-3 font-medium" /> : null}
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td
											colSpan={colSpan}
											className="px-4 py-8 text-center text-slate-500"
										>
											Cargando…
										</td>
									</tr>
								) : rowsEnRango.length === 0 ? (
									<tr>
										<td
											colSpan={colSpan}
											className="px-4 py-8 text-center text-slate-500"
										>
											No hay ingresos para este período.
										</td>
									</tr>
								) : (
									rowsEnRango.map((row) => (
										<tr
											key={row.id}
											className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
										>
											<td className="px-4 py-3 tabular-nums text-slate-800">
												{formatHoraPago(row.fechaPago)}
											</td>
											<td className="px-4 py-3 text-slate-800">
												{row.pacienteNombre || <span className="text-slate-400 italic">—</span>}
											</td>
											<td className="px-4 py-3 text-slate-800">
												{row.pacienteDocumento}
											</td>
											<td className="px-4 py-3 text-slate-800">
												{row.concepto}
											</td>
											<td className="px-4 py-3 text-slate-700">
												{row.metodoPago}
											</td>
											<td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
												{formatCurrency(row.monto)}
											</td>
											{adminMode ? (
												<td className="px-4 py-3 text-right">
													<button
														type="button"
														disabled={deletingId === row.id}
														onClick={() => void handleDelete(row.id)}
														className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
													>
														{deletingId === row.id ? "…" : "Eliminar"}
													</button>
												</td>
											) : null}
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</section>
			</div>
		</div>
	);
}
