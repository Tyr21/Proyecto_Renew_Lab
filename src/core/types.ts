export type TimeDisplay = "12h" | "24h";

export type AppointmentStatus = "pendiente" | "asistio" | "no_asistio";

export interface ServiceTypeSetting {
	id: string;
	label: string;
	concurrentCapacity: number;
	/** Precio sugerido para cobros (misma moneda que ingresos). 0 = sin sugerencia en UI. */
	suggestedPrice: number;
}

export interface BillingSettings {
	razonSocial: string;
	nit: string;
	direccion: string;
	telefono: string;
	serieDefault: string;
	ivaDefaultPct: number;
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
	billing: BillingSettings;
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

export interface CitasPorMes {
	mes: string;
	totalCitas: number;
	asistieron: number;
	noAsistieron: number;
	porcentajeAsistencia: number;
}

export interface IngresosPorMes {
	mes: string;
	montoTotal: number;
	cantidadTransacciones: number;
	montoPromedio: number;
}

export interface ServicioStats {
	serviceType: string;
	totalCitas: number;
	asistieron: number;
	porcentajeAsistencia: number;
}

export interface MetodoPagoStats {
	metodoPago: string;
	montoTotal: number;
	cantidadTransacciones: number;
	porcentajeDelTotal: number;
}

export interface Cliente {
	id: string;
	nombres: string;
	apellidos: string;
	documentType: string;
	documentNumber: string;
	phoneDialCode: string;
	phoneNationalNumber: string;
	email: string;
	birthdayMonth: number | null;
	notas: string;
	createdAt: string;
	updatedAt: string;
}

export interface ClienteInput {
	nombres: string;
	apellidos: string;
	documentType: string;
	documentNumber: string;
	phoneDialCode: string;
	phoneNationalNumber: string;
	email: string;
	birthdayMonth: number | null;
	notas: string;
}

export type FacturaEstado = "borrador" | "emitida" | "anulada";

export interface FacturaLinea {
	id: string;
	facturaId: string;
	orden: number;
	descripcion: string;
	cantidad: number;
	precioUnitario: number;
	tasaImpuestoPct: number;
	baseImponible: number;
	impuesto: number;
	totalLinea: number;
}

export interface FacturaLineaInput {
	descripcion: string;
	cantidad: number;
	precioUnitario: number;
	tasaImpuestoPct: number;
}

export interface Factura {
	id: string;
	estado: FacturaEstado;
	serie: string;
	numero: number | null;
	clienteNombre: string;
	clienteDocumentoTipo: string;
	clienteDocumentoNumero: string;
	subtotal: number;
	impuestoTotal: number;
	total: number;
	notas: string;
	citaId: string | null;
	fechaEmision: string | null;
	anulacionMotivo: string | null;
	anuladaAt: string | null;
	createdAt: string;
	updatedAt: string;
	lineas: FacturaLinea[];
}

export interface GuardarBorradorInput {
	id?: string;
	clienteNombre: string;
	clienteDocumentoTipo: string;
	clienteDocumentoNumero: string;
	notas: string;
	citaId?: string | null;
	lineas: FacturaLineaInput[];
}

export interface EmitirFacturaInput {
	facturaId: string;
	metodoPago: string;
	crearIngreso: boolean;
}

export const EVENTO_COLORS = ["amber", "rose", "violet", "teal", "sky", "slate"] as const;
export type EventoColor = (typeof EVENTO_COLORS)[number];

export interface Evento {
	id: string;
	titulo: string;
	descripcion: string;
	fecha: string;
	todoElDia: boolean;
	horaInicio: string | null;
	horaFin: string | null;
	color: EventoColor;
	createdAt: string;
	updatedAt: string;
}

export interface EventoInput {
	titulo: string;
	descripcion?: string;
	fecha: string;
	todoElDia: boolean;
	horaInicio?: string | null;
	horaFin?: string | null;
	color?: EventoColor;
}
