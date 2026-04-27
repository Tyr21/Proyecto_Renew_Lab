import { useEffect, useState } from "react";
import { subscribeToast, type Toast, type ToastLevel } from "../core/toastBus";

/** Estilos por nivel — KISS: clases Tailwind directas en lugar de helper extra. */
const LEVEL_STYLES: Record<ToastLevel, string> = {
	info: "bg-slate-800 text-white",
	success: "bg-emerald-600 text-white",
	warning: "bg-amber-500 text-white",
	error: "bg-red-600 text-white",
};

/** Símbolo opcional para reforzar el nivel sin depender de iconos externos. */
const LEVEL_PREFIX: Record<ToastLevel, string> = {
	info: "",
	success: "",
	warning: "Aviso: ",
	error: "Error: ",
};

/**
 * Renderiza la pila de toasts publicados a través de `toastBus`.
 *
 * Debe montarse una sola vez en `App.tsx`. Cada toast se autodescarta tras su
 * `durationMs`. Los `error` son `role="alert"` para lectores de pantalla; el
 * resto usa `status` para no interrumpir.
 */
export function ToastHost() {
	const [items, setItems] = useState<Toast[]>([]);

	useEffect(() => {
		return subscribeToast((toast) => {
			setItems((prev) => [...prev, toast]);
			window.setTimeout(() => {
				setItems((prev) => prev.filter((t) => t.id !== toast.id));
			}, toast.durationMs);
		});
	}, []);

	if (items.length === 0) {
		return null;
	}

	return (
		<div
			className="pointer-events-none fixed bottom-4 right-4 z-[140] flex w-full max-w-sm flex-col gap-2"
			aria-live="polite"
		>
			{items.map((t) => (
				<div
					key={t.id}
					role={t.level === "error" ? "alert" : "status"}
					className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${LEVEL_STYLES[t.level]}`}
				>
					{LEVEL_PREFIX[t.level]}
					{t.message}
				</div>
			))}
		</div>
	);
}
