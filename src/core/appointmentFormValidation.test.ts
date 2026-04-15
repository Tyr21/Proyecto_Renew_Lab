import { describe, expect, it } from "vitest";
import { validateAppointmentFormFields } from "./appointmentFormValidation";
import type { AppSettings, AppointmentInput } from "./types";

const baseSettings: AppSettings = {
	showSundays: false,
	timeDisplay: "24h",
	defaultDurationMinutes: 60,
	documentTypes: ["CC", "NIT"],
	defaultDocumentType: "CC",
	serviceTypes: [
		{
			id: "camara_hiperbarica",
			label: "Cámara",
			concurrentCapacity: 2,
			suggestedPrice: 150_000,
		},
	],
	adminMode: false,
	billing: {
		razonSocial: "",
		nit: "",
		direccion: "",
		telefono: "",
		serieDefault: "FV",
		ivaDefaultPct: 19,
	},
	backup: {
		enabled: true,
		retentionCount: 7,
		externalPath: "",
	},
};

const baseInput: AppointmentInput = {
	patientFullName: "Ana Pérez",
	documentType: "CC",
	documentNumber: "12345",
	phoneDialCode: "57",
	phoneNationalNumber: "3001234567",
	birthdayMonth: null,
	appointmentDate: "2025-03-10",
	startTime: "09:00",
	endTime: "10:00",
	serviceType: "camara_hiperbarica",
};

describe("validateAppointmentFormFields", () => {
	it("acepta datos coherentes", () => {
		expect(validateAppointmentFormFields(baseInput, baseSettings)).toBeNull();
	});

	it("rechaza nombre vacío", () => {
		expect(
			validateAppointmentFormFields(
				{ ...baseInput, patientFullName: "   " },
				baseSettings,
			),
		).toMatch(/obligatorio/);
	});

	it("rechaza documento no alfanumérico", () => {
		expect(
			validateAppointmentFormFields(
				{ ...baseInput, documentNumber: "12-34" },
				baseSettings,
			),
		).toMatch(/alfanumérico/);
	});

	it("rechaza teléfono con letras", () => {
		expect(
			validateAppointmentFormFields(
				{ ...baseInput, phoneNationalNumber: "abc" },
				baseSettings,
			),
		).toMatch(/dígitos/);
	});
});
