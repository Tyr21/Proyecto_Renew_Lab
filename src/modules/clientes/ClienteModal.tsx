import { useEffect, useState } from "react";
import { actualizarCliente, crearCliente } from "../../core/api";
import { formatInvokeError } from "../../core/errors";
import type { AppSettings, Cliente, ClienteInput } from "../../core/types";

interface ClienteModalProps {
	open: boolean;
	settings: AppSettings;
	mode: "create" | "edit";
	initial: Cliente | null;
	onClose: () => void;
	onSaved: (cliente: Cliente) => void;
}

const MESES = [
	"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
	"Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function ClienteModal({
	open,
	settings,
	mode,
	initial,
	onClose,
	onSaved,
}: ClienteModalProps) {
	const [nombres, setNombres] = useState("");
	const [apellidos, setApellidos] = useState("");
	const [documentType, setDocumentType] = useState(settings.defaultDocumentType);
	const [documentNumber, setDocumentNumber] = useState("");
	const [phoneDialCode, setPhoneDialCode] = useState("+57");
	const [phoneNationalNumber, setPhoneNationalNumber] = useState("");
	const [email, setEmail] = useState("");
	const [birthdayMonth, setBirthdayMonth] = useState<number | null>(null);
	const [notas, setNotas] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		if (mode === "edit" && initial) {
			setNombres(initial.nombres);
			setApellidos(initial.apellidos);
			setDocumentType(initial.documentType);
			setDocumentNumber(initial.documentNumber);
			setPhoneDialCode(initial.phoneDialCode || "+57");
			setPhoneNationalNumber(initial.phoneNationalNumber);
			setEmail(initial.email);
			setBirthdayMonth(initial.birthdayMonth);
			setNotas(initial.notas);
		} else {
			setNombres("");
			setApellidos("");
			setDocumentType(settings.defaultDocumentType);
			setDocumentNumber("");
			setPhoneDialCode("+57");
			setPhoneNationalNumber("");
			setEmail("");
			setBirthdayMonth(null);
			setNotas("");
		}
		setError(null);
	}, [open, mode, initial, settings.defaultDocumentType]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSaving(true);
		const input: ClienteInput = {
			nombres: nombres.trim(),
			apellidos: apellidos.trim(),
			documentType: documentType.trim(),
			documentNumber: documentNumber.trim(),
			phoneDialCode: phoneDialCode.trim(),
			phoneNationalNumber: phoneNationalNumber.trim(),
			email: email.trim(),
			birthdayMonth,
			notas: notas.trim(),
		};
		try {
			let saved: Cliente;
			if (mode === "create") {
				saved = await crearCliente(input);
			} else {
				saved = await actualizarCliente(initial!.id, input);
			}
			onSaved(saved);
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudo guardar el cliente");
		} finally {
			setSaving(false);
		}
	}

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-cliente-title"
		>
			<div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
				<h2
					id="modal-cliente-title"
					className="text-base font-semibold text-slate-800 mb-4"
				>
					{mode === "create" ? "Crear cliente" : "Editar cliente"}
				</h2>

				{error ? (
					<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
						{error}
					</div>
				) : null}

				<form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
					{/* Nombres y Apellidos */}
					<div className="grid grid-cols-2 gap-3">
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">
								Nombres <span className="text-red-500">*</span>
							</span>
							<input
								type="text"
								value={nombres}
								onChange={(e) => setNombres(e.target.value)}
								required
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								placeholder="Ej: Juan Carlos"
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">
								Apellidos <span className="text-red-500">*</span>
							</span>
							<input
								type="text"
								value={apellidos}
								onChange={(e) => setApellidos(e.target.value)}
								required
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								placeholder="Ej: Pérez García"
							/>
						</label>
					</div>

					{/* Documento */}
					<div className="grid grid-cols-3 gap-3">
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">
								Tipo doc. <span className="text-red-500">*</span>
							</span>
							<select
								value={documentType}
								onChange={(e) => setDocumentType(e.target.value)}
								required
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
							>
								{settings.documentTypes.map((dt) => (
									<option key={dt} value={dt}>
										{dt}
									</option>
								))}
							</select>
						</label>
						<label className="col-span-2 flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">
								Número de documento <span className="text-red-500">*</span>
							</span>
							<input
								type="text"
								value={documentNumber}
								onChange={(e) => setDocumentNumber(e.target.value)}
								required
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								placeholder="Ej: 1234567890"
							/>
						</label>
					</div>

					{/* Teléfono */}
					<div className="grid grid-cols-3 gap-3">
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">Código país</span>
							<input
								type="text"
								value={phoneDialCode}
								onChange={(e) => setPhoneDialCode(e.target.value)}
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								placeholder="+57"
							/>
						</label>
						<label className="col-span-2 flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">Teléfono</span>
							<input
								type="tel"
								value={phoneNationalNumber}
								onChange={(e) => setPhoneNationalNumber(e.target.value)}
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								placeholder="3001234567"
							/>
						</label>
					</div>

					{/* Email y Mes de cumpleaños */}
					<div className="grid grid-cols-2 gap-3">
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">Email</span>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
								placeholder="correo@ejemplo.com"
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-xs font-medium text-slate-700">
								Mes de cumpleaños
							</span>
							<select
								value={birthdayMonth ?? ""}
								onChange={(e) =>
									setBirthdayMonth(e.target.value ? Number(e.target.value) : null)
								}
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
							>
								<option value="">— Sin especificar —</option>
								{MESES.map((mes, i) => (
									<option key={i + 1} value={i + 1}>
										{mes}
									</option>
								))}
							</select>
						</label>
					</div>

					{/* Notas */}
					<label className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-700">Notas</span>
						<textarea
							value={notas}
							onChange={(e) => setNotas(e.target.value)}
							rows={3}
							className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
							placeholder="Observaciones, alergias, preferencias…"
						/>
					</label>

					{/* Botones */}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							disabled={saving}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={saving}
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40"
						>
							{saving ? "Guardando…" : mode === "create" ? "Crear cliente" : "Guardar cambios"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
