import { useCallback, useEffect, useMemo, useState } from "react";
import {
	estadisticasCitasPorMes,
	estadisticasIngresosPorMes,
	estadisticasMetodosPago,
	estadisticasServicios,
} from "../../core/api";
import type { ChartDataPoint } from "../../components/IncomeBarChart";
import { IncomeBarChart } from "../../components/IncomeBarChart";
import { formatCurrency } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import type {
	AppSettings,
	CitasPorMes,
	IngresosPorMes,
	MetodoPagoStats,
	ServicioStats,
} from "../../core/types";
import { addDays, startOfWeekMonday, toISODateLocal } from "../../core/weekUtils";

interface ReportsDashboardProps {
	settings: AppSettings;
}

type FiltroPreset = "hoy" | "semana" | "mes" | "mesPasado" | "12meses" | "custom";

function calcularRangoPreset(preset: Exclude<FiltroPreset, "custom">): {
	inicio: string;
	fin: string;
} {
	const hoy = new Date();
	switch (preset) {
		case "hoy": {
			const d = toISODateLocal(hoy);
			return { inicio: d, fin: d };
		}
		case "semana": {
			const lunes = startOfWeekMonday(hoy);
			const domingo = addDays(lunes, 6);
			return { inicio: toISODateLocal(lunes), fin: toISODateLocal(domingo) };
		}
		case "mes": {
			const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
			const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
			return { inicio: toISODateLocal(inicioMes), fin: toISODateLocal(finMes) };
		}
		case "mesPasado": {
			const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
			const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
			return { inicio: toISODateLocal(inicioMesPasado), fin: toISODateLocal(finMesPasado) };
		}
		case "12meses": {
			const hace12 = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
			return { inicio: toISODateLocal(hace12), fin: toISODateLocal(hoy) };
		}
	}
}

const FILTROS: { id: FiltroPreset; label: string }[] = [
	{ id: "hoy", label: "Hoy" },
	{ id: "semana", label: "Esta semana" },
	{ id: "mes", label: "Este mes" },
	{ id: "mesPasado", label: "Mes pasado" },
	{ id: "12meses", label: "Últimos 12 meses" },
	{ id: "custom", label: "Personalizado" },
];

