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
