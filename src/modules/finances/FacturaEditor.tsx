import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { buscarClientes, guardarBorradorFactura, emitirFactura } from "../../core/api";
import { FACTURA_CHANGED_EVENT, INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import { formatCurrency, parseCurrencyDigits } from "../../core/currencyFormat";
import { formatInvokeError } from "../../core/errors";
import { calcFacturaTotals } from "../../core/facturaTotals";
import type { AppSettings, Cliente, Factura, FacturaLineaInput } from "../../core/types";
import { FacturaPrintView } from "./FacturaPrintView";

const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Transferencia"] as const;

function emptyLinea(iva: number): FacturaLineaInput {
	return { descripcion: "", cantidad: 1, precioUnitario: 0, tasaImpuestoPct: iva };
}

interface FacturaEditorProps {
	settings: AppSettings;
	factura: Factura | null;
	onClose: () => void;
}

export function FacturaEditor({ settings, factura, onClose }: FacturaEditorProps) {
	const defaultIva = settings.billing?.ivaDefaultPct ?? 19;
	const isNew = !factura;
	const readonly = factura?.estado !== "borrador" && !isNew;

	const [clienteNombre, setClienteNombre] = useState("");
	const [clienteDocTipo, setClienteDocTipo] = useState(settings.defaultDocumentType);
	const [clienteDocNumero, setClienteDocNumero] = useState("");
	const [notas, setNotas] = useState("");
	const [lineas, setLineas] = useState<FacturaLineaInput[]>([emptyLinea(defaultIva)]);
	const [metodoPago, setMetodoPago] = useState<string>(PAYMENT_METHODS[0]);
	const [crearIngreso, setCrearIngreso] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showPrint, setShowPrint] = useState(false);

	const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
	const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function buscarYMostrar(query: string) {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!query.trim()) {
			setSugerencias([]);
			setMostrarSugerencias(false);
			return;
		}
		debounceRef.current = setTimeout(() => {
			buscarClientes(query.trim())
				.then((found) => {
					setSugerencias(found);
					setMostrarSugerencias(found.length > 0);
				})
				.catch(() => {});
		}, 200);
	}

	function seleccionarCliente(c: Cliente) {
		setClienteNombre(`${c.nombres} ${c.apellidos}`);
		setClienteDocTipo(c.documentType);
		setClienteDocNumero(c.documentNumber);
		setSugerencias([]);
		setMostrarSugerencias(false);
	}

	useEffect(() => {
		if (!factura) return;
		setClienteNombre(factura.clienteNombre);
		setClienteDocTipo(factura.clienteDocumentoTipo);
		setClienteDocNumero(factura.clienteDocumentoNumero);
		setNotas(factura.notas);
		if (factura.lineas.length > 0) {
			setLineas(
				factura.lineas.map((l) => ({
					descripcion: l.descripcion,
					cantidad: l.cantidad,
					precioUnitario: l.precioUnitario,
					tasaImpuestoPct: l.tasaImpuestoPct,
				})),
			);
		}
	}, [factura]);

	const totals = calcFacturaTotals(lineas);

	const updateLinea = useCallback((idx: number, patch: Partial<FacturaLineaInput>) => {
		setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
	}, []);

	const removeLinea = useCallback((idx: number) => {
		setLineas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
	}, []);

	const addLinea = useCallback(() => {
		setLineas((prev) => [...prev, emptyLinea(defaultIva)]);
	}, [defaultIva]);

	async function handleSaveDraft(e: FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await guardarBorradorFactura({
				id: factura?.id,
				clienteNombre: clienteNombre.trim(),
				clienteDocumentoTipo: clienteDocTipo.trim(),
				clienteDocumentoNumero: clienteDocNumero.trim(),
				notas: notas.trim(),
				lineas,
			});
			window.dispatchEvent(new CustomEvent(FACTURA_CHANGED_EVENT));
			onClose();
		} catch (err) {
			setError(formatInvokeError(err) || "No se pudo guardar el borrador");
		} finally {
			setBusy(false);
		}
	}

	async function handleEmit() {
		setBusy(true);
		setError(null);
		try {
			let targetId = factura?.id;
			if (!targetId || factura?.estado === "borrador") {
				const saved = await guardarBorradorFactura({
					id: factura?.id,
					clienteNombre: clienteNombre.trim(),
					clienteDocumentoTipo: clienteDocTipo.trim(),
					clienteDocumentoNumero: clienteDocNumero.trim(),
					notas: notas.trim(),
					lineas,
				});
				targetId = saved.id;
			}
			await emitirFactura({
				facturaId: targetId,
				metodoPago,
				crearIngreso,
			});
			window.dispatchEvent(new CustomEvent(FACTURA_CHANGED_EVENT));
			if (crearIngreso) {
				window.dispatchEvent(new CustomEvent(INGRESO_REGISTRADO_EVENT));
			}
			onClose();
		} catch (err) {
			setError(formatInvokeError(err) || "No se pudo emitir la factura");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="factura-editor-title"
		>
			<div className="my-6 w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
				<div className="flex items-center justify-between">
					<h2 id="factura-editor-title" className="text-lg font-semibold text-slate-800">
						{readonly
							? `Factura ${factura?.serie}-${factura?.numero ?? "—"}`
							: isNew
								? "Nueva factura"
								: "Editar borrador"}
					</h2>
					{factura?.estado ? (
						<span
							className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
								factura.estado === "emitida"
									? "bg-emerald-100 text-emerald-800"
									: factura.estado === "anulada"
										? "bg-red-100 text-red-800"
										: "bg-amber-100 text-amber-800"
							}`}
						>
							{factura.estado}
						</span>
					) : null}
				</div>

				<form onSubmit={handleSaveDraft} className="mt-4 space-y-4">
					{/* Datos cliente */}
					<fieldset disabled={readonly} className="grid grid-cols-1 gap-3 md:grid-cols-3">
						<div className="block text-sm">
							<span className="font-medium text-slate-600">Nombre cliente</span>
							<div className="relative mt-1">
								<input
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									value={clienteNombre}
									onChange={(e) => {
										setClienteNombre(e.target.value);
										buscarYMostrar(e.target.value);
									}}
									onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
									required
									autoComplete="off"
									placeholder="Buscar por nombre…"
								/>
								{mostrarSugerencias && sugerencias.length > 0 && (
									<div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
										{sugerencias.map((c) => (
											<button
												key={c.id}
												type="button"
												className="w-full px-3 py-2 text-left text-sm hover:bg-sky-50 border-b border-slate-100 last:border-0"
												onMouseDown={() => seleccionarCliente(c)}
											>
												<span className="font-medium text-slate-800">
													{c.apellidos}, {c.nombres}
												</span>
												<span className="ml-2 text-xs text-slate-500">
													{c.documentType} {c.documentNumber}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						</div>
						<label className="block text-sm">
							<span className="font-medium text-slate-600">Tipo doc.</span>
							<select
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={clienteDocTipo}
								onChange={(e) => setClienteDocTipo(e.target.value)}
							>
								{settings.documentTypes.map((t) => (
									<option key={t} value={t}>{t}</option>
								))}
							</select>
						</label>
						<div className="block text-sm">
							<span className="font-medium text-slate-600">Nro. documento</span>
							<div className="relative mt-1">
								<input
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									value={clienteDocNumero}
									onChange={(e) => {
										setClienteDocNumero(e.target.value);
										buscarYMostrar(e.target.value);
									}}
									onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
									required
									autoComplete="off"
									placeholder="Buscar por documento…"
								/>
								{mostrarSugerencias && sugerencias.length > 0 && (
									<div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
										{sugerencias.map((c) => (
											<button
												key={c.id}
												type="button"
												className="w-full px-3 py-2 text-left text-sm hover:bg-sky-50 border-b border-slate-100 last:border-0"
												onMouseDown={() => seleccionarCliente(c)}
											>
												<span className="font-medium text-slate-800">
													{c.documentType} {c.documentNumber}
												</span>
												<span className="ml-2 text-xs text-slate-500">
													{c.nombres} {c.apellidos}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					</fieldset>

					{/* Líneas */}
					<div>
						<div className="mb-2 flex items-center justify-between">
							<h3 className="text-sm font-medium text-slate-700">Líneas</h3>
							{!readonly ? (
								<button
									type="button"
									onClick={addLinea}
									className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
								>
									+ Añadir línea
								</button>
							) : null}
						</div>
						<div className="space-y-2">
							{lineas.map((l, i) => (
								<div
									key={i}
									className="grid grid-cols-12 gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2 items-end"
								>
									<label className="col-span-4 text-xs">
										<span className="text-slate-500">Servicio</span>
										<select
											className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
											value={l.descripcion}
											onChange={(e) => {
												const serviceId = e.target.value;
												const svc = settings.serviceTypes.find((s) => s.label === serviceId);
												updateLinea(i, {
													descripcion: serviceId,
													precioUnitario: svc ? svc.suggestedPrice : l.precioUnitario,
												});
											}}
											disabled={readonly}
											required
										>
											<option value="">— Seleccionar —</option>
											{settings.serviceTypes.map((s) => (
												<option key={s.id} value={s.label}>{s.label}</option>
											))}
										</select>
									</label>
									<label className="col-span-2 text-xs">
										<span className="text-slate-500">Cantidad</span>
										<input
											type="number"
											min={0.01}
											step="any"
											className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
											value={l.cantidad}
											onChange={(e) =>
												updateLinea(i, { cantidad: Math.max(0, Number(e.target.value) || 0) })
											}
											disabled={readonly}
											required
										/>
									</label>
									<label className="col-span-2 text-xs">
										<span className="text-slate-500">Precio unit.</span>
										<input
											type="text"
											inputMode="numeric"
											autoComplete="off"
											className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
											value={l.precioUnitario === 0 ? "" : formatCurrency(l.precioUnitario)}
											onChange={(e) =>
												updateLinea(i, { precioUnitario: parseCurrencyDigits(e.target.value) })
											}
											disabled={readonly}
										/>
									</label>
									<label className="col-span-2 text-xs">
										<span className="text-slate-500">IVA {defaultIva}%</span>
										<input
											type="text"
											className="mt-0.5 w-full rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm tabular-nums text-slate-500"
											value={`${defaultIva}%`}
											disabled
											title="El IVA se configura en Configuración → Facturación"
										/>
									</label>
									<div className="col-span-2 flex items-end gap-1">
										<span className="mb-1 text-sm font-medium tabular-nums text-slate-800">
											{formatCurrency(l.cantidad * l.precioUnitario * (1 + l.tasaImpuestoPct / 100))}
										</span>
										{!readonly && lineas.length > 1 ? (
											<button
												type="button"
												onClick={() => removeLinea(i)}
												className="mb-0.5 text-xs text-red-500 hover:text-red-700"
												aria-label={`Quitar línea ${i + 1}`}
											>
												✕
											</button>
										) : null}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Totales */}
					<div className="flex justify-end">
						<div className="w-56 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
							<div className="flex justify-between">
								<span className="text-slate-500">Subtotal</span>
								<span className="tabular-nums text-slate-800">{formatCurrency(totals.subtotal)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-slate-500">IVA</span>
								<span className="tabular-nums text-slate-800">
									{formatCurrency(totals.impuestoTotal)}
								</span>
							</div>
							<div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
								<span className="text-slate-700">Total</span>
								<span className="tabular-nums text-slate-900">{formatCurrency(totals.total)}</span>
							</div>
						</div>
					</div>

					{/* Notas */}
					<label className="block text-sm">
						<span className="font-medium text-slate-600">Notas</span>
						<textarea
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							rows={2}
							value={notas}
							onChange={(e) => setNotas(e.target.value)}
							disabled={readonly}
						/>
					</label>

					{/* Emisión (solo borrador) */}
					{!readonly ? (
						<fieldset className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 space-y-2">
							<legend className="px-1 text-xs font-medium text-sky-800">Opciones de emisión</legend>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={crearIngreso}
									onChange={(e) => setCrearIngreso(e.target.checked)}
								/>
								Registrar pago al emitir
							</label>
							{crearIngreso ? (
								<label className="block text-sm">
									<span className="text-slate-600">Método de pago</span>
									<select
										className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
										value={metodoPago}
										onChange={(e) => setMetodoPago(e.target.value)}
									>
										{PAYMENT_METHODS.map((m) => (
											<option key={m} value={m}>{m}</option>
										))}
									</select>
								</label>
							) : null}
						</fieldset>
					) : null}

					{error ? (
						<p className="text-sm text-red-600" role="alert">{error}</p>
					) : null}

					{/* Acciones */}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							onClick={onClose}
							disabled={busy}
						>
							{readonly ? "Cerrar" : "Cancelar"}
						</button>
						{readonly && factura?.numero ? (
							<button
								type="button"
								onClick={() => setShowPrint(true)}
								className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
							>
								Imprimir
							</button>
						) : null}
						{!readonly ? (
							<>
								<button
									type="submit"
									className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
									disabled={busy}
								>
									{busy ? "Guardando…" : "Guardar borrador"}
								</button>
								<button
									type="button"
									onClick={() => void handleEmit()}
									className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
									disabled={busy}
								>
									{busy ? "Emitiendo…" : "Emitir factura"}
								</button>
							</>
						) : null}
					</div>
				</form>
			</div>

			{showPrint && factura ? (
				<FacturaPrintView
					factura={factura}
					billing={settings.billing}
					onClose={() => setShowPrint(false)}
				/>
			) : null}
		</div>
	);
}
