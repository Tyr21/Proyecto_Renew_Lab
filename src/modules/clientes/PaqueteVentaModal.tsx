import { useEffect, useState } from "react";
import { crearClienteYPaquete, crearPaquete } from "../../core/api";
import { INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency, parseCurrencyDigits } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import type {
	AppSettings,
	ClienteInput,
	ClienteYPaqueteCreado,
	CrearPaqueteInput,
} from "../../core/types";

const METODOS = ["Efectivo", "Tarjeta", "Transferencia"] as const;

interface PaqueteVentaModalProps {
	open: boolean;
	settings: AppSettings;
	/** Cliente ya persistido; omitir si se usa `nuevoCliente`. */
	clienteId?: string | null;
	/** Datos para crear cliente y paquete en una sola operación. */
	nuevoCliente?: ClienteInput | null;
	/** Si existe en `settings.serviceTypes`, se preselecciona al abrir (p. ej. servicio de la cita). */
	preferredServiceType?: string | null;
	onClose: () => void;
	onCreated: () => void;
	/** Solo cuando el flujo usó `nuevoCliente`. */
	onCreatedWithCliente?: (payload: ClienteYPaqueteCreado) => void;
}

export function PaqueteVentaModal({
	open,
	settings,
	clienteId = null,
	nuevoCliente = null,
	preferredServiceType = null,
	onClose,
	onCreated,
	onCreatedWithCliente,
}: PaqueteVentaModalProps) {
	const [serviceType, setServiceType] = useState(
		settings.serviceTypes[0]?.id ?? "",
	);
	const [totalSesiones, setTotalSesiones] = useState("10");
	/** Precio de una sesión, antes de IVA (alineado con «precio sugerido» del tipo de servicio). */
	const [precioPorSesion, setPrecioPorSesion] = useState(0);
	const [metodoPago, setMetodoPago] = useState<string>(METODOS[0]!);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const esClienteNuevo = Boolean(nuevoCliente);
	const cid = clienteId?.trim() ?? "";

	useEffect(() => {
		if (!open) return;
		const pref = preferredServiceType?.trim();
		const st0 =
			pref && settings.serviceTypes.some((s) => s.id === pref)
				? settings.serviceTypes.find((s) => s.id === pref)!
				: settings.serviceTypes[0];
		setServiceType(st0?.id ?? "");
		setTotalSesiones("10");
		setPrecioPorSesion(
			st0 && st0.suggestedPrice > 0 ? Math.round(st0.suggestedPrice) : 0,
		);
		setMetodoPago(METODOS[0]!);
		setError(null);
	}, [open, settings.serviceTypes, preferredServiceType]);

	const nSesiones = Number.parseInt(totalSesiones, 10);
	const ivaPct = settings.billing?.ivaDefaultPct ?? 19;
	const nPack =
		Number.isFinite(nSesiones) && nSesiones >= 1 ? nSesiones : 0;
	const subtotalSinIva =
		nPack > 0 && precioPorSesion > 0 ? precioPorSesion * nPack : 0;
	const montoIva = Math.round(subtotalSinIva * (ivaPct / 100));
	const totalesPaquete = {
		n: nPack,
		base: subtotalSinIva,
		iva: montoIva,
		conIva: subtotalSinIva + montoIva,
	};

	if (!open) return null;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const n = Number.parseInt(totalSesiones, 10);
		if (!Number.isFinite(n) || n < 1) {
			setError("Indique un número válido de sesiones (≥ 1).");
			return;
		}
		if (!Number.isFinite(precioPorSesion) || precioPorSesion <= 0) {
			setError("Indique un precio por sesión válido (antes de IVA).");
			return;
		}
		const precio = totalesPaquete.conIva;
		if (precio <= 0) {
			setError("No se pudo calcular el total del plan.");
			return;
		}
		if (esClienteNuevo) {
			if (!nuevoCliente) {
				setError("Faltan datos del cliente.");
				return;
			}
			setBusy(true);
			try {
				const res = await crearClienteYPaquete({
					cliente: nuevoCliente,
					serviceType,
					totalSesiones: n,
					precioTotal: precio,
					metodoPago,
					expiresAt: null,
				});
				window.dispatchEvent(new CustomEvent(INGRESO_REGISTRADO_EVENT));
				onCreatedWithCliente?.(res);
				onCreated();
				onClose();
			} catch (err) {
				setError(formatInvokeError(err) || "No se pudo registrar paciente y plan");
			} finally {
				setBusy(false);
			}
			return;
		}

		if (!cid) {
			setError("Faltan datos del cliente.");
			return;
		}
		const input: CrearPaqueteInput = {
			clienteId: cid,
			serviceType,
			totalSesiones: n,
			precioTotal: precio,
			metodoPago,
			expiresAt: null,
		};
		setBusy(true);
		try {
			await crearPaquete(input);
			window.dispatchEvent(new CustomEvent(INGRESO_REGISTRADO_EVENT));
			onCreated();
			onClose();
		} catch (err) {
			setError(formatInvokeError(err) || "No se pudo registrar el plan");
		} finally {
			setBusy(false);
		}
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
					{esClienteNuevo
						? "Registrar paciente y vender plan"
						: "Vender plan de sesiones"}
				</h2>
				{esClienteNuevo && nuevoCliente ? (
					<div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
						<p className="font-medium text-slate-800">
							Paciente nuevo (se creará la ficha al guardar)
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
				<form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
					<label className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-700">Servicio</span>
						<select
							value={serviceType}
							onChange={(e) => {
								const id = e.target.value;
								setServiceType(id);
								const st = settings.serviceTypes.find((s) => s.id === id);
								if (st && st.suggestedPrice > 0) {
									setPrecioPorSesion(Math.round(st.suggestedPrice));
								}
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
					<div className="grid grid-cols-2 gap-3">
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">
								Nº sesiones
							</span>
							<input
								type="number"
								min={1}
								value={totalSesiones}
								onChange={(e) => setTotalSesiones(e.target.value)}
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
								required
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">
								Precio por sesión (antes de IVA)
							</span>
							<input
								type="text"
								inputMode="numeric"
								autoComplete="off"
								value={
									precioPorSesion === 0
										? ""
										: formatCurrency(precioPorSesion)
								}
								onChange={(e) =>
									setPrecioPorSesion(parseCurrencyDigits(e.target.value))
								}
								placeholder="$ 0"
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
								required
							/>
						</label>
					</div>
					<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs space-y-1.5">
						<div className="flex justify-between gap-2 text-slate-700">
							<span>
								Total antes de IVA
								{totalesPaquete.n > 0 && precioPorSesion > 0 ? (
									<span className="text-slate-500">
										{" "}
										({totalesPaquete.n} × {formatCurrency(precioPorSesion)})
									</span>
								) : null}
							</span>
							<span className="tabular-nums font-medium text-slate-800 shrink-0">
								{formatCurrency(totalesPaquete.base)}
							</span>
						</div>
						<div className="flex justify-between gap-2 text-slate-600">
							<span>IVA ({ivaPct}%)</span>
							<span className="tabular-nums shrink-0">
								{formatCurrency(totalesPaquete.iva)}
							</span>
						</div>
						<div className="flex justify-between gap-2 border-t border-slate-200 pt-1.5 text-slate-800 font-semibold">
							<span>Total a cobrar (con IVA)</span>
							<span className="tabular-nums shrink-0">
								{formatCurrency(totalesPaquete.conIva)}
							</span>
						</div>
						<p className="text-[0.65rem] text-slate-500 pt-0.5 leading-snug">
							El cobro del plan se guarda como ingreso por el total con IVA; las
							citas podrán enlazarse a este plan para descontar sesiones.
						</p>
					</div>
					<label className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-700">
							Método de pago
						</span>
						<select
							value={metodoPago}
							onChange={(e) => setMetodoPago(e.target.value)}
							className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
						>
							{METODOS.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</label>
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							disabled={busy}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={busy}
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40"
						>
							{busy
								? "Guardando…"
								: esClienteNuevo
									? "Guardar paciente, plan e ingreso"
									: "Guardar plan e ingreso"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
