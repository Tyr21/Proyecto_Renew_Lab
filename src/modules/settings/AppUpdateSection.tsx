import { useCallback, useRef, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { APP_VERSION } from "../../core/constants";
import { formatInvokeError } from "../../core/errors";

type Phase = "idle" | "checking" | "uptoDate" | "available" | "downloading" | "error";

const CHECK_TIMEOUT_MS = 18_000;

/** Solo en dev: poner `VITE_UPDATER_IN_DEV=true` en `.env` si necesita probar la petición real al manifiesto. */
const ALLOW_UPDATER_IN_DEV = import.meta.env.VITE_UPDATER_IN_DEV === "true";

export function AppUpdateSection() {
	const [phase, setPhase] = useState<Phase>("idle");
	const [message, setMessage] = useState<string | null>(null);
	const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
	const pendingRef = useRef<Awaited<ReturnType<typeof check>> | null>(null);

	const isDev = import.meta.env.DEV;
	const skipRemoteInDev = isDev && !ALLOW_UPDATER_IN_DEV;

	const runCheck = useCallback(async () => {
		setMessage(null);
		pendingRef.current = null;
		setRemoteVersion(null);
		if (skipRemoteInDev) {
			setPhase("idle");
			setMessage(
				"En modo desarrollo no se contacta al servidor de actualizaciones: el updater está pensado para la app empaquetada (instalador NSIS/MSI). Para probar de verdad, use un build de release y asegúrese de que la URL del manifiesto en tauri.conf.json exista (HTTPS, JSON) — por ejemplo tras publicar docs/releases/latest.json en la rama configurada.",
			);
			return;
		}
		setPhase("checking");
		try {
			const update = await check({
				timeout: CHECK_TIMEOUT_MS,
				headers: {
					"User-Agent": `consultorio-renew-lab/${APP_VERSION}`,
				},
			});
			if (!update) {
				setPhase("uptoDate");
				setMessage(`La aplicación está actualizada (versión ${APP_VERSION}).`);
				return;
			}
			pendingRef.current = update;
			setRemoteVersion(update.version);
			setPhase("available");
			setMessage(
				`Hay una versión nueva: ${update.version}. Puede descargarla e instalarla; al finalizar se reiniciará la aplicación.`,
			);
		} catch (e) {
			setPhase("error");
			setMessage(formatInvokeError(e));
		}
	}, [skipRemoteInDev]);

	const install = useCallback(async () => {
		const update = pendingRef.current;
		if (!update) {
			setMessage("Vuelva a comprobar actualizaciones antes de instalar.");
			return;
		}
		setPhase("downloading");
		setMessage("Descargando e instalando… La aplicación puede cerrarse al completar.");
		try {
			await update.downloadAndInstall();
			await relaunch();
		} catch (e) {
			setPhase("error");
			setMessage(formatInvokeError(e));
		}
	}, []);

	return (
		<section
			className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
			aria-labelledby="settings-updates-heading"
		>
			<h2 id="settings-updates-heading" className="text-base font-semibold text-slate-800">
				Actualizaciones
			</h2>
			<p className="mt-1 text-xs text-slate-500">
				Comprueba si hay una versión más reciente publicada por el proveedor. Requiere conexión
				HTTPS; los datos del consultorio no se suben a ningún servidor.
			</p>

			{isDev ? (
				<p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
					Modo desarrollo: «Buscar actualizaciones» no llama al remoto salvo que defina{" "}
					<code className="rounded bg-amber-100/80 px-1">VITE_UPDATER_IN_DEV=true</code>. El
					instalador completo solo aplica en builds empaquetados (NSIS/MSI).
				</p>
			) : null}

			<div className="mt-4 space-y-3 text-sm text-slate-700">
				<p>
					<span className="font-medium text-slate-800">Versión instalada:</span> {APP_VERSION}
				</p>
				{remoteVersion ? (
					<p>
						<span className="font-medium text-slate-800">Versión disponible:</span> {remoteVersion}
					</p>
				) : null}
			</div>

			<div className="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
					onClick={() => void runCheck()}
					disabled={phase === "checking" || phase === "downloading"}
				>
					{phase === "checking" ? "Buscando…" : "Buscar actualizaciones"}
				</button>
				<button
					type="button"
					className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
					onClick={() => void install()}
					disabled={phase !== "available" || phase === "downloading"}
				>
					{phase === "downloading" ? "Instalando…" : "Descargar e instalar"}
				</button>
			</div>

			{message ? (
				<p
					className={`mt-4 text-sm ${phase === "error" ? "text-red-800" : "text-slate-600"}`}
					role={phase === "error" ? "alert" : undefined}
				>
					{message}
				</p>
			) : null}
		</section>
	);
}
