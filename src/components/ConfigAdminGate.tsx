import { useCallback, useState, type FormEvent } from "react";
import { setAdminPassword, verifyAdminPassword } from "../core/api";
import {
	ADMIN_PASSWORD_MAX_LENGTH,
	ADMIN_PASSWORD_MIN_LENGTH,
} from "../core/constants";
import { formatInvokeError } from "../core/errors";

export type ConfigAdminGatePhase = "loading" | "bootstrap" | "verify";

interface ConfigAdminGateProps {
	phase: ConfigAdminGatePhase;
	onBootstrapComplete: () => void;
	onVerifyComplete: () => void;
	onCancel: () => void;
}

function validateNew(pw: string): string | null {
	const t = pw.trim();
	if (t.length < ADMIN_PASSWORD_MIN_LENGTH) {
		return `Mínimo ${ADMIN_PASSWORD_MIN_LENGTH} caracteres`;
	}
	if (t.length > ADMIN_PASSWORD_MAX_LENGTH) {
		return `Máximo ${ADMIN_PASSWORD_MAX_LENGTH} caracteres`;
	}
	return null;
}

export function ConfigAdminGate({
	phase,
	onBootstrapComplete,
	onVerifyComplete,
	onCancel,
}: ConfigAdminGateProps) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [bootNew, setBootNew] = useState("");
	const [bootConfirm, setBootConfirm] = useState("");
	const [verifyPwd, setVerifyPwd] = useState("");

	const runBootstrap = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			setError(null);
			const v = validateNew(bootNew);
			if (v) {
				setError(v);
				return;
			}
			if (bootNew.trim() !== bootConfirm.trim()) {
				setError("Las contraseñas no coinciden");
				return;
			}
			setBusy(true);
			try {
				await setAdminPassword(null, bootNew.trim());
				onBootstrapComplete();
			} catch (err) {
				setError(formatInvokeError(err));
			} finally {
				setBusy(false);
			}
		},
		[bootNew, bootConfirm, onBootstrapComplete],
	);

	const runVerify = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			setError(null);
			if (!verifyPwd.trim()) {
				setError("Introduzca la contraseña de administrador");
				return;
			}
			setBusy(true);
			try {
				await verifyAdminPassword(verifyPwd);
				onVerifyComplete();
			} catch (err) {
				setError(formatInvokeError(err));
			} finally {
				setBusy(false);
			}
		},
		[verifyPwd, onVerifyComplete],
	);

	if (phase === "loading") {
		return (
			<div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-slate-600">
				Cargando seguridad…
			</div>
		);
	}

	return (
		<div className="flex min-h-full flex-col items-center justify-center bg-slate-50 p-4">
			<div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-lg font-semibold text-slate-800">
							{phase === "bootstrap"
								? "Crear contraseña de administrador"
								: "Acceso a configuración"}
						</h1>
						<p className="mt-2 text-sm text-slate-600">
							{phase === "bootstrap"
								? "Esta contraseña protege el acceso a Configuración y las funciones de administración. Solo quien la conozca podrá entrar aquí o activar el modo administrador."
								: "Introduzca la contraseña de administrador para abrir Configuración."}
						</p>
					</div>
				</div>

				{error ? (
					<div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
				) : null}

				{phase === "bootstrap" ? (
					<form onSubmit={runBootstrap} className="mt-5 space-y-4">
						<label className="block text-sm">
							<span className="font-medium text-slate-700">Nueva contraseña</span>
							<input
								type="password"
								autoComplete="new-password"
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
								value={bootNew}
								onChange={(e) => setBootNew(e.target.value)}
								autoFocus
							/>
						</label>
						<label className="block text-sm">
							<span className="font-medium text-slate-700">Confirmar contraseña</span>
							<input
								type="password"
								autoComplete="new-password"
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
								value={bootConfirm}
								onChange={(e) => setBootConfirm(e.target.value)}
							/>
						</label>
						<div className="flex flex-wrap gap-2 pt-1">
							<button
								type="submit"
								disabled={busy}
								className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
							>
								{busy ? "Guardando…" : "Guardar y continuar"}
							</button>
							<button
								type="button"
								onClick={onCancel}
								className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
							>
								Volver
							</button>
						</div>
					</form>
				) : (
					<form onSubmit={runVerify} className="mt-5 space-y-4">
						<label className="block text-sm">
							<span className="font-medium text-slate-700">Contraseña de administrador</span>
							<input
								type="password"
								autoComplete="current-password"
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
								value={verifyPwd}
								onChange={(e) => setVerifyPwd(e.target.value)}
								autoFocus
							/>
						</label>
						<div className="flex flex-wrap gap-2 pt-1">
							<button
								type="submit"
								disabled={busy || !verifyPwd.trim()}
								className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
							>
								{busy ? "Comprobando…" : "Entrar"}
							</button>
							<button
								type="button"
								onClick={onCancel}
								className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
							>
								Volver
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
