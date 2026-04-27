import {
	debug as logDebug,
	error as logError,
	info as logInfo,
	warn as logWarn,
} from "@tauri-apps/plugin-log";

import { formatInvokeError } from "./errors";

/**
 * Wrapper único sobre `@tauri-apps/plugin-log` para que el resto de la app
 * registre eventos sin acoplarse al plugin ni al runtime de Tauri.
 *
 * Cada nivel:
 * - Persiste el mensaje vía el plugin (archivo en `LogDir` del sistema y stdout
 *   en desarrollo). El backend Rust comparte el mismo destino.
 * - Mantiene salida en `console.*` con el mismo nivel para que las DevTools
 *   muestren la traza incluso cuando el plugin no está disponible (tests/web).
 *
 * El plugin JS no expone `target:` como en el log crate de Rust; la convención
 * aquí es prefijar el mensaje con `[target]` cuando `options.target` se indica,
 * para mantener simetría con `log::error!(target: "...", ...)` del backend.
 *
 * El plugin no se inyecta automáticamente fuera del runtime de Tauri (vitest,
 * `vite dev` puro, etc.), así que se atrapa el rechazo y se cae a consola.
 */

type LogLevel = "error" | "warn" | "info" | "debug";

export interface LoggerCallOptions {
	/** Etiqueta opcional, equivalente al `target:` de `log::error!` en Rust. */
	target?: string;
}

type PluginLogFn = (message: string) => Promise<void>;

const PLUGIN_FNS: Record<LogLevel, PluginLogFn> = {
	error: (m) => logError(m),
	warn: (m) => logWarn(m),
	info: (m) => logInfo(m),
	debug: (m) => logDebug(m),
};

function buildLine(message: string, target?: string): string {
	return target ? `[${target}] ${message}` : message;
}

function consoleFallback(level: LogLevel, line: string) {
	switch (level) {
		case "error":
			console.error(line);
			break;
		case "warn":
			console.warn(line);
			break;
		case "info":
			console.info(line);
			break;
		case "debug":
		default:
			console.debug(line);
			break;
	}
}

async function safeLog(
	level: LogLevel,
	message: string,
	options?: LoggerCallOptions,
): Promise<void> {
	const line = buildLine(message, options?.target);
	consoleFallback(level, line);
	try {
		await PLUGIN_FNS[level](line);
	} catch {
		// Plugin no disponible (tests, build sin runtime Tauri). Console ya capturó la traza.
	}
}

export const logger = {
	error(message: string, options?: LoggerCallOptions): Promise<void> {
		return safeLog("error", message, options);
	},
	warn(message: string, options?: LoggerCallOptions): Promise<void> {
		return safeLog("warn", message, options);
	},
	info(message: string, options?: LoggerCallOptions): Promise<void> {
		return safeLog("info", message, options);
	},
	debug(message: string, options?: LoggerCallOptions): Promise<void> {
		return safeLog("debug", message, options);
	},
	/** Atajo para errores capturados desde `invoke` u operaciones críticas. */
	invokeError(scope: string, err: unknown): Promise<void> {
		return safeLog("error", formatInvokeError(err), { target: scope });
	},
};
