/**
 * Bus mínimo de notificaciones tipo toast para la app.
 *
 * Pensado para reemplazar usos puntuales de `alert()` en flujos de error sin
 * añadir dependencias externas ni un Provider/Context global. Cualquier módulo
 * publica con `showToast(...)` y `<ToastHost />` (montado una vez en App)
 * pinta el aviso con el estilo correspondiente al nivel.
 */

export type ToastLevel = "info" | "success" | "warning" | "error";

export interface ToastInput {
	message: string;
	level?: ToastLevel;
	/** Tiempo visible (ms). Si no se indica se aplica un default por nivel. */
	durationMs?: number;
}

export interface Toast {
	id: number;
	message: string;
	level: ToastLevel;
	durationMs: number;
}

type Listener = (toast: Toast) => void;

const DEFAULT_DURATION_MS: Record<ToastLevel, number> = {
	info: 3500,
	success: 3000,
	warning: 5000,
	error: 6000,
};

const listeners = new Set<Listener>();
let nextId = 1;

export function subscribeToast(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function showToast(input: ToastInput | string): void {
	const normalized: ToastInput =
		typeof input === "string" ? { message: input } : input;
	const level = normalized.level ?? "info";
	const toast: Toast = {
		id: nextId++,
		message: normalized.message,
		level,
		durationMs: normalized.durationMs ?? DEFAULT_DURATION_MS[level],
	};
	for (const listener of listeners) {
		listener(toast);
	}
}
