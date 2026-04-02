import { toISODateLocal } from "./weekUtils";

/** Fecha calendario local (YYYY-MM-DD) del instante `fechaPago` (ISO-8601). */
export function fechaIngresoLocalISODate(fechaPagoIso: string): string {
	return toISODateLocal(new Date(fechaPagoIso));
}

/** Hora local corta para tablas (ej. "3:45 p. m."). */
export function formatHoraPago(fechaPagoIso: string): string {
	return new Date(fechaPagoIso).toLocaleTimeString("es-CO", {
		hour: "2-digit",
		minute: "2-digit",
	});
}
