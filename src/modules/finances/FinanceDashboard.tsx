import { useCallback, useEffect, useMemo, useState } from "react";
import { eliminarIngreso, obtenerIngresos, resumenOxigenoRango } from "../../core/api";
import type { ChartDataPoint } from "../../components/IncomeBarChart";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { IncomeBarChart } from "../../components/IncomeBarChart";
import { INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import { logger } from "../../core/logger";
import { fechaIngresoLocalISODate, formatHoraPago } from "../../core/ingresoDate";
import { esc, openPrintWindow } from "../../core/printReport";
import type { Ingreso, OxigenoResumenDia } from "../../core/types";
import { addDays, startOfWeekMonday, toISODateLocal } from "../../core/weekUtils";

interface FinanceDashboardProps {
	adminMode?: boolean;
}

function generarCSV(rows: Ingreso[]): string {
	const encabezado = ["Fecha", "Hora", "Paciente", "Documento", "Concepto", "Metodo", "Monto"].join(
		",",
	);
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
		} else if (r.metodoPago === "Tarjeta" || r.metodoPago === "Transferencia") {
			bancos += m;
		}
	}
	return { efectivo, bancos, total };
}

function formatoOxigeno(n: number | null): string {
	if (n == null || !Number.isFinite(n)) return "—";
	return n.toLocaleString("es-CO", { maximumFractionDigits: 4 });
}

function filaOxigenoDestaca(row: OxigenoResumenDia): boolean {
	if (row.sinLecturas) return true;
	const base = Math.max(1e-9, Math.abs(row.consumoTeorico));
	const tol = Math.max(1e-6, 0.15 * base);
	const va = row.varianzaVsTeoricoA;
	const vb = row.varianzaVsTeoricoB;
	if (va != null && Number.isFinite(va) && Math.abs(va) > tol) return true;
	if (vb != null && Number.isFinite(vb) && Math.abs(vb) > tol) return true;
	return false;
}

