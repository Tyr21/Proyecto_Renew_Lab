import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import {
	clearStartupPasswordWithAdmin,
	getStartupAuthStatus,
	setStartupPassword,
	setStartupPasswordWithAdmin,
} from "../../core/api";
import { STARTUP_PASSWORD_MAX_LENGTH, STARTUP_PASSWORD_MIN_LENGTH } from "../../core/constants";
import { formatInvokeError } from "../../core/errors";

function stopEnterFromSubmittingParent(e: KeyboardEvent) {
	if (e.key === "Enter") {
		e.preventDefault();
		e.stopPropagation();
	}
}

interface StartupPasswordAdminSectionProps {
	/** Solo con modo administrador activo (y guardado en sesión de edición) se gestionan estas opciones. */
	adminModeActive: boolean;
}

export function StartupPasswordAdminSection({ adminModeActive }: StartupPasswordAdminSectionProps) {
	const [hasPassword, setHasPassword] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const [info, setInfo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [firstNew, setFirstNew] = useState("");
	const [firstConfirm, setFirstConfirm] = useState("");

	const [changeCurrent, setChangeCurrent] = useState("");
	const [changeNew, setChangeNew] = useState("");
	const [changeConfirm, setChangeConfirm] = useState("");

	const [resetAdmin, setResetAdmin] = useState("");
	const [resetNew, setResetNew] = useState("");
	const [resetConfirm, setResetConfirm] = useState("");

	const [showClearModal, setShowClearModal] = useState(false);
	const [clearAdminPwd, setClearAdminPwd] = useState("");

	const refresh = useCallback(async () => {
		const s = await getStartupAuthStatus();
		setHasPassword(s.hasPassword);
	}, []);

	useEffect(() => {
		void refresh().catch(() => {
			setHasPassword(null);
		});
	}, [refresh]);

	function validatePair(a: string, b: string): string | null {
		const t = a.trim();
		if (t.length < STARTUP_PASSWORD_MIN_LENGTH) {
			return `La contraseña debe tener al menos ${STARTUP_PASSWORD_MIN_LENGTH} caracteres`;
		}
		if (t.length > STARTUP_PASSWORD_MAX_LENGTH) {
			return `Máximo ${STARTUP_PASSWORD_MAX_LENGTH} caracteres`;
		}
		if (t !== b.trim()) {
			return "Las contraseñas no coinciden";
		}
		return null;
	}

	async function runFirstSet() {
		setError(null);
		setInfo(null);
		const v = validatePair(firstNew, firstConfirm);
		if (v) {
			setError(v);
			return;
		}
		setBusy(true);
		try {
			await setStartupPassword(null, firstNew.trim());
			setFirstNew("");
			setFirstConfirm("");
			setInfo(
				"Contraseña de inicio guardada. La próxima vez que abra la app se pedirá al iniciar.",
			);
			await refresh();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	async function runChange() {
		setError(null);
		setInfo(null);
		const v = validatePair(changeNew, changeConfirm);
		if (v) {
			setError(v);
			return;
		}
		if (!changeCurrent.trim()) {
			setError("Indique la contraseña actual de inicio");
			return;
		}
		setBusy(true);
		try {
			await setStartupPassword(changeCurrent, changeNew.trim());
			setChangeCurrent("");
			setChangeNew("");
			setChangeConfirm("");
			setInfo("Contraseña de inicio actualizada correctamente.");
			await refresh();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	async function runResetWithAdmin() {
		setError(null);
		setInfo(null);
		const v = validatePair(resetNew, resetConfirm);
		if (v) {
			setError(v);
			return;
		}
		if (!resetAdmin.trim()) {
			setError("Indique la contraseña de administrador");
			return;
		}
		setBusy(true);
		try {
			await setStartupPasswordWithAdmin(resetAdmin, resetNew.trim());
			setResetAdmin("");
			setResetNew("");
			setResetConfirm("");
			setInfo("Contraseña de inicio restablecida. Use la nueva al abrir la aplicación.");
			await refresh();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	async function runClearWithAdmin() {
		setError(null);
		setInfo(null);
		if (!clearAdminPwd.trim()) {
			setError("Indique la contraseña de administrador");
			return;
		}
		setBusy(true);
		try {
			await clearStartupPasswordWithAdmin(clearAdminPwd);
			setClearAdminPwd("");
			setShowClearModal(false);
			setInfo("Protección de inicio desactivada. Reinicie la app para comprobarlo.");
			await refresh();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	if (!adminModeActive) {
		return (
			<div className="mt-6 rounded-lg border border-amber-200/80 bg-white/60 p-4 text-sm text-amber-900/95">
				<p className="font-medium">Contraseña al iniciar la aplicación</p>
				<p className="mt-2 text-xs text-amber-800/90">
					Active el modo administrador más abajo y guarde la configuración para poder establecer,
					cambiar o quitar la contraseña de inicio (gestionado solo por administradores).
				</p>
			</div>
		);
	}

	if (hasPassword === null) {
		return (
			<div className="mt-6 rounded-lg border border-amber-200/80 bg-white/60 p-4 text-sm text-slate-600">
				Cargando estado de seguridad…
			</div>
		);
	}

	return (
		<div className="mt-6 space-y-8 border-t border-amber-200/80 pt-6">
			<div>
				<h3 className="text-sm font-medium text-amber-900">Contraseña al iniciar la aplicación</h3>
				<p className="mt-1 text-xs text-amber-800/90">
					Se guarda de forma segura (Argon2) en la base de datos local. Quitar la protección o
					restablecerla sin la contraseña de inicio requiere la contraseña de administrador.
				</p>
			</div>

			{info ? (
				<div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{info}</div>
			) : null}
			{error ? (
				<div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
			) : null}

			{!hasPassword ? (
				<div className="space-y-3">
					<p className="text-sm text-amber-900">
						Aún no hay contraseña de inicio. Establezca una para proteger el acceso al abrir la
						aplicación.
					</p>
					<label className="block text-sm">
						<span className="font-medium text-slate-800">Nueva contraseña</span>
						<input
							type="password"
							autoComplete="new-password"
							className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
							value={firstNew}
							onChange={(e) => setFirstNew(e.target.value)}
							onKeyDown={stopEnterFromSubmittingParent}
						/>
					</label>
					<label className="block text-sm">
						<span className="font-medium text-slate-800">Confirmar contraseña</span>
						<input
							type="password"
							autoComplete="new-password"
							className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
							value={firstConfirm}
							onChange={(e) => setFirstConfirm(e.target.value)}
							onKeyDown={(e) => {
								stopEnterFromSubmittingParent(e);
								if (e.key === "Enter" && !busy) void runFirstSet();
							}}
						/>
					</label>
					<button
						type="button"
						disabled={busy}
						onClick={() => void runFirstSet()}
						className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
					>
						{busy ? "Guardando…" : "Establecer contraseña de inicio"}
					</button>
				</div>
			) : (
				<>
					<div className="space-y-3">
						<h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
							Cambiar contraseña (con la contraseña de inicio actual)
						</h4>
						<label className="block text-sm">
							<span className="font-medium text-slate-800">Contraseña de inicio actual</span>
							<input
								type="password"
								autoComplete="current-password"
								className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
								value={changeCurrent}
								onChange={(e) => setChangeCurrent(e.target.value)}
								onKeyDown={stopEnterFromSubmittingParent}
							/>
						</label>
						<label className="block text-sm">
							<span className="font-medium text-slate-800">Nueva contraseña</span>
							<input
								type="password"
								autoComplete="new-password"
								className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
								value={changeNew}
								onChange={(e) => setChangeNew(e.target.value)}
								onKeyDown={stopEnterFromSubmittingParent}
							/>
						</label>
						<label className="block text-sm">
							<span className="font-medium text-slate-800">Confirmar nueva contraseña</span>
							<input
								type="password"
								autoComplete="new-password"
								className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
								value={changeConfirm}
								onChange={(e) => setChangeConfirm(e.target.value)}
								onKeyDown={(e) => {
									stopEnterFromSubmittingParent(e);
									if (e.key === "Enter" && !busy) void runChange();
								}}
							/>
						</label>
						<button
							type="button"
							disabled={busy}
							onClick={() => void runChange()}
							className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
						>
							{busy ? "Guardando…" : "Guardar nueva contraseña de inicio"}
						</button>
					</div>

					<div className="space-y-3 border-t border-amber-200/60 pt-6">
						<h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
							Restablecer con contraseña de administrador
						</h4>
						<p className="text-xs text-amber-800/90">
							Si no recuerda la contraseña de inicio, puede definir una nueva validando con la
							contraseña de administrador.
						</p>
						<label className="block text-sm">
							<span className="font-medium text-slate-800">Contraseña de administrador</span>
							<input
								type="password"
								autoComplete="current-password"
								className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
								value={resetAdmin}
								onChange={(e) => setResetAdmin(e.target.value)}
								onKeyDown={stopEnterFromSubmittingParent}
							/>
						</label>
						<label className="block text-sm">
							<span className="font-medium text-slate-800">Nueva contraseña de inicio</span>
							<input
								type="password"
								autoComplete="new-password"
								className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
								value={resetNew}
								onChange={(e) => setResetNew(e.target.value)}
								onKeyDown={stopEnterFromSubmittingParent}
							/>
						</label>
						<label className="block text-sm">
							<span className="font-medium text-slate-800">Confirmar nueva contraseña</span>
							<input
								type="password"
								autoComplete="new-password"
								className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
								value={resetConfirm}
								onChange={(e) => setResetConfirm(e.target.value)}
								onKeyDown={(e) => {
									stopEnterFromSubmittingParent(e);
									if (e.key === "Enter" && !busy) void runResetWithAdmin();
								}}
							/>
						</label>
						<button
							type="button"
							disabled={busy}
							onClick={() => void runResetWithAdmin()}
							className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-50"
						>
							{busy ? "Guardando…" : "Restablecer contraseña de inicio"}
						</button>
					</div>

					<div className="space-y-3 border-t border-amber-200/60 pt-6">
						<h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
							Quitar protección de inicio
						</h4>
						<p className="text-xs text-amber-800/90">
							Elimina la contraseña de inicio. No se pide la contraseña de inicio; debe confirmar
							con la contraseña de administrador.
						</p>
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								setClearAdminPwd("");
								setShowClearModal(true);
							}}
							className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
						>
							Quitar contraseña de inicio…
						</button>
					</div>
				</>
			)}

			{showClearModal ? (
				<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
					<div
						className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="clear-startup-title"
					>
						<h2 id="clear-startup-title" className="text-base font-semibold text-slate-800">
							Confirmar con contraseña de administrador
						</h2>
						<p className="mt-2 text-sm text-slate-600">
							Se eliminará la contraseña de inicio de la aplicación. Introduzca la contraseña de
							administrador.
						</p>
						<label className="mt-4 block text-sm">
							<span className="font-medium text-slate-700">Contraseña de administrador</span>
							<input
								type="password"
								autoComplete="current-password"
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								value={clearAdminPwd}
								onChange={(e) => setClearAdminPwd(e.target.value)}
								autoFocus
							/>
						</label>
						<div className="mt-5 flex flex-wrap gap-2">
							<button
								type="button"
								disabled={busy}
								onClick={() => void runClearWithAdmin()}
								className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
							>
								{busy ? "Procesando…" : "Quitar protección"}
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => {
									setShowClearModal(false);
									setClearAdminPwd("");
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
