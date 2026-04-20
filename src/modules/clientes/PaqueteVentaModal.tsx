import { useEffect, useMemo, useState } from "react";
import { formatCurrency, totalConIva } from "../../core/currencyFormat";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
import type {
	AppSettings,
	ClienteInput,
	PaqueteVentaContinuePayload,
	ServicePackagePlanSetting,
} from "../../core/types";

interface PaqueteVentaModalProps {
	open: boolean;
	settings: AppSettings;
	/** Cliente ya persistido; omitir si se usa `nuevoCliente`. */
	clienteId?: string | null;
	/** Datos para crear cliente y paquete en una sola operación (tras el cobro). */
	nuevoCliente?: ClienteInput | null;
	/** Si existe en `settings.serviceTypes`, se filtran planes de ese servicio. */
	preferredServiceType?: string | null;
	onClose: () => void;
	/** Tras elegir plan: cierra este modal; el padre abre el modal de cobro. */
	onContinueToPayment: (payload: PaqueteVentaContinuePayload) => void;
}

export function PaqueteVentaModal({
	open,
	settings,
	clienteId = null,
	nuevoCliente = null,
	preferredServiceType = null,
	onClose,
	onContinueToPayment,
}: PaqueteVentaModalProps) {
	const [serviceType, setServiceType] = useState(
		settings.serviceTypes[0]?.id ?? "",
	);
	const [planId, setPlanId] = useState("");
	const [error, setError] = useState<string | null>(null);

	const esClienteNuevo = Boolean(nuevoCliente);
	const cid = clienteId?.trim() ?? "";

	const plansForService = useMemo((): ServicePackagePlanSetting[] => {
		const st = settings.serviceTypes.find((s) => s.id === serviceType);
		return st?.packagePlans ?? [];
	}, [settings.serviceTypes, serviceType]);

	useEffect(() => {
		if (!open) return;
		const pref = preferredServiceType?.trim();
		const st0 =
			pref && settings.serviceTypes.some((s) => s.id === pref)
				? settings.serviceTypes.find((s) => s.id === pref)!
				: settings.serviceTypes[0];
		const nextSt = st0?.id ?? "";
		setServiceType(nextSt);
		const plans = st0?.packagePlans ?? [];
		setPlanId(plans[0]?.id ?? "");
		setError(null);
	}, [open, settings.serviceTypes, preferredServiceType]);

	useEffect(() => {
		if (!open) return;
		const plans = plansForService;
		if (plans.length === 0) {
			setPlanId("");
			return;
		}
		if (!plans.some((p) => p.id === planId)) {
			setPlanId(plans[0]!.id);
		}
	}, [open, plansForService, planId]);

	if (!open) return null;

	const selectedPlan = plansForService.find((p) => p.id === planId);
	const ivaPct = settings.billing?.ivaDefaultPct ?? 19;
	const totales = selectedPlan
		? totalConIva(selectedPlan.priceBeforeVat, ivaPct)
		: { base: 0, iva: 0, total: 0 };

	function handleContinue(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (esClienteNuevo) {
			if (!nuevoCliente) {
				setError("Faltan datos del cliente.");
				return;
			}
		} else if (!cid) {
			setError("Faltan datos del cliente.");
			return;
		}
		if (!selectedPlan || plansForService.length === 0) {
			setError(
				"No hay planes configurados para este servicio. Añádalos en Configuración → Tipos de servicio.",
			);
			return;
		}
		const n = selectedPlan.sessionCount;
		if (n < 1) {
			setError("El plan seleccionado no es válido.");
			return;
		}
		const precio = totales.total;
		if (precio <= 0) {
			setError("El total del plan debe ser mayor que cero.");
			return;
		}
		const labelServicio = serviceLabelFromSettings(settings, serviceType);
		const ingresoConcepto = `Paquete: ${labelServicio} — ${selectedPlan.label} (${n} sesiones)`;

		const payload: PaqueteVentaContinuePayload = {
			serviceType,
			totalSesiones: n,
			precioTotalConIva: precio,
			ingresoConcepto,
			...(esClienteNuevo && nuevoCliente
				? { nuevoCliente }
				: { clienteId: cid }),
		};
		onContinueToPayment(payload);
		onClose();
	}

	return (
		<div
			className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="paquete-venta-title"
		>
			<div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
				<h2
					id="paquete-venta-title"
					className="text-base font-semibold text-slate-800 mb-4"
				>
					Elegir plan de sesiones
				</h2>
				{esClienteNuevo && nuevoCliente ? (
					<div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
						<p className="font-medium text-slate-800">
							Paciente nuevo (la ficha se creará al confirmar el cobro)
						</p>
						<p className="mt-1">
							{nuevoCliente.nombres} {nuevoCliente.apellidos} ·{" "}
							{nuevoCliente.documentType} {nuevoCliente.documentNumber}
						</p>
					</div>
				) : null}
				{error ? (
					<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
						{error}
					</div>
				) : null}
				<form onSubmit={(e) => handleContinue(e)} className="space-y-3">
					<label className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-700">Servicio</span>
						<select
							value={serviceType}
							onChange={(e) => {
								setServiceType(e.target.value);
								setPlanId("");
							}}
							className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
							required
						>
							{settings.serviceTypes.map((s) => (
								<option key={s.id} value={s.id}>
									{s.label}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-700">Plan</span>
						{plansForService.length === 0 ? (
							<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
								No hay planes para este servicio. Configúrelos en{" "}
								<strong>Configuración → Tipos de servicio</strong>.
							</p>
						) : (
							<select
								value={planId}
								onChange={(e) => setPlanId(e.target.value)}
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
								required
							>
								{plansForService.map((p) => (
									<option key={p.id} value={p.id}>
										{p.label} — {p.sessionCount} ses. ·{" "}
										{formatCurrency(p.priceBeforeVat)} + IVA
									</option>
								))}
							</select>
						)}
					</label>
					{selectedPlan ? (
						<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs space-y-1.5">
							<div className="flex justify-between gap-2 text-slate-700">
								<span>Total antes de IVA</span>
								<span className="tabular-nums font-medium text-slate-800 shrink-0">
									{formatCurrency(totales.base)}
								</span>
							</div>
							<div className="flex justify-between gap-2 text-slate-600">
								<span>IVA ({ivaPct}%)</span>
								<span className="tabular-nums shrink-0">
									{formatCurrency(totales.iva)}
								</span>
							</div>
							<div className="flex justify-between gap-2 border-t border-slate-200 pt-1.5 text-slate-800 font-semibold">
								<span>Total a cobrar (con IVA)</span>
								<span className="tabular-nums shrink-0">
									{formatCurrency(totales.total)}
								</span>
							</div>
							<p className="text-[0.65rem] text-slate-500 pt-0.5 leading-snug">
								En el siguiente paso confirmará método de pago y podrá ajustar el
								monto si es necesario.
							</p>
						</div>
					) : null}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={plansForService.length === 0}
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40"
						>
							Continuar al cobro
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
