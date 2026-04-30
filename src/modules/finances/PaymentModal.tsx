import { type FormEvent, useEffect, useState } from "react";
import {
	crearIngreso,
	crearPaquete,
	emitirFactura,
	guardarBorradorFactura,
} from "../../core/api";
import { crearClienteYPaqueteRespectingDuplicateNameConfirm } from "../../core/clienteDuplicateConfirm";
import { FACTURA_CHANGED_EVENT, INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency, parseCurrencyDigits } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import type {
	AppSettings,
	CrearIngresoInput,
	ClienteYPaqueteCreado,
	PackagePaymentContext,
	PaqueteCliente,
} from "../../core/types";

export const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Transferencia"] as const;

export interface PaymentPrefill {
	citaId: string;
	pacienteNombre: string;
	pacienteDocumento: string;
	concepto: string;
	/** Precio sugerido según configuración del tipo de servicio (0 = no pre-llenar / sin referencia). */
	suggestedPrice?: number;
}

interface PaymentModalProps {
	open: boolean;
	prefill: PaymentPrefill | null;
	/** Cobro de plan (mutuamente excluyente con el flujo de cita en la misma apertura). */
	packageCheckout?: PackagePaymentContext | null;
	settings?: AppSettings;
	onClose: () => void;
	/** Solo flujo paquete: devuelve resultado y el mismo contexto de cobro (p. ej. tipo de servicio del plan). */
	onPackagePaymentSuccess?: (
		result: ClienteYPaqueteCreado | PaqueteCliente,
		ctx: PackagePaymentContext,
	) => void;
}

