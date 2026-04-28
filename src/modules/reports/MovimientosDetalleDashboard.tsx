import { useCallback, useEffect, useState } from "react";
import { listarMovimientosFinancierosDetalle } from "../../core/api";
import { FACTURA_CHANGED_EVENT, INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import { fechaIngresoLocalISODate, formatHoraPago } from "../../core/ingresoDate";
import { esc, openPrintWindow } from "../../core/printReport";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
import type { AppSettings, MovimientoFinancieroDetalle } from "../../core/types";
import { addDays, startOfWeekMonday, toISODateLocal } from "../../core/weekUtils";

interface MovimientosDetalleDashboardProps {
	settings: AppSettings;
}

function etiquetaRecibo(row: MovimientoFinancieroDetalle): string {
	if (row.facturaNumero != null && row.facturaSerie?.trim()) {
		return `${row.facturaSerie.trim()}-${row.facturaNumero}`;
	}
	if (row.facturaNumero != null) {
		return String(row.facturaNumero);
	}
	const pkg = row.paqueteId?.trim();
	if (pkg) {
		return `Paquete ${pkg.slice(0, 8)}…`;
	}
	return "—";
}

/** Valor mostrado en columna «factura»: total de factura si hay enlace; si no, monto del ingreso. */
function valorFacturaMostrado(row: MovimientoFinancieroDetalle): number {
	if (row.facturaTotal != null && Number.isFinite(row.facturaTotal)) {
		return row.facturaTotal;
	}
	return row.monto;
}

function etiquetaServicio(settings: AppSettings, concepto: string): string {
	const trimmed = concepto.trim();
	if (!trimmed) return "—";
	return serviceLabelFromSettings(settings, trimmed);
}

export function MovimientosDetalleDashboard({ settings }: MovimientosDetalleDashboardProps) {
	const [dateFrom, setDateFrom] = useState(() => {
		const now = new Date();
		return toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
	});
	const [dateTo, setDateTo] = useState(() => {
		const now = new Date();
		return toISODateLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
	});
	const [rows, setRows] = useState<MovimientoFinancieroDetalle[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await listarMovimientosFinancierosDetalle(dateFrom, dateTo);
			setRows(list);
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudieron cargar los movimientos");
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [dateFrom, dateTo]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		const onRefresh = () => {
			void load();
		};
		window.addEventListener(INGRESO_REGISTRADO_EVENT, onRefresh);
		window.addEventListener(FACTURA_CHANGED_EVENT, onRefresh);
		return () => {
			window.removeEventListener(INGRESO_REGISTRADO_EVENT, onRefresh);
			window.removeEventListener(FACTURA_CHANGED_EVENT, onRefresh);
		};
	}, [load]);

	const handleExportCsv = useCallback(() => {
		if (rows.length === 0) return;
		const header =
			"Fecha,Hora,Nombre cliente,ID cliente,Servicio,Medio pago,N recibo,Valor factura,Monto ingreso";
		const lineas = rows.map((r) => {
			const fecha = fechaIngresoLocalISODate(r.fechaPago);
			const hora = formatHoraPago(r.fechaPago);
			const nombre = `"${r.pacienteNombre.replace(/"/g, '""')}"`;
			const doc = `"${r.pacienteDocumento.replace(/"/g, '""')}"`;
			const serv = `"${etiquetaServicio(settings, r.concepto).replace(/"/g, '""')}"`;
			const recibo = etiquetaRecibo(r);
			const vf = valorFacturaMostrado(r).toFixed(0);
			const mi = r.monto.toFixed(0);
			return [fecha, hora, nombre, doc, serv, r.metodoPago, recibo, vf, mi].join(",");
		});
		const csv = [header, ...lineas].join("\r\n");
		const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		const label = dateFrom === dateTo ? dateFrom : `${dateFrom}_${dateTo}`;
		a.download = `movimientos_detalle_${label}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [rows, dateFrom, dateTo, settings]);

	const handlePrint = useCallback(() => {
		if (rows.length === 0) return;
		const rangeLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} al ${dateTo}`;
		const tableRows = rows
			.map(
				(r) =>
					`<tr>
				<td>${esc(fechaIngresoLocalISODate(r.fechaPago))} ${esc(formatHoraPago(r.fechaPago))}</td>
				<td>${esc(r.pacienteNombre || "—")}</td>
				<td>${esc(r.pacienteDocumento)}</td>
				<td>${esc(etiquetaServicio(settings, r.concepto))}</td>
				<td>${esc(r.metodoPago)}</td>
				<td class="num">${esc(etiquetaRecibo(r))}</td>
				<td class="num bold">${formatCurrency(valorFacturaMostrado(r))}</td>
			</tr>`,
			)
			.join("");
		const body = `
		<h1>Movimientos con detalle</h1>
		<p class="subtitle">${esc(rangeLabel)} &mdash; ${rows.length} movimiento${rows.length === 1 ? "" : "s"}</p>
		<table>
			<thead><tr>
				<th>Fecha</th><th>Nombre cliente</th><th>ID cliente</th><th>Servicio</th>
				<th>Medio de pago</th><th class="num">N° recibo</th><th class="num">Valor factura</th>
			</tr></thead>
			<tbody>${tableRows}</tbody>
		</table>
		<p class="footer">Generado el ${new Date().toLocaleString("es-CO")} &mdash; Consultorio Renew Lab</p>`;
		openPrintWindow(`Movimientos ${rangeLabel}`, body);
	}, [rows, dateFrom, dateTo, settings]);

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

	return (
		<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
			<div className="mx-auto max-w-7xl space-y-6">
				<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold text-slate-800">Movimientos con detalle</h1>
						<p className="mt-1 text-sm text-slate-600">
							Ingresos del rango: cliente, documento, servicio, medio de pago, recibo (serie-número
							de factura si existe; en ventas de paquete sin factura, referencia al paquete) y valor
							factura (total de la factura vinculada; si no hay factura, el monto del ingreso).
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap gap-1">
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
								onClick={handleExportCsv}
								disabled={rows.length === 0 || loading}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
							>
								Exportar CSV
							</button>
							<button
								type="button"
								onClick={handlePrint}
								disabled={rows.length === 0 || loading}
								className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40"
							>
								Imprimir / PDF
							</button>
						</div>
						<div className="flex flex-wrap gap-2 items-end">
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
					<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
						{error}
					</div>
				) : null}

				<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
					<table className="min-w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
								<th className="whitespace-nowrap px-3 py-3">Fecha</th>
								<th className="whitespace-nowrap px-3 py-3">Nombre cliente</th>
								<th className="whitespace-nowrap px-3 py-3">ID cliente</th>
								<th className="whitespace-nowrap px-3 py-3">Servicio</th>
								<th className="whitespace-nowrap px-3 py-3">Medio de pago</th>
								<th className="whitespace-nowrap px-3 py-3">N° recibo</th>
								<th className="whitespace-nowrap px-3 py-3 text-right">Valor factura</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 && !loading ? (
								<tr>
									<td colSpan={7} className="px-4 py-12 text-center text-slate-500">
										No hay movimientos en el rango seleccionado.
									</td>
								</tr>
							) : (
								rows.map((r) => (
									<tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
										<td className="whitespace-nowrap px-3 py-2.5 text-slate-800">
											<span className="block">{fechaIngresoLocalISODate(r.fechaPago)}</span>
											<span className="text-xs text-slate-500">{formatHoraPago(r.fechaPago)}</span>
										</td>
										<td className="max-w-[200px] px-3 py-2.5 text-slate-800">
											{r.pacienteNombre || "—"}
										</td>
										<td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
											{r.pacienteDocumento}
										</td>
										<td className="max-w-[220px] px-3 py-2.5 text-slate-700">
											{etiquetaServicio(settings, r.concepto)}
										</td>
										<td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{r.metodoPago}</td>
										<td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm text-slate-800">
											{etiquetaRecibo(r)}
										</td>
										<td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">
											{formatCurrency(valorFacturaMostrado(r))}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
