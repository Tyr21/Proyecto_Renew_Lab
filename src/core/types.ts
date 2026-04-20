export type TimeDisplay = "12h" | "24h";

export type AppointmentStatus = "pendiente" | "asistio" | "no_asistio";

/** Plan de paquete (N sesiones, precio total antes de IVA) configurable por servicio. */
export interface ServicePackagePlanSetting {
	id: string;
	label: string;
	sessionCount: number;
	priceBeforeVat: number;
}

export interface ServiceTypeSetting {
	id: string;
	label: string;
	concurrentCapacity: number;
	/** Precio sugerido para cobros (misma moneda que ingresos). 0 = sin sugerencia en UI. */
	suggestedPrice: number;
	/** Planes de venta por volumen; vacío hasta configurarlos en Ajustes. */
	packagePlans?: ServicePackagePlanSetting[];
}

export interface BillingSettings {
	razonSocial: string;
	nit: string;
	direccion: string;
	telefono: string;
	serieDefault: string;
	ivaDefaultPct: number;
}

export interface BackupSettings {
	enabled: boolean;
	retentionCount: number;
	externalPath: string;
}

/** Estado de la contraseña de inicio (el hash nunca sale del backend). */
export interface StartupAuthStatus {
	hasPassword: boolean;
}

/** Estado de la contraseña de administrador (el hash nunca sale del backend). */
export interface AdminAuthStatus {
	hasPassword: boolean;
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
	backup: BackupSettings;
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
	/** Paquete prepagado del que descuenta la sesión, si aplica. */
	paqueteId?: string | null;
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
	/** UUID del paquete o `null` para quitar vínculo al editar. */
	paqueteId?: string | null;
}

export interface DomainEventPayload {
	cita_id: string;
	paciente_nombre: string;
	paciente_documento: string;
	tipo_servicio: string;
	estado: string;
	timestamp: string;
	paquete_id?: string;
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

/** Ingreso con factura vinculada opcional (listados / impresión). */
export interface MovimientoFinancieroDetalle {
	id: string;
	fechaPago: string;
	pacienteNombre: string;
	pacienteDocumento: string;
	concepto: string;
	monto: number;
	metodoPago: string;
	facturaId: string | null;
	facturaSerie: string | null;
	facturaNumero: number | null;
	facturaTotal: number | null;
	/** Venta de paquete (sin factura); referencia al paquete en BD. */
	paqueteId?: string | null;
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

/** Cita resumida para la ficha del cliente (historial / próximas). */
export interface CitaResumenCliente {
	id: string;
	appointmentDate: string;
	startTime: string;
	endTime: string;
	serviceType: string;
	status: string;
	isPaid: boolean;
	paqueteId?: string | null;
}

export interface ClienteResumenDashboard {
	cliente: Cliente;
	ultimosServicios: CitaResumenCliente[];
	proximasCitas: CitaResumenCliente[];
}

export interface PaqueteCliente {
	id: string;
	clienteId: string;
	serviceType: string;
	totalSesiones: number;
	precioTotal: number;
	status: string;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
	consumidas: number;
	reservadas: number;
	restantes: number;
}

/** Datos del plan elegido al continuar al modal de cobro (el padre añade nombre/documento si hace falta). */
export interface PaqueteVentaContinuePayload {
	clienteId?: string;
	nuevoCliente?: ClienteInput;
	serviceType: string;
	totalSesiones: number;
	precioTotalConIva: number;
	ingresoConcepto: string;
}

/** Contexto para el modal de cobro de un plan (tras elegir el plan configurado). */
export interface PackagePaymentContext {
	clienteId?: string;
	nuevoCliente?: ClienteInput;
	serviceType: string;
	totalSesiones: number;
	expectedPrecioTotalConIva: number;
	ingresoConcepto: string;
	pacienteNombre: string;
	pacienteDocumento: string;
}

export interface CrearPaqueteInput {
	clienteId: string;
	serviceType: string;
	totalSesiones: number;
	precioTotal: number;
	metodoPago: string;
	expiresAt?: string | null;
	/** Concepto del ingreso; si se omite, el backend usa el texto por defecto. */
	ingresoConcepto?: string | null;
}

export interface CrearClienteYPaqueteInput {
	cliente: ClienteInput;
	serviceType: string;
	totalSesiones: number;
	precioTotal: number;
	metodoPago: string;
	expiresAt?: string | null;
	ingresoConcepto?: string | null;
}

export interface ClienteYPaqueteCreado {
	cliente: Cliente;
	paquete: PaqueteCliente;
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