export function PaymentModal({
	open,
	prefill,
	packageCheckout = null,
	settings,
	onClose,
	onPackagePaymentSuccess,
}: PaymentModalProps) {
	const [monto, setMonto] = useState(0);
	const [metodoPago, setMetodoPago] = useState<string>(PAYMENT_METHODS[0]!);
	const [concepto, setConcepto] = useState("");
	const [pacienteDocumento, setPacienteDocumento] = useState("");
	const [generarFactura, setGenerarFactura] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isPackage = Boolean(packageCheckout);

	useEffect(() => {
		if (!open) return;
		if (packageCheckout) {
			setConcepto(packageCheckout.ingresoConcepto);
			setPacienteDocumento(packageCheckout.pacienteDocumento.trim());
			setMonto(
				Math.round(
					Number.isFinite(packageCheckout.expectedPrecioTotalConIva)
						? packageCheckout.expectedPrecioTotalConIva
						: 0,
				),
			);
			setMetodoPago(PAYMENT_METHODS[0]!);
			setGenerarFactura(false);
			setError(null);
			return;
		}
		if (prefill) {
			setConcepto(prefill.concepto);
			setPacienteDocumento(prefill.pacienteDocumento);
			const sp = prefill.suggestedPrice ?? 0;
			setMonto(sp > 0 ? Math.round(sp) : 0);
			setMetodoPago(PAYMENT_METHODS[0]!);
			setGenerarFactura(false);
			setError(null);
		}
	}, [open, prefill, packageCheckout]);

	if (!open) {
		return null;
	}
	if (!packageCheckout && !prefill) {
		return null;
	}

	const suggestedRef = isPackage
		? (packageCheckout!.expectedPrecioTotalConIva ?? 0)
		: (prefill!.suggestedPrice ?? 0);

	const showPriceMismatch = suggestedRef > 0 && monto > 0 && Math.abs(monto - suggestedRef) > 0.009;

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (monto <= 0) {
			setError("Indique un monto válido mayor que cero.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			if (packageCheckout) {
				const common = {
					serviceType: packageCheckout.serviceType,
					totalSesiones: packageCheckout.totalSesiones,
					precioTotal: monto,
					metodoPago,
					expiresAt: null,
					ingresoConcepto: concepto.trim() || packageCheckout.ingresoConcepto,
				};
				if (packageCheckout.nuevoCliente) {
					const res = await crearClienteYPaqueteRespectingDuplicateNameConfirm({
						cliente: packageCheckout.nuevoCliente,
						...common,
					});
					onPackagePaymentSuccess?.(res, packageCheckout);
				} else {
					const cid = packageCheckout.clienteId?.trim();
					if (!cid) {
						setError("Falta el cliente para registrar el plan.");
						setBusy(false);
						return;
					}
					const paquete = await crearPaquete({
						clienteId: cid,
						...common,
					});
					onPackagePaymentSuccess?.(paquete, packageCheckout);
				}
				window.dispatchEvent(new CustomEvent(INGRESO_REGISTRADO_EVENT));
				onClose();
				return;
			}

			if (!prefill) return;

			if (generarFactura) {
				const ivaDefault = settings?.billing?.ivaDefaultPct ?? 19;
				const borrador = await guardarBorradorFactura({
					clienteNombre: prefill.pacienteNombre.trim(),
					clienteDocumentoTipo: settings?.defaultDocumentType ?? "CC",
					clienteDocumentoNumero: pacienteDocumento.trim(),
					notas: "",
					citaId: prefill.citaId || null,
					lineas: [
						{
							descripcion: concepto.trim(),
							cantidad: 1,
							precioUnitario: monto,
							tasaImpuestoPct: ivaDefault,
						},
					],
				});
				await emitirFactura({
					facturaId: borrador.id,
					metodoPago,
					crearIngreso: true,
				});
				window.dispatchEvent(new CustomEvent(FACTURA_CHANGED_EVENT));
			} else {
				const input: CrearIngresoInput = {
					citaId: prefill.citaId || null,
					pacienteNombre: prefill.pacienteNombre.trim(),
					pacienteDocumento: pacienteDocumento.trim(),
					concepto: concepto.trim(),
					monto,
					metodoPago,
				};
				await crearIngreso(input);
			}
			window.dispatchEvent(new CustomEvent(INGRESO_REGISTRADO_EVENT));
			onClose();
		} catch (err) {
			setError(formatInvokeError(err) || "No se pudo registrar el pago");
		} finally {
			setBusy(false);
		}
	}

	const pacienteNombreMostrar = isPackage
		? packageCheckout!.pacienteNombre.trim()
		: prefill!.pacienteNombre.trim();

	return (
		<div
			className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="payment-modal-title"
		>
			<div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
				<h2 id="payment-modal-title" className="text-lg font-semibold text-slate-800">
					{isPackage ? "Cobrar plan de sesiones" : "Registrar pago"}
				</h2>
				<p className="mt-1 text-xs text-slate-500">
					{isPackage
						? "Confirme el monto (con IVA) y el método de pago. Puede ajustar concepto o documento si hace falta."
						: "Cita completada — complete el ingreso. Puede ajustar concepto o documento si hace falta."}
				</p>
				{pacienteNombreMostrar ? (
					<p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
						<span className="font-medium text-slate-600">Cliente: </span>
						{pacienteNombreMostrar}
					</p>
				) : null}
				<form className="mt-4 space-y-3" onSubmit={handleSubmit}>
					<div>
						<label className="block text-xs font-medium text-slate-600">Concepto</label>
						<input
							type="text"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={concepto}
							onChange={(e) => setConcepto(e.target.value)}
							required
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-slate-600">Documento paciente</label>
						<input
							type="text"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={pacienteDocumento}
							onChange={(e) => setPacienteDocumento(e.target.value)}
							required
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-slate-600">Monto</label>
						<input
							type="text"
							inputMode="numeric"
							autoComplete="off"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
							value={monto === 0 ? "" : formatCurrency(monto)}
							onChange={(e) => setMonto(parseCurrencyDigits(e.target.value))}
							placeholder="$ 0"
							required
							aria-describedby={showPriceMismatch ? "payment-monto-advertencia" : undefined}
						/>
						{showPriceMismatch ? (
							<p
								id="payment-monto-advertencia"
								className="mt-1.5 text-sm text-amber-800"
								role="status"
								aria-live="polite"
							>
								⚠️ El valor ingresado difiere del total esperado de {formatCurrency(suggestedRef)}.
								¿Confirma que es correcto?
							</p>
						) : null}
					</div>
					<div>
						<label className="block text-xs font-medium text-slate-600">Método de pago</label>
						<select
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={metodoPago}
							onChange={(e) => setMetodoPago(e.target.value)}
						>
							{PAYMENT_METHODS.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</div>
					{!isPackage ? (
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={generarFactura}
								onChange={(e) => setGenerarFactura(e.target.checked)}
							/>
							<span className="text-slate-700">Generar documento de venta (factura)</span>
						</label>
					) : null}
					{error ? (
						<p className="text-sm text-red-600" role="alert">
							{error}
						</p>
					) : null}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							onClick={onClose}
							disabled={busy}
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
							disabled={busy}
						>
							{busy ? "Guardando…" : isPackage ? "Confirmar cobro" : "Registrar pago"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
