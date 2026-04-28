import { useCallback, useEffect, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { listarRespaldosLocales, restaurarRespaldo } from "../../core/api";
import { BACKUP_FILE_EXTENSION, BACKUP_FILE_PREFIX } from "../../core/constants";
import { formatInvokeError } from "../../core/errors";
import { logger } from "../../core/logger";
import type { BackupFileInfo } from "../../core/types";

interface BackupRestoreSectionProps {
	/** El modo administrador es obligatorio en el draft para usar esta sección. */
	adminModeActive: boolean;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

function formatSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	const formatted = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
	return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}

function formatDateTime(iso: string): string {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString("es-CO", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function isPlausibleBackupName(name: string): boolean {
	const lower = name.toLowerCase();
	return lower.startsWith(BACKUP_FILE_PREFIX) && lower.endsWith(`.${BACKUP_FILE_EXTENSION}`);
}

function basename(fullPath: string): string {
	const sep = fullPath.lastIndexOf("\\") >= 0 ? "\\" : "/";
	const idx = fullPath.lastIndexOf(sep);
	return idx >= 0 ? fullPath.slice(idx + 1) : fullPath;
}

export function BackupRestoreSection({ adminModeActive }: BackupRestoreSectionProps) {
	const [items, setItems] = useState<BackupFileInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [listError, setListError] = useState<string | null>(null);
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [externalLabel, setExternalLabel] = useState<string | null>(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [adminPwd, setAdminPwd] = useState("");
	const [restoreError, setRestoreError] = useState<string | null>(null);
	const [restoreBusy, setRestoreBusy] = useState(false);
	const [doneOpen, setDoneOpen] = useState(false);

	const refreshList = useCallback(async () => {
		setLoading(true);
		setListError(null);
		try {
			const data = await listarRespaldosLocales();
			setItems(data);
		} catch (e) {
			void logger.invokeError("backup.list", e);
			setListError(formatInvokeError(e) || "No se pudieron listar los respaldos");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refreshList();
	}, [refreshList]);

	function startRestore(path: string, displayLabel: string | null) {
		setSelectedPath(path);
		setExternalLabel(displayLabel);
		setRestoreError(null);
		setAdminPwd("");
		setConfirmOpen(true);
	}

	async function handlePickExternalFile() {
		try {
			const picked = await openFileDialog({
				multiple: false,
				directory: false,
				title: "Seleccione un respaldo consultorio_*.db",
				filters: [
					{
						name: "Respaldo SQLite Renew Lab",
						extensions: [BACKUP_FILE_EXTENSION],
					},
				],
			});
			if (!picked) return;
			const path = typeof picked === "string" ? picked : null;
			if (!path) return;
			const name = basename(path);
			if (!isPlausibleBackupName(name)) {
				setListError(
					`El archivo «${name}» no parece un respaldo válido (nombre debe comenzar por «${BACKUP_FILE_PREFIX}» y terminar en «.${BACKUP_FILE_EXTENSION}»).`,
				);
				return;
			}
			setListError(null);
			startRestore(path, name);
		} catch (e) {
			void logger.invokeError("backup.pickFile", e);
			setListError(formatInvokeError(e) || "No se pudo abrir el diálogo de archivos");
		}
	}

	async function confirmRestore() {
		if (!selectedPath) return;
		const trimmed = adminPwd.trim();
		if (!trimmed) {
			setRestoreError("Indique la contraseña de administrador");
			return;
		}
		setRestoreError(null);
		setRestoreBusy(true);
		try {
			await restaurarRespaldo(selectedPath, trimmed);
			setConfirmOpen(false);
			setAdminPwd("");
			setSelectedPath(null);
			setExternalLabel(null);
			setDoneOpen(true);
		} catch (e) {
			void logger.invokeError("backup.restore", e);
			setRestoreError(formatInvokeError(e) || "No se pudo restaurar el respaldo");
		} finally {
			setRestoreBusy(false);
		}
	}

	async function handleCloseAppAfterRestore() {
		try {
			const { getCurrentWindow } = await import("@tauri-apps/api/window");
			await getCurrentWindow().destroy();
		} catch (e) {
			void logger.error(
				`No se pudo cerrar la ventana tras restaurar respaldo: ${formatInvokeError(e)}`,
				{ target: "backup.restoreClose" },
			);
			setDoneOpen(false);
		}
	}

	return (
		<div className="border-t border-slate-100 pt-5">
			<h3 className="text-sm font-medium text-slate-700">Restaurar desde respaldo</h3>
			<p className="mt-0.5 text-xs text-slate-500">
				Reemplaza la base de datos activa con una copia previa. Esta operación es destructiva y solo
				está disponible con el modo administrador activo.
			</p>

			{!adminModeActive ? (
				<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
					Active primero el modo administrador en Configuración → Administración para restaurar un
					respaldo.
				</div>
			) : null}

			<div className="mt-4 flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() => void refreshList()}
					disabled={loading}
					className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
				>
					{loading ? "Actualizando…" : "Actualizar lista"}
				</button>
				<button
					type="button"
					onClick={() => void handlePickExternalFile()}
					disabled={!adminModeActive}
					className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
				>
					Elegir archivo externo…
				</button>
			</div>

			{listError ? (
				<div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{listError}</div>
			) : null}

			<ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
				{items.length === 0 && !loading ? (
					<li className="px-3 py-4 text-xs italic text-slate-500">
						Sin respaldos locales. Se crean automáticamente al iniciar la aplicación si los
						respaldos están activados.
					</li>
				) : null}
				{items.map((item) => (
					<li
						key={item.fullPath}
						className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
					>
						<div className="min-w-0 flex-1">
							<p className="truncate font-mono text-xs text-slate-800">{item.name}</p>
							<p className="mt-0.5 text-xs text-slate-500">
								<span>Modificado: {formatDateTime(item.modifiedAtIso)}</span>
								<span className="mx-2 text-slate-300">·</span>
								<span>Tamaño: {formatSize(item.sizeBytes)}</span>
							</p>
						</div>
						<button
							type="button"
							onClick={() => startRestore(item.fullPath, null)}
							disabled={!adminModeActive}
							className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
						>
							Restaurar este respaldo
						</button>
					</li>
				))}
			</ul>

			{confirmOpen ? (
				<div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
					<div
						className="w-full max-w-md rounded-xl border border-amber-300 bg-white p-5 shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="backup-restore-confirm-title"
					>
						<h2
							id="backup-restore-confirm-title"
							className="text-base font-semibold text-amber-900"
						>
							Confirmar restauración
						</h2>
						<p className="mt-2 text-sm text-slate-700">
							Va a reemplazar la base de datos activa con el respaldo seleccionado. Se perderán los
							cambios posteriores a la fecha del respaldo.
						</p>
						<div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
							<p className="font-mono break-all">
								{externalLabel ?? (selectedPath ? basename(selectedPath) : "")}
							</p>
							{selectedPath ? (
								<p className="mt-1 break-all text-[0.65rem] text-slate-500">{selectedPath}</p>
							) : null}
						</div>
						<p className="mt-3 text-xs text-amber-800">
							Esta operación es irreversible. Confirme con la contraseña de administrador.
						</p>
						{restoreError ? (
							<div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
								{restoreError}
							</div>
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
										void confirmRestore();
									}
								}}
								autoFocus
							/>
						</label>
						<div className="mt-5 flex flex-wrap gap-2">
							<button
								type="button"
								disabled={restoreBusy}
								onClick={() => void confirmRestore()}
								className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
							>
								{restoreBusy ? "Restaurando…" : "Restaurar respaldo"}
							</button>
							<button
								type="button"
								disabled={restoreBusy}
								onClick={() => {
									setConfirmOpen(false);
									setSelectedPath(null);
									setExternalLabel(null);
									setAdminPwd("");
									setRestoreError(null);
								}}
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
							>
								Cancelar
							</button>
						</div>
					</div>
				</div>
			) : null}

			{doneOpen ? (
				<div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
					<div
						className="w-full max-w-md rounded-xl border border-emerald-200 bg-white p-5 shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="backup-restore-done-title"
					>
						<h2 id="backup-restore-done-title" className="text-base font-semibold text-emerald-700">
							Restauración completada
						</h2>
						<p className="mt-2 text-sm text-slate-700">
							La base de datos se reemplazó correctamente. Para garantizar que toda la aplicación
							trabaje con los datos restaurados, se cerrará ahora; vuelva a abrirla para continuar.
						</p>
						<div className="mt-5 flex justify-end">
							<button
								type="button"
								onClick={() => void handleCloseAppAfterRestore()}
								className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
							>
								Cerrar aplicación
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
