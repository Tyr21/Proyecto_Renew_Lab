import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { clearAdminPassword, getAdminAuthStatus, setAdminPassword } from "../../core/api";
import { ADMIN_PASSWORD_MAX_LENGTH, ADMIN_PASSWORD_MIN_LENGTH } from "../../core/constants";
import { formatInvokeError } from "../../core/errors";

function stopEnterFromSubmittingParent(e: KeyboardEvent) {
	if (e.key === "Enter") {
		e.preventDefault();
		e.stopPropagation();
	}
}

export function AdminPasswordAdminSection() {
	const [hasPassword, setHasPassword] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const [info, setInfo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [chgCurrent, setChgCurrent] = useState("");
	const [chgNew, setChgNew] = useState("");
	const [chgConfirm, setChgConfirm] = useState("");
	const [clearPwd, setClearPwd] = useState("");

	const refresh = useCallback(async () => {
		const s = await getAdminAuthStatus();
		setHasPassword(s.hasPassword);
	}, []);

	useEffect(() => {
		void refresh().catch(() => setHasPassword(null));
	}, [refresh]);

	function validatePair(a: string, b: string): string | null {
		const t = a.trim();
		if (t.length < ADMIN_PASSWORD_MIN_LENGTH) {
			return `Mínimo ${ADMIN_PASSWORD_MIN_LENGTH} caracteres`;
		}
		if (t.length > ADMIN_PASSWORD_MAX_LENGTH) {
			return `Máximo ${ADMIN_PASSWORD_MAX_LENGTH} caracteres`;
		}
		if (t !== b.trim()) {
			return "Las contraseñas no coinciden";
		}
		return null;
	}

	async function runChange() {
		setError(null);
		setInfo(null);
		const v = validatePair(chgNew, chgConfirm);
		if (v) {
			setError(v);
			return;
		}
		if (!chgCurrent.trim()) {
			setError("Indique la contraseña actual de administrador");
			return;
		}
		setBusy(true);
		try {
			await setAdminPassword(chgCurrent, chgNew.trim());
			setChgCurrent("");
			setChgNew("");
			setChgConfirm("");
			setInfo("Contraseña de administrador actualizada.");
			await refresh();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	async function runClear() {
		setError(null);
		setInfo(null);
		if (!clearPwd.trim()) {
			setError("Indique la contraseña actual de administrador");
			return;
		}
		if (
			!window.confirm(
				"Se eliminará la contraseña de administrador. Cualquiera podrá entrar a Configuración hasta que defina una nueva. ¿Continuar?",
			)
		) {
			return;
		}
		setBusy(true);
		try {
			await clearAdminPassword(clearPwd);
			setClearPwd("");
			setInfo(
				"Contraseña de administrador eliminada. La próxima vez que abra Configuración podrá crear una nueva.",
			);
			await refresh();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	if (hasPassword === null) {
		return (
			<div className="mt-6 rounded-lg border border-amber-200/80 bg-white/60 p-4 text-sm text-slate-600">
				Cargando…
			</div>
		);
	}

	if (!hasPassword) {
		return (
			<div className="mt-6 rounded-lg border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-900">
				No hay contraseña de administrador en la base de datos. Cierre Configuración y vuelva a
				entrar para crearla.
			</div>
		);
	}

	return (
		<div className="mt-6 space-y-6 border-t border-amber-200/80 pt-6">
			<div>
				<h3 className="text-sm font-medium text-amber-900">Contraseña de administrador</h3>
				<p className="mt-1 text-xs text-amber-800/90">
					Protege el acceso a este módulo y la activación del modo administrador. Distinta de la
					contraseña de inicio de la aplicación.
				</p>
			</div>

			{info ? (
				<div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{info}</div>
			) : null}
			{error ? (
				<div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
			) : null}

			<div className="space-y-3">
				<h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
					Cambiar contraseña
				</h4>
				<label className="block text-sm">
					<span className="font-medium text-slate-800">Contraseña actual</span>
					<input
						type="password"
						autoComplete="current-password"
						className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
						value={chgCurrent}
						onChange={(e) => setChgCurrent(e.target.value)}
						onKeyDown={stopEnterFromSubmittingParent}
					/>
				</label>
				<label className="block text-sm">
					<span className="font-medium text-slate-800">Nueva contraseña</span>
					<input
						type="password"
						autoComplete="new-password"
						className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
						value={chgNew}
						onChange={(e) => setChgNew(e.target.value)}
						onKeyDown={stopEnterFromSubmittingParent}
					/>
				</label>
				<label className="block text-sm">
					<span className="font-medium text-slate-800">Confirmar nueva contraseña</span>
					<input
						type="password"
						autoComplete="new-password"
						className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
						value={chgConfirm}
						onChange={(e) => setChgConfirm(e.target.value)}
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
					{busy ? "Guardando…" : "Guardar nueva contraseña de administrador"}
				</button>
			</div>

			<div className="space-y-3 border-t border-amber-200/60 pt-6">
				<h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
					Quitar contraseña de administrador
				</h4>
				<p className="text-xs text-amber-800/90">
					Elimina la contraseña de administrador. Cualquiera podrá entrar a Configuración hasta que
					cree una nueva al entrar.
				</p>
				<label className="block text-sm">
					<span className="font-medium text-slate-800">Contraseña actual de administrador</span>
					<input
						type="password"
						autoComplete="current-password"
						className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-2 text-sm"
						value={clearPwd}
						onChange={(e) => setClearPwd(e.target.value)}
						onKeyDown={(e) => {
							stopEnterFromSubmittingParent(e);
							if (e.key === "Enter" && !busy) void runClear();
						}}
					/>
				</label>
				<button
					type="button"
					disabled={busy}
					onClick={() => void runClear()}
					className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
				>
					{busy ? "Procesando…" : "Eliminar contraseña de administrador"}
				</button>
			</div>
		</div>
	);
}