export function FinanceDashboard({ adminMode = false }: FinanceDashboardProps) {
	const today = toISODateLocal(new Date());
	const [dateFrom, setDateFrom] = useState(today);
	const [dateTo, setDateTo] = useState(today);
	const [ingresos, setIngresos] = useState<Ingreso[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [csvToast, setCsvToast] = useState(false);
	const [oxygenRows, setOxygenRows] = useState<OxigenoResumenDia[]>([]);
	const [oxygenLoading, setOxygenLoading] = useState(false);
	const [oxygenError, setOxygenError] = useState<string | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const loadIngresos = useCallback(async () => {
		setError(null);
		setLoading(true);
		try {
			const list = await obtenerIngresos(dateFrom, dateTo);
			setIngresos(list);
		} catch (e) {
			void logger.invokeError("finance.obtenerIngresos", e);
			setError(formatInvokeError(e) || "No se pudieron cargar los ingresos");
		} finally {
			setLoading(false);
		}
	}, [dateFrom, dateTo]);

	const loadOxygen = useCallback(async () => {
		setOxygenError(null);
		setOxygenLoading(true);
		try {
			const rows = await resumenOxigenoRango(dateFrom, dateTo);
			setOxygenRows(rows);
		} catch (e) {
			void logger.invokeError("finance.resumenOxigeno", e);
			setOxygenError(formatInvokeError(e) || "No se pudo cargar el resumen de oxígeno");
			setOxygenRows([]);
		} finally {
			setOxygenLoading(false);
		}
	}, [dateFrom, dateTo]);

	useEffect(() => {
		void loadIngresos();
		const onIngreso = () => {
			void loadIngresos();
		};
		window.addEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
		return () => window.removeEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
	}, [loadIngresos]);

	useEffect(() => {
		void loadOxygen();
	}, [loadOxygen]);

	const totals = useMemo(() => sumByMethod(ingresos), [ingresos]);

	const reportePorServicio = useMemo(() => {
		const mapa = new Map<string, { total: number; cantidad: number }>();
		for (const r of ingresos) {
			const clave = r.concepto.trim() || "(sin concepto)";
			const prev = mapa.get(clave) ?? { total: 0, cantidad: 0 };
			mapa.set(clave, { total: prev.total + r.monto, cantidad: prev.cantidad + 1 });
		}
		return Array.from(mapa.entries())
			.map(([concepto, datos]) => ({ concepto, ...datos }))
			.sort((a, b) => b.total - a.total);
	}, [ingresos]);

	const chartData = useMemo<ChartDataPoint[]>(() => {
		if (ingresos.length === 0) return [];
		const byDate = new Map<string, { total: number; count: number }>();
		for (const r of ingresos) {
			const fecha = fechaIngresoLocalISODate(r.fechaPago);
			const prev = byDate.get(fecha) ?? { total: 0, count: 0 };
			byDate.set(fecha, { total: prev.total + r.monto, count: prev.count + 1 });
		}
		const allDates: string[] = [];
		const d0 = new Date(dateFrom + "T00:00:00");
		const d1 = new Date(dateTo + "T00:00:00");
		const cur = new Date(d0);
		while (cur <= d1) {
			allDates.push(toISODateLocal(cur));
			cur.setDate(cur.getDate() + 1);
		}
		if (allDates.length === 0) {
			allDates.push(...byDate.keys());
			allDates.sort();
		}
		return allDates.map((fecha) => {
			const entry = byDate.get(fecha);
			const parts = fecha.split("-");
			const shortLabel = `${parts[2]}/${parts[1]}`;
			return {
				label: shortLabel,
				value: entry?.total ?? 0,
				detail: entry ? `${entry.count} ingreso${entry.count === 1 ? "" : "s"}` : undefined,
			};
		});
	}, [ingresos, dateFrom, dateTo]);

	const handleDelete = useCallback(
		async (id: string) => {
			setDeletingId(id);
			try {
				await eliminarIngreso(id);
				await loadIngresos();
			} catch (e) {
				void logger.invokeError("finance.eliminarIngreso", e);
				setError(formatInvokeError(e) || "No se pudo eliminar el ingreso");
			} finally {
				setDeletingId(null);
			}
		},
		[loadIngresos],
	);

	const handleExportCSV = useCallback(() => {
		if (ingresos.length === 0) return;
		const csv = generarCSV(ingresos);
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
		setCsvToast(true);
		setTimeout(() => setCsvToast(false), 3000);
	}, [ingresos, dateFrom, dateTo]);

	const handleExportPDF = useCallback(() => {
		if (ingresos.length === 0) return;
		const rangeLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} al ${dateTo}`;

		const cardsHtml = `
		<div class="cards">
			<div class="card"><div class="card-label">Total efectivo</div><div class="card-value">${formatCurrency(totals.efectivo)}</div></div>
			<div class="card"><div class="card-label">Total bancos</div><div class="card-value">${formatCurrency(totals.bancos)}</div><div class="card-detail">Tarjeta y transferencia</div></div>
			<div class="card card-accent"><div class="card-label">Total general</div><div class="card-value">${formatCurrency(totals.total)}</div></div>
		</div>`;

		let servicioHtml = "";
		if (reportePorServicio.length > 0) {
			servicioHtml = `<div class="section-title">Resumen por servicio</div><div class="cards">${reportePorServicio
				.map(
					({ concepto, total, cantidad }) =>
						`<div class="card"><div class="card-label">${esc(concepto)}</div><div class="card-value">${formatCurrency(total)}</div><div class="card-detail">${cantidad} ingreso${cantidad === 1 ? "" : "s"}</div></div>`,
				)
				.join("")}</div>`;
		}

		const tableRows = ingresos
			.map(
				(r) =>
					`<tr>
				<td class="num">${esc(fechaIngresoLocalISODate(r.fechaPago))}</td>
				<td class="num">${esc(formatHoraPago(r.fechaPago))}</td>
				<td>${esc(r.pacienteNombre || "—")}</td>
				<td>${esc(r.pacienteDocumento)}</td>
				<td>${esc(r.concepto)}</td>
				<td>${esc(r.metodoPago)}</td>
				<td class="num bold">${formatCurrency(r.monto)}</td>
			</tr>`,
			)
			.join("");

		let oxygenHtml = "";
		if (oxygenRows.length > 0) {
			const unidad = oxygenRows[0]?.unidadEtiqueta ?? "";
			const oRows = oxygenRows
				.map((row) => {
					const alerta = filaOxigenoDestaca(row) ? '<span class="tag-warn">Revisar</span>' : "";
					return `<tr>
						<td class="num">${esc(row.fecha)}</td>
						<td class="num">${row.sesionesCamara}</td>
						<td class="num">${formatoOxigeno(row.consumoTeorico)} ${esc(unidad)}</td>
						<td class="num">${formatoOxigeno(row.deltaMedidorA)}</td>
						<td class="num">${formatoOxigeno(row.deltaMedidorB)}</td>
						<td class="num">${formatoOxigeno(row.varianzaVsTeoricoA)}</td>
						<td class="num">${formatoOxigeno(row.varianzaVsTeoricoB)}</td>
						<td>${row.eventosRegistrados}</td>
						<td>${alerta}</td>
					</tr>`;
				})
				.join("");
			oxygenHtml = `
			<div class="section-title">Ox\u00edgeno (c\u00e1mara hiperb\u00e1rica)</div>
			<p class="subtitle">Consumo te\u00f3rico vs. delta de medidores (${esc(unidad)})</p>
			<table>
				<thead><tr>
					<th>Fecha</th>
					<th class="num">Sesiones</th>
					<th class="num">Te\u00f3rico</th>
					<th class="num">\u0394 A</th>
					<th class="num">\u0394 B</th>
					<th class="num">Var. A</th>
					<th class="num">Var. B</th>
					<th class="num">Eventos</th>
					<th>Estado</th>
				</tr></thead>
				<tbody>${oRows}</tbody>
			</table>`;
		}

		const body = `
		<h1>Cierre de caja / Ingresos</h1>
		<p class="subtitle">${esc(rangeLabel)} &mdash; ${ingresos.length} movimiento${ingresos.length === 1 ? "" : "s"}</p>
		${cardsHtml}
		${servicioHtml}
		${oxygenHtml}
		<div class="section-title">Detalle del per\u00edodo</div>
		<table>
			<thead><tr>
				<th>Fecha</th><th>Hora</th><th>Paciente</th><th>Documento</th><th>Concepto</th><th>M\u00e9todo</th><th class="num">Monto</th>
			</tr></thead>
			<tbody>${tableRows}</tbody>
		</table>
		<p class="footer">Generado el ${new Date().toLocaleString("es-CO")} &mdash; Consultorio Renew Lab</p>`;

		openPrintWindow(`Cierre de caja ${rangeLabel}`, body);
	}, [ingresos, dateFrom, dateTo, totals, reportePorServicio, oxygenRows]);

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

	function setMesPasado() {
		const now = new Date();
		const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const last = new Date(now.getFullYear(), now.getMonth(), 0);
		setDateFrom(toISODateLocal(first));
		setDateTo(toISODateLocal(last));
	}

	const colSpan = adminMode ? 7 : 6;

	return (
		<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold text-slate-800">Cierre de caja / Ingresos</h1>
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
								onClick={setMesPasado}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
							>
								Mes pasado
							</button>
							<button
								type="button"
								onClick={handleExportCSV}
								disabled={ingresos.length === 0 || loading}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
							>
								Exportar CSV
							</button>
							<button
								type="button"
								onClick={handleExportPDF}
								disabled={ingresos.length === 0 || loading}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
							>
								Exportar PDF
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
						<p className="mt-1 text-xs text-slate-500">Tarjeta y transferencia</p>
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
						<h2 className="mb-3 text-sm font-medium text-slate-700">Resumen por servicio</h2>
						<div className="flex flex-wrap gap-3">
							{reportePorServicio.map(({ concepto, total, cantidad }) => (
								<div
									key={concepto}
									className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-[180px]"
								>
									<p className="text-xs font-medium text-slate-500 truncate" title={concepto}>
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

				<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-sm font-medium text-slate-800">Oxígeno (cámara hiperbárica)</h2>
						<p className="mt-0.5 text-xs text-slate-500">
							Sesiones atendidas del tipo configurado, consumo teórico (K × sesiones) y delta entre
							primera y última lectura del día en cada medidor. Revise filas marcadas si faltan
							registros o la varianza respecto al teórico es alta.
						</p>
					</div>
					{oxygenError ? (
						<div className="px-4 py-3 text-sm text-red-800" role="alert">
							{oxygenError}
						</div>
					) : oxygenLoading ? (
						<p className="px-4 py-8 text-center text-sm text-slate-500">Cargando resumen…</p>
					) : oxygenRows.length === 0 ? (
						<p className="px-4 py-8 text-center text-sm text-slate-500">
							No hay fechas en el rango seleccionado.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[720px] text-left text-sm">
								<thead>
									<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
										<th className="px-3 py-2 font-medium">Fecha</th>
										<th className="px-3 py-2 font-medium text-right">Sesiones</th>
										<th className="px-3 py-2 font-medium text-right">Teórico</th>
										<th className="px-3 py-2 font-medium text-right">Δ A</th>
										<th className="px-3 py-2 font-medium text-right">Δ B</th>
										<th className="px-3 py-2 font-medium text-right">Var. A</th>
										<th className="px-3 py-2 font-medium text-right">Var. B</th>
										<th className="px-3 py-2 font-medium text-right">Eventos</th>
										<th className="px-3 py-2 font-medium">Alerta</th>
									</tr>
								</thead>
								<tbody>
									{oxygenRows.map((row) => {
										const unidad = row.unidadEtiqueta || "u.";
										const alerta = filaOxigenoDestaca(row);
										return (
											<tr
												key={row.fecha}
												className={`border-b border-slate-100 last:border-0 ${
													alerta ? "bg-amber-50/80" : "hover:bg-slate-50/80"
												}`}
											>
												<td className="px-3 py-2 tabular-nums text-slate-800">{row.fecha}</td>
												<td className="px-3 py-2 text-right tabular-nums text-slate-800">
													{row.sesionesCamara}
												</td>
												<td className="px-3 py-2 text-right tabular-nums text-slate-800">
													{formatoOxigeno(row.consumoTeorico)} {unidad}
												</td>
												<td className="px-3 py-2 text-right tabular-nums text-slate-700">
													{formatoOxigeno(row.deltaMedidorA)}
												</td>
												<td className="px-3 py-2 text-right tabular-nums text-slate-700">
													{formatoOxigeno(row.deltaMedidorB)}
												</td>
												<td className="px-3 py-2 text-right tabular-nums text-slate-700">
													{formatoOxigeno(row.varianzaVsTeoricoA)}
												</td>
												<td className="px-3 py-2 text-right tabular-nums text-slate-700">
													{formatoOxigeno(row.varianzaVsTeoricoB)}
												</td>
												<td className="px-3 py-2 text-right tabular-nums text-slate-700">
													{row.eventosRegistrados}
												</td>
												<td className="px-3 py-2 text-xs text-slate-700">
													{row.sinLecturas ? (
														<span className="font-medium text-amber-800">Sin lecturas</span>
													) : alerta ? (
														<span className="font-medium text-amber-800">Varianza vs. teórico</span>
													) : (
														<span className="text-slate-400">—</span>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</section>

				{/* Gráfico de ingresos por día */}
				{!loading && chartData.length > 0 && (
					<IncomeBarChart data={chartData} title="Ingresos por día" accentColor="emerald" />
				)}

				{/* Tabla de detalle */}
				<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-sm font-medium text-slate-800">Detalle del período</h2>
						<p className="text-xs text-slate-500">
							{ingresos.length} movimiento
							{ingresos.length === 1 ? "" : "s"}
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
										<td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
											Cargando…
										</td>
									</tr>
								) : ingresos.length === 0 ? (
									<tr>
										<td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
											No hay ingresos para este período.
										</td>
									</tr>
								) : (
									ingresos.map((row) => (
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
											<td className="px-4 py-3 text-slate-800">{row.pacienteDocumento}</td>
											<td className="px-4 py-3 text-slate-800">{row.concepto}</td>
											<td className="px-4 py-3 text-slate-700">{row.metodoPago}</td>
											<td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
												{formatCurrency(row.monto)}
											</td>
											{adminMode ? (
												<td className="px-4 py-3 text-right">
													<button
														type="button"
														disabled={deletingId === row.id}
														onClick={() => setPendingDeleteId(row.id)}
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

			{csvToast ? (
				<div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-fade-in">
					Reporte CSV exportado correctamente
				</div>
			) : null}

			<ConfirmDialog
				open={pendingDeleteId !== null}
				title="Eliminar ingreso"
				message="¿Eliminar este ingreso de forma permanente? Esta acción no se puede deshacer."
				confirmLabel="Eliminar"
				cancelLabel="Cancelar"
				variant="danger"
				onCancel={() => setPendingDeleteId(null)}
				onConfirm={() => {
					const id = pendingDeleteId;
					if (!id) return;
					setPendingDeleteId(null);
					void handleDelete(id);
				}}
			/>
		</div>
	);
}
