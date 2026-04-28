import { normalizePhoneDialCode } from "./countries";
import type { AppSettings, AppointmentInput } from "./types";

/** Replica reglas de `validate_against_settings` en Rust para feedback inmediato en la UI */
export function validateAppointmentFormFields(
	input: AppointmentInput,
	settings: AppSettings,
): string | null {
	const name = input.patientFullName.trim();
	if (name.length === 0) {
		return "El nombre completo es obligatorio";
	}
	if (!settings.documentTypes.includes(input.documentType)) {
		return "Tipo de documento no permitido";
	}
	const doc = input.documentNumber.trim();
	if (doc.length === 0 || ![...doc].every((ch) => /^[\p{L}\p{N}]$/u.test(ch))) {
		return "El documento debe ser alfanumérico";
	}
	const dial = normalizePhoneDialCode(input.phoneDialCode);
	if (dial.length > 5 || !dial.startsWith("+") || !/^\+[0-9]+$/.test(dial)) {
		return "El prefijo del país debe ser como +57 (elija en la lista o use formato + y dígitos)";
	}
	const phone = input.phoneNationalNumber.trim();
	if (phone.length === 0 || !/^\d+$/.test(phone)) {
		return "En «Teléfono» use solo dígitos del número local (sin + ni prefijo); el prefijo va en «País / prefijo».";
	}
	if (!settings.serviceTypes.some((s) => s.id === input.serviceType)) {
		return "Tipo de servicio no configurado";
	}
	if (input.birthdayMonth != null) {
		const m = input.birthdayMonth;
		if (m < 1 || m > 12) {
			return "Mes de cumpleaños debe estar entre 1 y 12";
		}
	}
	const st = input.status ?? "pendiente";
	if (st !== "pendiente" && st !== "asistio" && st !== "no_asistio") {
		return "Estado de cita inválido";
	}
	return null;
}
