import { TAURI_COMMANDS } from "./constants";
import type {
	AdminAuthStatus,
	AppSettings,
	Appointment,
	AppointmentInput,
	BackupFileInfo,
	CitasPorMes,
	Cliente,
	ClienteInput,
	ClienteResumenDashboard,
	ClienteYPaqueteCreado,
	CrearClienteYPaqueteInput,
	CrearIngresoInput,
	CrearPaqueteInput,
	EmitirFacturaInput,
	Evento,
	EventoInput,
	Factura,
	GuardarBorradorInput,
	IngresosPorMes,
	Ingreso,
	MetodoPagoStats,
	MovimientoFinancieroDetalle,
	OxigenoEvento,
	OxigenoResumenDia,
	PaqueteCliente,
	ServicioStats,
	StartupAuthStatus,
	UltimaLecturaOxigeno,
} from "./types";

declare global {
	interface Window {
		/** Playwright: simular pantalla de contraseña de inicio. */
		__E2E_HAS_STARTUP_PASSWORD__?: boolean;
	}
}

const E2E_STARTUP_PASSWORD = "e2e-secret";

const E2E_SETTINGS: AppSettings = {
	showSundays: true,
	timeDisplay: "24h",
	defaultDurationMinutes: 60,
	documentTypes: ["CC", "CE"],
	defaultDocumentType: "CC",
	serviceTypes: [
		{
			id: "svc_a",
			label: "Servicio E2E",
			concurrentCapacity: 4,
			suggestedPrice: 80_000,
		},
	],
	adminMode: false,
	billing: {
		razonSocial: "Renew Lab E2E",
		nit: "900000000",
		direccion: "Calle E2E",
		telefono: "0",
		serieDefault: "F",
		ivaDefaultPct: 19,
	},
	backup: {
		enabled: false,
		retentionCount: 5,
		externalPath: "",
	},
	oxygen: {
		unitsLabel: "L",
		perHyperbaricSession: 1,
		serviceTypeId: "svc_a",
	},
};

function newId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appointmentFromInput(input: AppointmentInput): Appointment {
	const st = input.status ?? "pendiente";
	return {
		id: newId("apt"),
		patientFullName: input.patientFullName,
		documentType: input.documentType,
		documentNumber: input.documentNumber,
		phoneDialCode: input.phoneDialCode,
		phoneNationalNumber: input.phoneNationalNumber,
		birthdayMonth: input.birthdayMonth ?? null,
		appointmentDate: input.appointmentDate,
		startTime: input.startTime,
		endTime: input.endTime,
		serviceType: input.serviceType,
		status: st,
		createdAt: "",
		updatedAt: "",
		isPaid: false,
		paqueteId: input.paqueteId ?? null,
	};
}

function e2eStartupHasPassword(): boolean {
	if (typeof window === "undefined") return false;
	return Boolean(window.__E2E_HAS_STARTUP_PASSWORD__);
}

/**
 * Respuestas deterministas para `VITE_E2E_MOCK_TAURI=true` (Playwright en navegador, sin Tauri).
 */
