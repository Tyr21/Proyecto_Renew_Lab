import { useState } from "react";
import type { AppSettings } from "../../core/types";
import { FacturasDashboard } from "../finances/FacturasDashboard";
import { FinanceDashboard } from "../finances/FinanceDashboard";
import { MovimientosDetalleDashboard } from "./MovimientosDetalleDashboard";
import { OxygenDashboard } from "./OxygenDashboard";
import { ReportsDashboard } from "./ReportsDashboard";

type SubTab = "cierre" | "facturas" | "oxigeno" | "estadisticas" | "movimientos";

interface ReportesModuleViewProps {
	settings: AppSettings;
}

export function ReportesModuleView({ settings }: ReportesModuleViewProps) {
	const [subTab, setSubTab] = useState<SubTab>("cierre");

	return (
		<div className="flex h-full flex-col">
			<div className="flex shrink-0 flex-wrap gap-1 border-b border-slate-200 bg-white px-4 py-1.5">
				<button
					type="button"
					className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
						subTab === "cierre" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
					}`}
					onClick={() => setSubTab("cierre")}
				>
					Cierre de caja
				</button>
				<button
					type="button"
					className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
						subTab === "facturas" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
					}`}
					onClick={() => setSubTab("facturas")}
				>
					Facturas
				</button>
				<button
					type="button"
					className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
						subTab === "oxigeno" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
					}`}
					onClick={() => setSubTab("oxigeno")}
				>
					Oxígeno
				</button>
				<button
					type="button"
					className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
						subTab === "estadisticas"
							? "bg-slate-800 text-white"
							: "text-slate-600 hover:bg-slate-100"
					}`}
					onClick={() => setSubTab("estadisticas")}
				>
					Estadísticas
				</button>
				<button
					type="button"
					className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
						subTab === "movimientos"
							? "bg-slate-800 text-white"
							: "text-slate-600 hover:bg-slate-100"
					}`}
					onClick={() => setSubTab("movimientos")}
				>
					Movimientos detallados
				</button>
			</div>
			<div className="flex-1 min-h-0 overflow-hidden">
				{subTab === "cierre" ? (
					<FinanceDashboard adminMode={settings.adminMode ?? false} />
				) : subTab === "facturas" ? (
					<FacturasDashboard settings={settings} />
				) : subTab === "oxigeno" ? (
					<OxygenDashboard settings={settings} />
				) : subTab === "estadisticas" ? (
					<ReportsDashboard settings={settings} />
				) : (
					<MovimientosDetalleDashboard settings={settings} />
				)}
			</div>
		</div>
	);
}
