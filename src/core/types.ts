export type TimeDisplay = "12h" | "24h";

export type AppointmentStatus = "pendiente" | "asistio" | "no_asistio";

export interface ServiceTypeSetting {
	id: string;
	label: string;
	concurrentCapacity: number;
}

export interface AppSettings {
	showSundays: boolean;
	timeDisplay: TimeDisplay;
	defaultDurationMinutes: number;
	documentTypes: string[];
	defaultDocumentType: string;
	serviceTypes: ServiceTypeSetting[];
}

export interface Appointment {
	id: string;
	patientFullName: string;
	documentType: string;
	documentNumber: string;
	phoneDialCode: string;
	phoneNationalNumber: string;
	birthdayMonth: number | null;
	appointmentDate: string;
	startTime: string;
	endTime: string;
	serviceType: string;
	status: AppointmentStatus;
	createdAt: string;
	updatedAt: string;
}

export interface AppointmentInput {
	patientFullName: string;
	documentType: string;
	documentNumber: string;
	phoneDialCode: string;
	phoneNationalNumber: string;
	birthdayMonth: number | null;
	appointmentDate: string;
	startTime: string;
	endTime: string;
	serviceType: string;
	status?: AppointmentStatus;
}

export interface DomainEventPayload {
	cita_id: string;
	paciente_documento: string;
	tipo_servicio: string;
	estado: string;
	timestamp: string;
}

export type DomainEventName =
	| "cita_creada"
	| "cita_completada"
	| "cita_cancelada";
