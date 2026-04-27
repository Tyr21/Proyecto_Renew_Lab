import { STARTUP_SPLASH_IMAGE_URL } from "../core/constants";

/**
 * Pantalla completa con el logo mientras se completa el arranque o la carga de configuración.
 */
export function StartupSplash() {
	return (
		<div
			className="fixed inset-0 z-[200] h-[100dvh] w-full min-h-0 bg-slate-200 bg-cover bg-center bg-no-repeat"
			style={{ backgroundImage: `url(${STARTUP_SPLASH_IMAGE_URL})` }}
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<span className="sr-only">Cargando aplicación…</span>
		</div>
	);
}
