import type { AppSettings } from "./types";

/** Resuelve `service_type` (id persistido) a la etiqueta configurada en ajustes */
export function serviceLabelFromSettings(
	settings: AppSettings,
	serviceTypeId: string,
): string {
	return (
		settings.serviceTypes.find((s) => s.id === serviceTypeId)?.label ??
		serviceTypeId
	);
}

/** Precio sugerido configurado para el id de servicio (≥ 0). */
export function suggestedPriceForServiceType(
	settings: AppSettings,
	serviceTypeId: string,
): number {
	const v = settings.serviceTypes.find((s) => s.id === serviceTypeId)
		?.suggestedPrice;
	if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
		return 0;
	}
	return v;
}