export function runE2EInvokeMock(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
	switch (cmd) {
		case TAURI_COMMANDS.getStartupAuthStatus: {
			const v: StartupAuthStatus = { hasPassword: e2eStartupHasPassword() };
			return Promise.resolve(v);
		}
		case TAURI_COMMANDS.verifyStartupPassword: {
			const p = (args as { password?: string } | undefined)?.password;
			if (p !== E2E_STARTUP_PASSWORD) {
				return Promise.reject(new Error("Contraseña incorrecta"));
			}
			return Promise.resolve(undefined);
		}
		case TAURI_COMMANDS.setStartupPassword:
		case TAURI_COMMANDS.clearStartupPasswordWithAdmin:
		case TAURI_COMMANDS.setStartupPasswordWithAdmin:
		case TAURI_COMMANDS.verifyAdminPassword:
		case TAURI_COMMANDS.setAdminPassword:
		case TAURI_COMMANDS.clearAdminPassword:
		case TAURI_COMMANDS.deleteAppointment:
		case TAURI_COMMANDS.eliminarIngreso:
		case TAURI_COMMANDS.eliminarCliente:
		case TAURI_COMMANDS.eliminarEvento:
		case TAURI_COMMANDS.restaurarRespaldo:
			return Promise.resolve(undefined);

		case TAURI_COMMANDS.emitirFactura: {
			const { facturaId } = args as unknown as EmitirFacturaInput;
			const f: Factura = {
				id: facturaId,
				estado: "emitida",
				serie: "F",
				numero: 1,
				clienteNombre: "E2E",
				clienteDocumentoTipo: "CC",
				clienteDocumentoNumero: "1",
				subtotal: 100,
				impuestoTotal: 19,
				total: 119,
				notas: "",
				citaId: null,
				fechaEmision: new Date().toISOString(),
				anulacionMotivo: null,
				anuladaAt: null,
				createdAt: "",
				updatedAt: "",
				lineas: [],
			};
			return Promise.resolve(f);
		}
		case TAURI_COMMANDS.anularFactura: {
			const { id } = args as { id: string; motivo: string };
			const f: Factura = {
				id,
				estado: "anulada",
				serie: "F",
				numero: 1,
				clienteNombre: "",
				clienteDocumentoTipo: "CC",
				clienteDocumentoNumero: "",
				subtotal: 0,
				impuestoTotal: 0,
				total: 0,
				notas: "",
				citaId: null,
				fechaEmision: null,
				anulacionMotivo: "e2e",
				anuladaAt: new Date().toISOString(),
				createdAt: "",
				updatedAt: "",
				lineas: [],
			};
			return Promise.resolve(f);
		}

		case TAURI_COMMANDS.getAdminAuthStatus: {
			const v: AdminAuthStatus = { hasPassword: false };
			return Promise.resolve(v);
		}
		case TAURI_COMMANDS.getSettings:
			return Promise.resolve(E2E_SETTINGS);
		case TAURI_COMMANDS.saveSettings: {
			const s = (args as { settings: AppSettings }).settings;
			return Promise.resolve(s);
		}
		case TAURI_COMMANDS.listAppointmentsRange:
			return Promise.resolve([] as Appointment[]);
		case TAURI_COMMANDS.listarEventosRango:
			return Promise.resolve([] as Evento[]);
		case TAURI_COMMANDS.createAppointment: {
			const input = (args as { input: AppointmentInput }).input;
			return Promise.resolve(appointmentFromInput(input));
		}
		case TAURI_COMMANDS.updateAppointment: {
			const { id, input } = args as { id: string; input: AppointmentInput };
			return Promise.resolve({ ...appointmentFromInput(input), id });
		}
		case TAURI_COMMANDS.getAppointment: {
			const id = (args as { id: string }).id;
			const a = appointmentFromInput({
				patientFullName: "Mock",
				documentType: "CC",
				documentNumber: "1",
				phoneDialCode: "+57",
				phoneNationalNumber: "300",
				birthdayMonth: null,
				appointmentDate: "2099-01-02",
				startTime: "09:00",
				endTime: "10:00",
				serviceType: "svc_a",
				status: "pendiente",
				paqueteId: null,
			});
			return Promise.resolve({ ...a, id });
		}
		case TAURI_COMMANDS.buscarClientes:
			return Promise.resolve([] as Cliente[]);
		case TAURI_COMMANDS.buscarClientePorDocumentoExacto:
			return Promise.resolve(null as Cliente | null);
		case TAURI_COMMANDS.listarPaquetesCliente:
			return Promise.resolve([] as PaqueteCliente[]);
		case TAURI_COMMANDS.crearCliente: {
			const input = (args as { input: ClienteInput }).input;
			const c: Cliente = {
				id: newId("cli"),
				...input,
				createdAt: "",
				updatedAt: "",
			};
			return Promise.resolve(c);
		}
		case TAURI_COMMANDS.actualizarCliente: {
			const { id, input } = args as { id: string; input: ClienteInput };
			const c: Cliente = { id, ...input, createdAt: "", updatedAt: "" };
			return Promise.resolve(c);
		}
		case TAURI_COMMANDS.advertenciaHomonimiaCliente:
			return Promise.resolve(null);
		case TAURI_COMMANDS.obtenerCliente: {
			const input = (args as { id: string }).id;
			const c: Cliente = {
				id: input,
				nombres: "E2E",
				apellidos: "Cliente",
				documentType: "CC",
				documentNumber: "1",
				phoneDialCode: "+57",
				phoneNationalNumber: "300",
				email: "",
				birthdayMonth: null,
				notas: "",
				createdAt: "",
				updatedAt: "",
			};
			return Promise.resolve(c);
		}
		case TAURI_COMMANDS.obtenerResumenClienteDashboard: {
			const id = (args as { id: string }).id;
			const cliente: Cliente = {
				id,
				nombres: "E2E",
				apellidos: "Resumen",
				documentType: "CC",
				documentNumber: "1",
				phoneDialCode: "+57",
				phoneNationalNumber: "300",
				email: "",
				birthdayMonth: null,
				notas: "",
				createdAt: "",
				updatedAt: "",
			};
			const r: ClienteResumenDashboard = {
				cliente,
				ultimosServicios: [],
				proximasCitas: [],
			};
			return Promise.resolve(r);
		}
		case TAURI_COMMANDS.crearIngreso: {
			const input = (args as { input: CrearIngresoInput }).input;
			const ing: Ingreso = {
				id: newId("ing"),
				citaId: input.citaId ?? null,
				pacienteNombre: input.pacienteNombre,
				pacienteDocumento: input.pacienteDocumento,
				concepto: input.concepto,
				monto: input.monto,
				metodoPago: input.metodoPago,
				fechaPago: new Date().toISOString(),
			};
			return Promise.resolve(ing);
		}
		case TAURI_COMMANDS.obtenerIngresos:
			return Promise.resolve([] as Ingreso[]);
		case TAURI_COMMANDS.listarMovimientosFinancierosDetalle:
			return Promise.resolve([] as MovimientoFinancieroDetalle[]);
		case TAURI_COMMANDS.estadisticasCitasPorMes:
			return Promise.resolve([] as CitasPorMes[]);
		case TAURI_COMMANDS.estadisticasIngresosPorMes:
			return Promise.resolve([] as IngresosPorMes[]);
		case TAURI_COMMANDS.estadisticasServicios:
			return Promise.resolve([] as ServicioStats[]);
		case TAURI_COMMANDS.estadisticasMetodosPago:
			return Promise.resolve([] as MetodoPagoStats[]);
		case TAURI_COMMANDS.crearPaquete: {
			const inp = args as unknown as CrearPaqueteInput;
			const p: PaqueteCliente = {
				id: newId("pq"),
				clienteId: inp.clienteId,
				serviceType: inp.serviceType,
				totalSesiones: inp.totalSesiones,
				precioTotal: inp.precioTotal,
				status: "activo",
				expiresAt: inp.expiresAt ?? null,
				createdAt: "",
				updatedAt: "",
				consumidas: 0,
				reservadas: 0,
				restantes: inp.totalSesiones,
			};
			return Promise.resolve(p);
		}
		case TAURI_COMMANDS.crearClienteYPaquete: {
			const raw = args as unknown as CrearClienteYPaqueteInput;
			const cliente: Cliente = {
				id: newId("cli"),
				nombres: raw.cliente.nombres,
				apellidos: raw.cliente.apellidos,
				documentType: raw.cliente.documentType,
				documentNumber: raw.cliente.documentNumber,
				phoneDialCode: raw.cliente.phoneDialCode,
				phoneNationalNumber: raw.cliente.phoneNationalNumber,
				email: raw.cliente.email,
				birthdayMonth: raw.cliente.birthdayMonth,
				notas: raw.cliente.notas,
				createdAt: "",
				updatedAt: "",
			};
			const paquete: PaqueteCliente = {
				id: newId("pq"),
				clienteId: cliente.id,
				serviceType: raw.serviceType,
				totalSesiones: raw.totalSesiones,
				precioTotal: raw.precioTotal,
				status: "activo",
				expiresAt: raw.expiresAt ?? null,
				createdAt: "",
				updatedAt: "",
				consumidas: 0,
				reservadas: 0,
				restantes: raw.totalSesiones,
			};
			const out: ClienteYPaqueteCreado = { cliente, paquete };
			return Promise.resolve(out);
		}
		case TAURI_COMMANDS.listarFacturas:
			return Promise.resolve([] as Factura[]);
		case TAURI_COMMANDS.obtenerFactura: {
			const f: Factura = {
				id: (args as { id: string }).id,
				estado: "borrador",
				serie: "F",
				numero: null,
				clienteNombre: "",
				clienteDocumentoTipo: "CC",
				clienteDocumentoNumero: "",
				subtotal: 0,
				impuestoTotal: 0,
				total: 0,
				notas: "",
				citaId: null,
				fechaEmision: null,
				anulacionMotivo: null,
				anuladaAt: null,
				createdAt: "",
				updatedAt: "",
				lineas: [],
			};
			return Promise.resolve(f);
		}
		case TAURI_COMMANDS.guardarBorradorFactura: {
			const input = (args as { input: GuardarBorradorInput }).input;
			const f: Factura = {
				id: input.id ?? newId("fac"),
				estado: "borrador",
				serie: "F",
				numero: null,
				clienteNombre: input.clienteNombre,
				clienteDocumentoTipo: input.clienteDocumentoTipo,
				clienteDocumentoNumero: input.clienteDocumentoNumero,
				subtotal: 0,
				impuestoTotal: 0,
				total: 0,
				notas: input.notas,
				citaId: input.citaId ?? null,
				fechaEmision: null,
				anulacionMotivo: null,
				anuladaAt: null,
				createdAt: "",
				updatedAt: "",
				lineas: [],
			};
			return Promise.resolve(f);
		}
		case TAURI_COMMANDS.crearEvento: {
			const input = args as { input: EventoInput };
			const i = input.input;
			const ev: Evento = {
				id: newId("ev"),
				titulo: i.titulo,
				descripcion: i.descripcion ?? "",
				fecha: i.fecha,
				todoElDia: i.todoElDia,
				horaInicio: i.horaInicio ?? null,
				horaFin: i.horaFin ?? null,
				color: i.color ?? "sky",
				createdAt: "",
				updatedAt: "",
			};
			return Promise.resolve(ev);
		}
		case TAURI_COMMANDS.actualizarEvento: {
			const { id, input } = args as { id: string; input: EventoInput };
			const i = input;
			const ev: Evento = {
				id,
				titulo: i.titulo,
				descripcion: i.descripcion ?? "",
				fecha: i.fecha,
				todoElDia: i.todoElDia,
				horaInicio: i.horaInicio ?? null,
				horaFin: i.horaFin ?? null,
				color: i.color ?? "sky",
				createdAt: "",
				updatedAt: "",
			};
			return Promise.resolve(ev);
		}
		case TAURI_COMMANDS.listarOxigenoPorRango:
			return Promise.resolve([] as OxigenoEvento[]);
		case TAURI_COMMANDS.registrarEventoOxigeno: {
			const o: OxigenoEvento = {
				id: newId("ox"),
				fechaOperacion: "",
				tipo: "recarga_pipeta",
				medidorA: 0,
				medidorB: 0,
				saldoEnfermeria: null,
				notas: "",
				fotoRelativa: null,
				fotoExifFecha: null,
				createdAt: "",
			};
			return Promise.resolve(o);
		}
		case TAURI_COMMANDS.resumenOxigenoRango:
			return Promise.resolve([] as OxigenoResumenDia[]);
		case TAURI_COMMANDS.leerFotoOxigeno:
			return Promise.resolve([] as number[]);
		case TAURI_COMMANDS.obtenerUltimaLecturaOxigeno:
			return Promise.resolve(null as UltimaLecturaOxigeno | null);
		case TAURI_COMMANDS.listarRespaldosLocales:
			return Promise.resolve([] as BackupFileInfo[]);
		default:
			console.warn(`[e2e mock] comando no contemplado: ${cmd}`);
			return Promise.resolve(null);
	}
}

/** Contraseña de inicio esperada en e2e cuando `__E2E_HAS_STARTUP_PASSWORD__` está activo (documentado en README). */
export const E2E_EXPECTED_STARTUP_PASSWORD = E2E_STARTUP_PASSWORD;
