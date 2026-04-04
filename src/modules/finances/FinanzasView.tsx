import { useState } from "react";
import type { AppSettings } from "../../core/types";
import { FacturasDashboard } from "./FacturasDashboard";
import { FinanceDashboard } from "./FinanceDashboard";

type SubTab = "caja" | "facturas";

interface FinanzasViewProps {
	settings: AppSettings;
}

export function FinanzasView({ settings }: FinanzasViewProps) {
	const [subTab, setSubTab] = useState<SubTab>("caja");

	return (
		<div className="flex h-full flex-col">
			<div className="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-4 py-1.5">
				<button
					type="button"
					className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
						subTab === "caja"
							? "bg-slate-800 text-white"
							: "text-slate-600 hover:bg-slate-100"
					}`}
					onClick={() => setSubTab("caja")}
				>
					Cierre de caja
				</button>
				<button
					type="button"
					className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
						subTab === "facturas"
							? "bg-slate-800 text-white"
							: "text-slate-600 hover:bg-slate-100"
					}`}
					onClick={() => setSubTab("facturas")}
				>
					Facturas
				</button>
			</div>
			<div className="flex-1 min-h-0 overflow-hidden">
				{subTab === "caja" ? (
					<FinanceDashboard adminMode={settings.adminMode ?? false} />
				) : (
					<FacturasDashboard settings={settings} />
				)}
			</div>
		</div>
	);
}
