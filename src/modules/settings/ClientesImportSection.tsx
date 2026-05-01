import { useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { importarClientesDesdeXlsx } from "../../core/api";
import { CLIENTE_APELLIDO_PLACEHOLDER } from "../../core/constants";
import { formatInvokeError } from "../../core/errors";
import { logger } from "../../core/logger";
import type { ClientesImportResult } from "../../core/types";

interface ClientesImportSectionProps {
	adminModeActive: boolean;
}

export function ClientesImportSection({ adminModeActive }: ClientesImportSectionProps) {
	const [pickPath, setPickPath] = useState<string | null>(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [adminPwd, setAdminPwd] = useState("");
	const [busy, setBusy] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [result, setResult] = useState<ClientesImportResult | null>(null);

	function startImport(path: string) {
		setPickPath(path);
		setFormError(null);
		setAdminPwd("");
		setConfirmOpen(true);
	}

	async function handlePickFile() {
		try {
			const picked = await openFileDialog({
				multiple: false,
				directory: false,
				title: "Seleccione un libro Excel (.xlsx) con clientes",
				filters: [{ name: "Excel", extensions: ["xlsx"] }],
			});
			if (!picked) return;
			const path = typeof picked === "string" ? picked : null;
			if (!path) return;
			startImport(path);
		} catch (e) {
			void logger.invokeError("clientesImport.pickFile", e);
			setFormError(formatInvokeError(e) || "No se pudo abrir el diálogo de archivos");
		}
	}

	async function confirmImport() {
		if (!pickPath) return;
		const trimmed = adminPwd.trim();
		if (!trimmed) {
			setFormError("Indique la contraseña de administrador");
			return;
		}
		setFormError(null);
		setBusy(true);
		try {
			const res = await importarClientesDesdeXlsx(pickPath, trimmed);
			setConfirmOpen(false);
			setAdminPwd("");
			setPickPath(null);
			setResult(res);
		} catch (e) {
			void logger.invokeError("clientesImport.import", e);
			setFormError(formatInvokeError(e) || "No se pudo importar el archivo");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="mt-8 border-t border-amber-200/80 pt-6">
			<h3 className="text-sm font-medium text-amber-900">Importar clientes (Excel)</h3>
			<p className="mt-1 text-xs text-amber-800/95">
				Añade fichas desde un archivo <span className="font-mono">.xlsx</span> (primera hoja). Los
				tipos de documento deben coincidir con los configurados en la aplicación (p. ej. CC, CE, TI,
				NIT). El número de documento no puede repetirse: las filas con documento ya existente se
				omiten.
			</p>
			<details className="mt-3 rounded-lg border border-amber-100 bg-white/60 px-3 py-2 text-xs text-slate-700">
				<summary className="cursor-pointer font-medium text-slate-800">Formato de columnas</summary>
				<p className="mt-2 text-slate-600">
					Fila 1: encabezados. Filas siguientes: un cliente por fila. Columnas obligatorias (el
					nombre puede variar; se reconocen sin tildes y en mayúsculas/minúsculas):
				</p>
				<ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
					<li>
						<span className="font-mono">nombres</span> (o nombre, first_name)
					</li>
					<li>
						<span className="font-mono">apellidos</span> (o apellido, last_name). Si en su lista solo
						hay un apellido o un solo campo de nombre, puede usar un punto «{CLIENTE_APELLIDO_PLACEHOLDER}
						» como apellido y editar la ficha después.
					</li>
					<li>
						<span className="font-mono">tipo_documento</span> (o document_type, tipo_doc)
					</li>
					<li>
						<span className="font-mono">numero_documento</span> (o document_number, documento, cedula,
						nit…)
					</li>
				</ul>
				<p className="mt-2 text-slate-600">Opcionales:</p>
				<ul className="mt-1 list-inside list-disc space-y-1 text-slate-600">
					<li>
						<span className="font-mono">codigo_telefono</span> / indicativo;{" "}
						<span className="font-mono">telefono</span> / celular (formatee el celular como texto en
						Excel si debe conservar ceros a la izquierda).
					</li>
					<li>
						<span className="font-mono">email</span> o correo
					</li>
					<li>
						<span className="font-mono">mes_cumpleanos</span>: número del 1 al 12
					</li>
					<li>
						<span className="font-mono">notas</span>, observaciones o comentarios
					</li>
				</ul>
			</details>

			{!adminModeActive ? (
				<div className="mt-3 rounded-lg border border-amber-300 bg-amber-100/50 px-3 py-2 text-xs text-amber-900">
					Active el modo administrador en esta pantalla y <strong>guarde la configuración</strong> antes
					de importar (la operación lo exige en el backend de la aplicación).
				</div>
			) : null}

			<div className="mt-4">
				<button
					type="button"
					disabled={!adminModeActive}
					onClick={() => void handlePickFile()}
					className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
				>
					Elegir archivo Excel (.xlsx)…
				</button>
			</div>

			{formError && !confirmOpen ? (
				<div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
			) : null}

			{result ? (
				<div
					className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
					role="status"
				>
					<p className="font-medium text-slate-900">Última importación</p>
					<ul className="mt-2 space-y-1 text-xs text-slate-700">
						<li>Importados: {result.imported}</li>
						<li>Omitidos (documento duplicado en el archivo): {result.skippedDuplicateInFile}</li>
						<li>Omitidos (documento ya en la aplicación): {result.skippedExistingInDb}</li>
						<li>Omitidos u otros errores: {result.skippedInvalid}</li>
					</ul>
					{result.errors.length > 0 ? (
						<div className="mt-3 max-h-40 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2 text-xs">
							<p className="font-medium text-slate-800">Primeros avisos (por fila de Excel)</p>
							<ul className="mt-1 space-y-1">
								{result.errors.map((err, i) => (
									<li key={`${err.rowNumber}-${i}`}>
										Fila {err.rowNumber}: {err.message}
									</li>
								))}
							</ul>
						</div>
					) : null}
					<button
						type="button"
						className="mt-3 text-xs font-medium text-amber-800 hover:underline"
						onClick={() => setResult(null)}
					>
						Cerrar resumen
					</button>
				</div>
			) : null}

			{confirmOpen ? (
				<div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
					<div
						className="w-full max-w-md rounded-xl border border-amber-300 bg-white p-5 shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="clientes-import-confirm-title"
					>
						<h2 id="clientes-import-confirm-title" className="text-base font-semibold text-amber-900">
							Confirmar importación
						</h2>
						<p className="mt-2 text-sm text-slate-700">
							Se añadirán clientes nuevos desde el archivo seleccionado. Las filas con errores o
							documentos repetidos no se crearán.
						</p>
						{pickPath ? (
							<p className="mt-2 break-all font-mono text-xs text-slate-600">{pickPath}</p>
						) : null}
						{formError ? (
							<div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
						) : null}
						<label className="mt-4 block text-sm">
							<span className="font-medium text-slate-700">Contraseña de administrador</span>
							<input
								type="password"
								autoComplete="current-password"
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={adminPwd}
								onChange={(e) => setAdminPwd(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										void confirmImport();
									}
								}}
								autoFocus
							/>
						</label>
						<div className="mt-5 flex flex-wrap gap-2">
							<button
								type="button"
								disabled={busy}
								onClick={() => void confirmImport()}
								className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
							>
								{busy ? "Importando…" : "Importar"}
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => {
									setConfirmOpen(false);
									setPickPath(null);
									setAdminPwd("");
									setFormError(null);
								}}
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Cancelar
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
