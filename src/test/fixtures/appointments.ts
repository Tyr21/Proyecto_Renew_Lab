import type { Appointment } from "../../core/types";

export function appointmentFixture(overrides: Partial<Appointment> = {}): Appointment {
	return {
		id: "apt-1",
		patientFullName: "Paciente Demo",
		documentType: "CC",
		documentNumber: "998877",
		phoneDialCode: "+57",
		phoneNationalNumber: "3001234567",
		birthdayMonth: null,
		appointmentDate: "2099-06-01",
		startTime: "09:00",
		endTime: "10:00",
		serviceType: "svc_a",
		status: "pendiente",
		createdAt: "",
		updatedAt: "",
		isPaid: false,
		paqueteId: null,
		...overrides,
	};
}
