import { type FormEvent, useEffect, useState } from "react";
import { crearIngreso } from "../../core/api";
import { INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency, parseCurrencyDigits } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import type { CrearIngresoInput } from "../../core/types";

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
	onClose: () => void;
}

export function PaymentModal({ open, prefill, onClose }: PaymentModalProps) {
	const [monto, setMonto] = useState(0);
	const [metodoPago, setMetodoPago] = useState<string>(PAYMENT_METHODS[0]!);
	const [concepto, setConcepto] = useState("");
	const [pacienteDocumento, setPacienteDocumento] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !prefill) return;
		setConcepto(prefill.concepto);
		setPacienteDocumento(prefill.pacienteDocumento);
		const sp = prefill.suggestedPrice ?? 0;
		setMonto(sp > 0 ? Math.round(sp) : 0);
		setMetodoPago(PAYMENT_METHODS[0]!);
		setError(null);
	}, [open, prefill]);

	if (!open || !prefill) {
		return null;
	}

	const suggestedRef = prefill.suggestedPrice ?? 0;
	const showPriceMismatch =
		suggestedRef > 0 &&
		monto > 0 &&
		Math.abs(monto - suggestedRef) > 0.009;

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!prefill) {
			return;
		}
		if (monto <= 0) {
			setError("Indique un monto válido mayor que cero.");
			return;
		}
		setBusy(true);
		setError(null);
		const input: CrearIngresoInput = {
			citaId: prefill.citaId || null,
			pacienteNombre: prefill.pacienteNombre.trim(),
			pacienteDocumento: pacienteDocumento.trim(),
			concepto: concepto.trim(),
			monto,
			metodoPago,
		};
		try {
			await crearIngreso(input);
			window.dispatchEvent(new CustomEvent(INGRESO_REGISTRADO_EVENT));
			onClose();
		} catch (err) {
			setError(formatInvokeError(err) || "No se pudo registrar el pago");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="payment-modal-title"
		>
			<div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
				<h2
					id="payment-modal-title"
					className="text-lg font-semibold text-slate-800"
				>
					Registrar pago
				</h2>
				<p className="mt-1 text-xs text-slate-500">
					Cita completada — complete el ingreso. Puede ajustar concepto o
					documento si hace falta.
				</p>
				{prefill.pacienteNombre.trim() ? (
					<p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
						<span className="font-medium text-slate-600">Cliente: </span>
						{prefill.pacienteNombre.trim()}
					</p>
				) : null}
				<form className="mt-4 space-y-3" onSubmit={handleSubmit}>
					<div>
						<label className="block text-xs font-medium text-slate-600">
							Concepto
						</label>
						<input
							type="text"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={concepto}
							onChange={(e) => setConcepto(e.target.value)}
							required
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-slate-600">
							Documento paciente
						</label>
						<input
							type="text"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={pacienteDocumento}
							onChange={(e) => setPacienteDocumento(e.target.value)}
							required
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-slate-600">
							Monto
						</label>
						<input
							type="text"
							inputMode="numeric"
							autoComplete="off"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
							value={monto === 0 ? "" : formatCurrency(monto)}
							onChange={(e) =>
								setMonto(parseCurrencyDigits(e.target.value))
							}
							placeholder="$ 0"
							required
							aria-describedby={
								showPriceMismatch ? "payment-monto-advertencia" : undefined
							}
						/>
						{showPriceMismatch ? (
							<p
								id="payment-monto-advertencia"
								className="mt-1.5 text-sm text-amber-800"
								role="status"
								aria-live="polite"
							>
								⚠️ El valor ingresado difiere del precio sugerido de{" "}
								{formatCurrency(suggestedRef)}. ¿Confirmas que es correcto?
							</p>
						) : null}
					</div>
					<div>
						<label className="block text-xs font-medium text-slate-600">
							Método de pago
						</label>
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
							{busy ? "Guardando…" : "Registrar pago"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
