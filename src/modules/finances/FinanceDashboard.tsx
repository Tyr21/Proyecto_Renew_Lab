import { useCallback, useEffect, useMemo, useState } from "react";
import { obtenerIngresos } from "../../core/api";
import { INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import { fechaIngresoLocalISODate, formatHoraPago } from "../../core/ingresoDate";
import type { Ingreso } from "../../core/types";
import { toISODateLocal } from "../../core/weekUtils";

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

export function FinanceDashboard() {
	const [selectedDate, setSelectedDate] = useState(() =>
		toISODateLocal(new Date()),
	);
	const [allIngresos, setAllIngresos] = useState<Ingreso[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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
		const onIngreso = () => {
			void loadIngresos();
		};
		window.addEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
		return () =>
			window.removeEventListener(INGRESO_REGISTRADO_EVENT, onIngreso);
	}, [loadIngresos]);

	const rowsDelDia = useMemo(() => {
		return allIngresos
			.filter((i) => fechaIngresoLocalISODate(i.fechaPago) === selectedDate)
			.sort((a, b) => b.fechaPago.localeCompare(a.fechaPago));
	}, [allIngresos, selectedDate]);

	const totals = useMemo(() => sumByMethod(rowsDelDia), [rowsDelDia]);

	return (
		<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				<header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold text-slate-800">
							Cierre de caja / Ingresos
						</h1>
						<p className="mt-1 text-sm text-slate-600">
							Ingresos registrados por día (zona horaria local).
						</p>
					</div>
					<label className="flex flex-col gap-1 text-sm">
						<span className="font-medium text-slate-700">Fecha</span>
						<input
							type="date"
							className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm"
							value={selectedDate}
							onChange={(e) => setSelectedDate(e.target.value)}
						/>
					</label>
				</header>

				{error ? (
					<div
						className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
						role="alert"
					>
						{error}
					</div>
				) : null}

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
							Total del día
						</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">
							{loading ? "…" : formatCurrency(totals.total)}
						</p>
					</div>
				</section>

				<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-sm font-medium text-slate-800">
							Detalle del día
						</h2>
						<p className="text-xs text-slate-500">
							{rowsDelDia.length} movimiento
							{rowsDelDia.length === 1 ? "" : "s"}
						</p>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-left text-sm">
							<thead>
								<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
									<th className="px-4 py-3 font-medium">Hora</th>
									<th className="px-4 py-3 font-medium">Paciente (documento)</th>
									<th className="px-4 py-3 font-medium">Concepto</th>
									<th className="px-4 py-3 font-medium">Método</th>
									<th className="px-4 py-3 font-medium text-right">Monto</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td
											colSpan={5}
											className="px-4 py-8 text-center text-slate-500"
										>
											Cargando…
										</td>
									</tr>
								) : rowsDelDia.length === 0 ? (
									<tr>
										<td
											colSpan={5}
											className="px-4 py-8 text-center text-slate-500"
										>
											No hay ingresos para esta fecha.
										</td>
									</tr>
								) : (
									rowsDelDia.map((row) => (
										<tr
											key={row.id}
											className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
										>
											<td className="px-4 py-3 tabular-nums text-slate-800">
												{formatHoraPago(row.fechaPago)}
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
