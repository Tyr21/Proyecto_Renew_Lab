import { useEffect, useRef, useState } from "react";
import { advertenciaHomonimiaCliente } from "./api";
import type { ClienteHomonimiaAdvertencia } from "./types";

const DEBOUNCE_MS = 450;

export function useClienteHomonimiaAdvertencia(options: {
	enabled: boolean;
	nombres: string;
	apellidos: string;
	excluirClienteId?: string | null;
}): ClienteHomonimiaAdvertencia | null {
	const { enabled, nombres, apellidos, excluirClienteId } = options;
	const [coincidencia, setCoincidencia] = useState<ClienteHomonimiaAdvertencia | null>(null);
	const requestKeyRef = useRef<string>("");

	useEffect(() => {
		if (!enabled) {
			setCoincidencia(null);
			return;
		}
		const n = nombres.trim();
		const a = apellidos.trim();
		const ex = excluirClienteId?.trim() ?? "";
		const key = `${n}|${a}|${ex}`;
		requestKeyRef.current = key;

		if (!n || !a) {
			setCoincidencia(null);
			return;
		}

		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const result = await advertenciaHomonimiaCliente(nombres, apellidos, ex || null);
					if (requestKeyRef.current !== key) return;
					setCoincidencia(result);
				} catch {
					if (requestKeyRef.current !== key) return;
					setCoincidencia(null);
				}
			})();
		}, DEBOUNCE_MS);

		return () => window.clearTimeout(timer);
	}, [enabled, nombres, apellidos, excluirClienteId]);

	return coincidencia;
}
