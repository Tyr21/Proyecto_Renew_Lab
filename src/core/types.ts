export type TimeDisplay = "12h" | "24h";

export type AppointmentStatus = "pendiente" | "asistio" | "no_asistio";

export interface ServiceTypeSetting {
	id: string;
	label: string;
	concurrentCapacity: number;
	/** Precio sugerido para cobros (misma moneda que ingresos). 0 = sin sugerencia en UI. */
	suggestedPrice: number;
}

export interface AppSettings {
	showSundays: boolean;
	timeDisplay: TimeDisplay;
	defaultDurationMinutes: number;
	documentTypes: string[];
	defaultDocumentType: string;
	serviceTypes: ServiceTypeSetting[];
	/** Permite al administrador eliminar citas pasadas. Desactivado por defecto. */
	adminMode: boolean;
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
	/** Indica si existe un ingreso vinculado a esta cita (`ingresos.cita_id`). */
	isPaid: boolean;
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
	paciente_nombre: string;
	paciente_documento: string;
	tipo_servicio: string;
	estado: string;
	timestamp: string;
}

/** Eventos de dominio emitidos por el backend (Tauri `emit`) tras persistir en SQLite. */
export type CitaEventName =
	| "cita_creada"
	| "cita_actualizada"
	| "cita_cancelada"
	| "cita_completada";

export interface Ingreso {
	id: string;
	citaId: string | null;
	pacienteNombre: string;
	pacienteDocumento: string;
	concepto: string;
	monto: number;
	metodoPago: string;
	fechaPago: string;
}

export interface CrearIngresoInput {
	citaId?: string | null;
	pacienteNombre: string;
	pacienteDocumento: string;
	concepto: string;
	monto: number;
	metodoPago: string;
}
