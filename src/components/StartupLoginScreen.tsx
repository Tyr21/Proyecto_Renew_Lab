import { useCallback, useState, type FormEvent } from "react";
import { verifyStartupPassword } from "../core/api";
import { formatInvokeError } from "../core/errors";

interface StartupLoginScreenProps {
	onSuccess: () => void;
}

export function StartupLoginScreen({ onSuccess }: StartupLoginScreenProps) {
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			setError(null);
			setBusy(true);
			try {
				await verifyStartupPassword(password);
				onSuccess();
			} catch (err) {
				setError(formatInvokeError(err));
			} finally {
				setBusy(false);
			}
		},
		[password, onSuccess],
	);

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-100 p-4">
			<div
				className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="startup-login-title"
			>
				<h1 id="startup-login-title" className="text-lg font-semibold text-slate-800">
					Consultorio Renew Lab
				</h1>
				<p className="mt-2 text-sm text-slate-600">Introduzca la contraseña para continuar.</p>
				<form onSubmit={submit} className="mt-5 space-y-4">
					{error ? (
						<div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
					) : null}
					<label className="block text-sm">
						<span className="font-medium text-slate-700">Contraseña</span>
						<input
							type="password"
							autoComplete="current-password"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoFocus
						/>
					</label>
					<button
						type="submit"
						disabled={busy || !password.trim()}
						className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
					>
						{busy ? "Comprobando…" : "Entrar"}
					</button>
				</form>
			</div>
		</div>
	);
}
