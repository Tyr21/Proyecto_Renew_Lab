import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { runE2EInvokeMock } from "./e2eInvokeMock";

/**
 * Punto único de llamada al backend Tauri. En navegador con `VITE_E2E_MOCK_TAURI=true`
 * se usa el mock de Playwright (sin IPC real).
 */
export async function appInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
	if (import.meta.env.VITE_E2E_MOCK_TAURI === "true") {
		return runE2EInvokeMock(cmd, args) as Promise<T>;
	}
	return tauriInvoke<T>(cmd, args);
}
