import type { AppSettings } from "../../core/types";

/** Ajustes mínimos válidos para montar formularios en tests (sin I/O). */
export function minimalAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
	const base: AppSettings = {
		showSundays: true,
		timeDisplay: "24h",
		defaultDurationMinutes: 60,
		documentTypes: ["CC", "CE"],
		defaultDocumentType: "CC",
		serviceTypes: [
			{
				id: "svc_a",
				label: "Servicio A",
				concurrentCapacity: 2,
				suggestedPrice: 50_000,
			},
		],
		adminMode: false,
		billing: {
			razonSocial: "Renew Lab",
			nit: "900",
			direccion: "Calle 1",
			telefono: "0",
			serieDefault: "F",
			ivaDefaultPct: 19,
		},
		backup: {
			enabled: false,
			retentionCount: 3,
			externalPath: "",
		},
		oxygen: {
			unitsLabel: "L",
			perHyperbaricSession: 1,
			serviceTypeId: "svc_a",
		},
	};
	return { ...base, ...overrides, serviceTypes: overrides.serviceTypes ?? base.serviceTypes };
}