export function ReportsDashboard({ settings }: ReportsDashboardProps) {
	const [filtroActivo, setFiltroActivo] = useState<FiltroPreset>("12meses");
	const [desdeInput, setDesdeInput] = useState("");
	const [hastaInput, setHastaInput] = useState("");

	const rango = useMemo(() => {
		if (filtroActivo === "custom") {
			return { inicio: desdeInput, fin: hastaInput };
		}
		return calcularRangoPreset(filtroActivo);
	}, [filtroActivo, desdeInput, hastaInput]);

	const [citasPorMes, setCitasPorMes] = useState<CitasPorMes[]>([]);
	const [ingresosPorMes, setIngresosPorMes] = useState<IngresosPorMes[]>([]);
	const [servicios, setServicios] = useState<ServicioStats[]>([]);
	const [metodosPago, setMetodosPago] = useState<MetodoPagoStats[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const cargarEstadisticas = useCallback(async () => {
		if (!rango.inicio || !rango.fin) return;
		setError(null);
		setLoading(true);
		try {
			const [citas, ingresos, servicios_data, metodos] = await Promise.all([
				estadisticasCitasPorMes(rango.inicio, rango.fin),
				estadisticasIngresosPorMes(rango.inicio, rango.fin),
				estadisticasServicios(rango.inicio, rango.fin),
				estadisticasMetodosPago(rango.inicio, rango.fin),
			]);
			setCitasPorMes(citas);
			setIngresosPorMes(ingresos);
			setServicios(servicios_data);
			setMetodosPago(metodos);
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudieron cargar las estadísticas");
		} finally {
			setLoading(false);
		}
	}, [rango]);

	useEffect(() => {
		void cargarEstadisticas();
	}, [cargarEstadisticas]);

	// Métricas de resumen
	const totalCitasRango = useMemo(
		() => citasPorMes.reduce((sum, c) => sum + c.totalCitas, 0),
		[citasPorMes],
	);

	const totalIngresosRango = useMemo(
		() => ingresosPorMes.reduce((sum, i) => sum + i.montoTotal, 0),
		[ingresosPorMes],
	);

	const metodoPagoMasUsado = useMemo(() => metodosPago[0] ?? null, [metodosPago]);

	const servicioMasSolicitado = useMemo(() => servicios[0] ?? null, [servicios]);

	const ingresosChartData = useMemo<ChartDataPoint[]>(() => {
		return ingresosPorMes.map((row) => ({
			label: row.mes,
			value: row.montoTotal,
			detail: `${row.cantidadTransacciones} transacciones · Prom: ${formatCurrency(row.montoPromedio)}`,
		}));
	}, [ingresosPorMes]);

	function obtenerLabelServicio(serviceType: string): string {
		return (
			settings.serviceTypes.find((s) => s.id === serviceType)?.label ?? serviceType
		);
	}

	function aplicarCustom() {
		if (desdeInput && hastaInput && desdeInput <= hastaInput) {
			void cargarEstadisticas();
		}
	}

	return (
		<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
			<div className="mx-auto max-w-6xl space-y-6">
				<header>
					<h1 className="text-xl font-semibold text-slate-800">
						📊 Reportes y Estadísticas
					</h1>
				</header>

				{/* Filtros de fechas */}
				<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="flex flex-wrap items-center gap-2">
						{FILTROS.map((f) => (
							<button
								key={f.id}
								type="button"
								onClick={() => setFiltroActivo(f.id)}
								className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
									filtroActivo === f.id
										? "bg-sky-600 text-white"
										: "bg-slate-100 text-slate-700 hover:bg-slate-200"
								}`}
							>
								{f.label}
							</button>
						))}
					</div>

					{filtroActivo === "custom" && (
						<div className="mt-3 flex flex-wrap items-end gap-3">
							<div className="flex flex-col gap-1">
								<label className="text-xs font-medium text-slate-600">Desde</label>
								<input
									type="date"
									value={desdeInput}
									onChange={(e) => setDesdeInput(e.target.value)}
									className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-xs font-medium text-slate-600">Hasta</label>
								<input
									type="date"
									value={hastaInput}
									onChange={(e) => setHastaInput(e.target.value)}
									min={desdeInput}
									className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								/>
							</div>
							<button
								type="button"
								onClick={aplicarCustom}
								disabled={!desdeInput || !hastaInput || desdeInput > hastaInput}
								className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
							>
								Aplicar
							</button>
						</div>
					)}

					{filtroActivo !== "custom" && rango.inicio && (
						<p className="mt-2 text-xs text-slate-500">
							{rango.inicio} — {rango.fin}
						</p>
					)}
				</section>

				{error ? (
					<div
						className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
						role="alert"
					>
						{error}
					</div>
				) : null}

				{loading ? (
					<div className="flex items-center justify-center py-16 text-slate-500 text-sm">
						Cargando estadísticas…
					</div>
				) : (
					<>
						{/* Cards de métricas principales */}
						<section className="grid grid-cols-1 gap-4 md:grid-cols-4">
							<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
									Total citas
								</p>
								<p className="mt-2 text-2xl font-bold text-slate-900">
									{totalCitasRango}
								</p>
							</div>

							<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
									Total ingresos
								</p>
								<p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
									{formatCurrency(totalIngresosRango)}
								</p>
							</div>

							<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
									Método más usado
								</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">
									{metodoPagoMasUsado?.metodoPago ?? "—"}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									{metodoPagoMasUsado
										? `${metodoPagoMasUsado.cantidadTransacciones} transacciones`
										: ""}
								</p>
							</div>

							<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
									Servicio más solicitado
								</p>
								<p className="mt-2 text-lg font-semibold text-slate-900">
									{servicioMasSolicitado
										? obtenerLabelServicio(servicioMasSolicitado.serviceType)
										: "—"}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									{servicioMasSolicitado
										? `${servicioMasSolicitado.totalCitas} citas`
										: ""}
								</p>
							</div>
						</section>

						{/* Tabla de Citas por Mes */}
						<section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
							<div className="border-b border-slate-200 px-4 py-3">
								<h2 className="text-sm font-semibold text-slate-800">Citas por Mes</h2>
								<p className="text-xs text-slate-500 mt-0.5">
									{citasPorMes.length} meses registrados
								</p>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
											<th className="px-4 py-3 text-left font-medium">Mes</th>
											<th className="px-4 py-3 text-right font-medium">Total Citas</th>
											<th className="px-4 py-3 text-right font-medium">Asistieron</th>
											<th className="px-4 py-3 text-right font-medium">No Asistieron</th>
											<th className="px-4 py-3 text-right font-medium">% Asistencia</th>
										</tr>
									</thead>
									<tbody>
										{citasPorMes.length === 0 ? (
											<tr>
												<td colSpan={5} className="px-4 py-8 text-center text-slate-500">
													No hay datos para este período
												</td>
											</tr>
										) : (
											citasPorMes.map((row) => (
												<tr
													key={row.mes}
													className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
												>
													<td className="px-4 py-3 text-slate-800">{row.mes}</td>
													<td className="px-4 py-3 text-right font-medium text-slate-900">
														{row.totalCitas}
													</td>
													<td className="px-4 py-3 text-right text-emerald-700">
														{row.asistieron}
													</td>
													<td className="px-4 py-3 text-right text-red-700">
														{row.noAsistieron}
													</td>
													<td className="px-4 py-3 text-right font-medium text-slate-900">
														{row.porcentajeAsistencia.toFixed(1)}%
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</section>

						{/* Gráfico de tendencia de ingresos */}
						{ingresosChartData.length > 0 && (
							<IncomeBarChart
								data={ingresosChartData}
								title="Tendencia de ingresos"
								accentColor="emerald"
							/>
						)}

						{/* Tabla de Ingresos por Mes */}
						<section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
							<div className="border-b border-slate-200 px-4 py-3">
								<h2 className="text-sm font-semibold text-slate-800">Ingresos por Mes</h2>
								<p className="text-xs text-slate-500 mt-0.5">
									{ingresosPorMes.length} meses registrados
								</p>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
											<th className="px-4 py-3 text-left font-medium">Mes</th>
											<th className="px-4 py-3 text-right font-medium">Monto Total</th>
											<th className="px-4 py-3 text-right font-medium">Transacciones</th>
											<th className="px-4 py-3 text-right font-medium">Promedio</th>
										</tr>
									</thead>
									<tbody>
										{ingresosPorMes.length === 0 ? (
											<tr>
												<td colSpan={4} className="px-4 py-8 text-center text-slate-500">
													No hay datos para este período
												</td>
											</tr>
										) : (
											ingresosPorMes.map((row) => (
												<tr
													key={row.mes}
													className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
												>
													<td className="px-4 py-3 text-slate-800">{row.mes}</td>
													<td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-900">
														{formatCurrency(row.montoTotal)}
													</td>
													<td className="px-4 py-3 text-right text-slate-600">
														{row.cantidadTransacciones}
													</td>
													<td className="px-4 py-3 text-right tabular-nums text-slate-800">
														{formatCurrency(row.montoPromedio)}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</section>

						{/* Tabla de Servicios más Solicitados */}
						<section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
							<div className="border-b border-slate-200 px-4 py-3">
								<h2 className="text-sm font-semibold text-slate-800">
									Servicios Más Solicitados
								</h2>
								<p className="text-xs text-slate-500 mt-0.5">
									{servicios.length} tipos de servicio
								</p>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
											<th className="px-4 py-3 text-left font-medium">Servicio</th>
											<th className="px-4 py-3 text-right font-medium">Total Citas</th>
											<th className="px-4 py-3 text-right font-medium">Asistieron</th>
											<th className="px-4 py-3 text-right font-medium">% Asistencia</th>
										</tr>
									</thead>
									<tbody>
										{servicios.length === 0 ? (
											<tr>
												<td colSpan={4} className="px-4 py-8 text-center text-slate-500">
													No hay datos para este período
												</td>
											</tr>
										) : (
											servicios.map((row) => (
												<tr
													key={row.serviceType}
													className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
												>
													<td className="px-4 py-3 text-slate-800 font-medium">
														{obtenerLabelServicio(row.serviceType)}
													</td>
													<td className="px-4 py-3 text-right font-bold text-slate-900">
														{row.totalCitas}
													</td>
													<td className="px-4 py-3 text-right text-emerald-700">
														{row.asistieron}
													</td>
													<td className="px-4 py-3 text-right font-medium text-slate-900">
														{row.porcentajeAsistencia.toFixed(1)}%
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</section>

						{/* Tabla de Métodos de Pago */}
						<section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
							<div className="border-b border-slate-200 px-4 py-3">
								<h2 className="text-sm font-semibold text-slate-800">Métodos de Pago</h2>
								<p className="text-xs text-slate-500 mt-0.5">
									{metodosPago.length} métodos utilizados
								</p>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
											<th className="px-4 py-3 text-left font-medium">Método</th>
											<th className="px-4 py-3 text-right font-medium">Monto Total</th>
											<th className="px-4 py-3 text-right font-medium">Transacciones</th>
											<th className="px-4 py-3 text-right font-medium">% del Total</th>
										</tr>
									</thead>
									<tbody>
										{metodosPago.length === 0 ? (
											<tr>
												<td colSpan={4} className="px-4 py-8 text-center text-slate-500">
													No hay datos para este período
												</td>
											</tr>
										) : (
											metodosPago.map((row) => (
												<tr
													key={row.metodoPago}
													className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
												>
													<td className="px-4 py-3 text-slate-800 font-medium">
														{row.metodoPago}
													</td>
													<td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-900">
														{formatCurrency(row.montoTotal)}
													</td>
													<td className="px-4 py-3 text-right text-slate-600">
														{row.cantidadTransacciones}
													</td>
													<td className="px-4 py-3 text-right font-medium text-slate-900">
														{row.porcentajeDelTotal.toFixed(1)}%
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</section>
					</>
				)}
			</div>
		</div>
	);
}
