import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { CitaEventName } from "../core/types";

/** `cita_completada` lo gestiona `FinanceEventListener` (modal de pago). */
const CITA_EVENTS: CitaEventName[] = ["cita_creada", "cita_actualizada", "cita_cancelada"];

const TOAST_MS = 4500;

/**
 * Consumidor de prueba del bus local: escucha eventos emitidos desde Rust tras persistir citas.
 */
export function CitaEventNotifier() {
	const [toast, setToast] = useState<string | null>(null);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const unlisteners: UnlistenFn[] = [];
		let cancelled = false;

		const setup = async () => {
			try {
				for (const eventName of CITA_EVENTS) {
					const unlisten = await listen<Record<string, unknown>>(eventName, (event) => {
						const tipo =
							typeof event.payload?.tipo_servicio === "string" ? event.payload.tipo_servicio : "?";
						if (import.meta.env.DEV) {
							console.log(
								`[CitaEvent] ${eventName} | servicio=${tipo} | payload=${JSON.stringify(event.payload)}`,
							);
						}
						if (hideTimer.current) {
							clearTimeout(hideTimer.current);
						}
						setToast(`📢 Evento ${eventName} emitido para servicio: ${tipo}`);
						hideTimer.current = setTimeout(() => {
							setToast(null);
							hideTimer.current = null;
						}, TOAST_MS);
					});
					if (cancelled) {
						unlisten();
						return;
					}
					unlisteners.push(unlisten);
				}
			} catch (e) {
				console.warn("[CitaEventNotifier] no se pudo suscribir a eventos Tauri:", e);
			}
		};

		void setup();

		return () => {
			cancelled = true;
			if (hideTimer.current) {
				clearTimeout(hideTimer.current);
			}
			for (const u of unlisteners) {
				u();
			}
		};
	}, []);

	if (!toast) {
		return null;
	}

	return (
		<div
			role="status"
			aria-live="polite"
			className="pointer-events-none fixed bottom-4 left-1/2 z-[100] max-w-[min(90vw,28rem)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-800 shadow-lg"
		>
			{toast}
		</div>
	);
}
