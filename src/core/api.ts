import { appInvoke } from "./appInvoke";
import { TAURI_COMMANDS } from "./constants";
import type {
	AppSettings,
	Appointment,
	AppointmentInput,
	BackupFileInfo,
	CitasPorMes,
	Cliente,
	ClienteHomonimiaAdvertencia,
	ClienteInput,
	ClienteResumenDashboard,
	CrearIngresoInput,
	CrearPaqueteInput,
	CrearClienteYPaqueteInput,
	ClienteYPaqueteCreado,
	PaqueteCliente,
	EmitirFacturaInput,
	Evento,
	EventoInput,
	Factura,
	GuardarBorradorInput,
	IngresosPorMes,
	Ingreso,
	MovimientoFinancieroDetalle,
	MetodoPagoStats,
	OxigenoEvento,
	OxigenoResumenDia,
	UltimaLecturaOxigeno,
	RegistrarEventoOxigenoInput,
	ServicioStats,
	StartupAuthStatus,
	AdminAuthStatus,
} from "./types";

export async function getStartupAuthStatus(): Promise<StartupAuthStatus> {
	return appInvoke<StartupAuthStatus>(TAURI_COMMANDS.getStartupAuthStatus);
}

export async function verifyStartupPassword(password: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.verifyStartupPassword, { password });
}

export async function setStartupPassword(
	currentPassword: string | null,
	newPassword: string,
): Promise<void> {
	return appInvoke(TAURI_COMMANDS.setStartupPassword, {
		currentPassword,
		newPassword,
	});
}

export async function clearStartupPasswordWithAdmin(adminPassword: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.clearStartupPasswordWithAdmin, {
		adminPassword,
	});
}

export async function setStartupPasswordWithAdmin(
	adminPassword: string,
	newPassword: string,
): Promise<void> {
	return appInvoke(TAURI_COMMANDS.setStartupPasswordWithAdmin, {
		adminPassword,
		newPassword,
	});
}

export async function getAdminAuthStatus(): Promise<AdminAuthStatus> {
	return appInvoke<AdminAuthStatus>(TAURI_COMMANDS.getAdminAuthStatus);
}

export async function verifyAdminPassword(password: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.verifyAdminPassword, { password });
}

export async function setAdminPassword(
	currentPassword: string | null,
	newPassword: string,
): Promise<void> {
	return appInvoke(TAURI_COMMANDS.setAdminPassword, {
		currentPassword,
		newPassword,
	});
}

export async function clearAdminPassword(currentPassword: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.clearAdminPassword, { currentPassword });
}

export async function getSettings(): Promise<AppSettings> {
	return appInvoke<AppSettings>(TAURI_COMMANDS.getSettings);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
	return appInvoke<AppSettings>(TAURI_COMMANDS.saveSettings, { settings });
}

export async function listAppointmentsRange(
	startDate: string,
	endDate: string,
): Promise<Appointment[]> {
	return appInvoke<Appointment[]>(TAURI_COMMANDS.listAppointmentsRange, {
		startDate,
		endDate,
	});
}

export async function createAppointment(input: AppointmentInput): Promise<Appointment> {
	return appInvoke<Appointment>(TAURI_COMMANDS.createAppointment, { input });
}

export async function updateAppointment(id: string, input: AppointmentInput): Promise<Appointment> {
	return appInvoke<Appointment>(TAURI_COMMANDS.updateAppointment, {
		id,
		input,
	});
}

export async function deleteAppointment(id: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.deleteAppointment, { id });
}

export async function getAppointment(id: string): Promise<Appointment> {
	return appInvoke<Appointment>(TAURI_COMMANDS.getAppointment, { id });
}

export async function crearIngreso(input: CrearIngresoInput): Promise<Ingreso> {
	return appInvoke<Ingreso>(TAURI_COMMANDS.crearIngreso, { input });
}

export async function obtenerIngresos(startDate: string, endDate: string): Promise<Ingreso[]> {
	return appInvoke<Ingreso[]>(TAURI_COMMANDS.obtenerIngresos, { startDate, endDate });
}

export async function listarMovimientosFinancierosDetalle(
	startDate: string,
	endDate: string,
): Promise<MovimientoFinancieroDetalle[]> {
	return appInvoke<MovimientoFinancieroDetalle[]>(TAURI_COMMANDS.listarMovimientosFinancierosDetalle, {
		startDate,
		endDate,
	});
}

export async function eliminarIngreso(id: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.eliminarIngreso, { id });
}

export async function estadisticasCitasPorMes(
	startDate: string,
	endDate: string,
): Promise<CitasPorMes[]> {
	return appInvoke<CitasPorMes[]>(TAURI_COMMANDS.estadisticasCitasPorMes, {
		startDate,
		endDate,
	});
}

export async function estadisticasIngresosPorMes(
	startDate: string,
	endDate: string,
): Promise<IngresosPorMes[]> {
	return appInvoke<IngresosPorMes[]>(TAURI_COMMANDS.estadisticasIngresosPorMes, {
		startDate,
		endDate,
	});
}

export async function estadisticasServicios(
	startDate: string,
	endDate: string,
): Promise<ServicioStats[]> {
	return appInvoke<ServicioStats[]>(TAURI_COMMANDS.estadisticasServicios, {
		startDate,
		endDate,
	});
}

export async function estadisticasMetodosPago(
	startDate: string,
	endDate: string,
): Promise<MetodoPagoStats[]> {
	return appInvoke<MetodoPagoStats[]>(TAURI_COMMANDS.estadisticasMetodosPago, {
		startDate,
		endDate,
	});
}

export async function crearCliente(input: ClienteInput): Promise<Cliente> {
	return appInvoke<Cliente>(TAURI_COMMANDS.crearCliente, { input });
}

export async function actualizarCliente(id: string, input: ClienteInput): Promise<Cliente> {
	return appInvoke<Cliente>(TAURI_COMMANDS.actualizarCliente, { id, input });
}

export async function advertenciaHomonimiaCliente(
	nombres: string,
	apellidos: string,
	excluirClienteId?: string | null,
): Promise<ClienteHomonimiaAdvertencia | null> {
	return appInvoke<ClienteHomonimiaAdvertencia | null>(TAURI_COMMANDS.advertenciaHomonimiaCliente, {
		nombres,
		apellidos,
		excluirClienteId: excluirClienteId ?? null,
	});
}

export async function buscarClientes(query: string): Promise<Cliente[]> {
	return appInvoke<Cliente[]>(TAURI_COMMANDS.buscarClientes, { query });
}

export async function obtenerCliente(id: string): Promise<Cliente> {
	return appInvoke<Cliente>(TAURI_COMMANDS.obtenerCliente, { id });
}

export async function obtenerResumenClienteDashboard(
	clienteId: string,
): Promise<ClienteResumenDashboard> {
	return appInvoke<ClienteResumenDashboard>(TAURI_COMMANDS.obtenerResumenClienteDashboard, {
		clienteId,
	});
}

export async function eliminarCliente(id: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.eliminarCliente, { id });
}

export async function listarPaquetesCliente(clienteId: string): Promise<PaqueteCliente[]> {
	return appInvoke<PaqueteCliente[]>(TAURI_COMMANDS.listarPaquetesCliente, {
		clienteId,
	});
}

export async function crearPaquete(input: CrearPaqueteInput): Promise<PaqueteCliente> {
	return appInvoke<PaqueteCliente>(TAURI_COMMANDS.crearPaquete, { input });
}

export async function crearClienteYPaquete(
	input: CrearClienteYPaqueteInput,
): Promise<ClienteYPaqueteCreado> {
	return appInvoke<ClienteYPaqueteCreado>(TAURI_COMMANDS.crearClienteYPaquete, { input });
}

export async function listarFacturas(
	startDate: string,
	endDate: string,
	estado?: string,
): Promise<Factura[]> {
	return appInvoke<Factura[]>(TAURI_COMMANDS.listarFacturas, {
		startDate,
		endDate,
		estado: estado ?? null,
	});
}

export async function obtenerFactura(id: string): Promise<Factura> {
	return appInvoke<Factura>(TAURI_COMMANDS.obtenerFactura, { id });
}

export async function guardarBorradorFactura(input: GuardarBorradorInput): Promise<Factura> {
	return appInvoke<Factura>(TAURI_COMMANDS.guardarBorradorFactura, { input });
}

export async function emitirFactura(input: EmitirFacturaInput): Promise<Factura> {
	return appInvoke<Factura>(TAURI_COMMANDS.emitirFactura, { input });
}

export async function anularFactura(id: string, motivo: string): Promise<Factura> {
	return appInvoke<Factura>(TAURI_COMMANDS.anularFactura, { id, motivo });
}

export async function listarEventosRango(startDate: string, endDate: string): Promise<Evento[]> {
	return appInvoke<Evento[]>(TAURI_COMMANDS.listarEventosRango, { startDate, endDate });
}

export async function crearEvento(input: EventoInput): Promise<Evento> {
	return appInvoke<Evento>(TAURI_COMMANDS.crearEvento, { input });
}

export async function actualizarEvento(id: string, input: EventoInput): Promise<Evento> {
	return appInvoke<Evento>(TAURI_COMMANDS.actualizarEvento, { id, input });
}

export async function eliminarEvento(id: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.eliminarEvento, { id });
}

export async function listarOxigenoPorRango(
	fechaDesde: string,
	fechaHasta: string,
): Promise<OxigenoEvento[]> {
	return appInvoke<OxigenoEvento[]>(TAURI_COMMANDS.listarOxigenoPorRango, {
		fechaDesde,
		fechaHasta,
	});
}

export async function registrarEventoOxigeno(
	input: RegistrarEventoOxigenoInput,
): Promise<OxigenoEvento> {
	return appInvoke<OxigenoEvento>(TAURI_COMMANDS.registrarEventoOxigeno, {
		input,
	});
}

export async function resumenOxigenoRango(
	fechaDesde: string,
	fechaHasta: string,
): Promise<OxigenoResumenDia[]> {
	return appInvoke<OxigenoResumenDia[]>(TAURI_COMMANDS.resumenOxigenoRango, {
		fechaDesde,
		fechaHasta,
	});
}

export async function leerFotoOxigeno(fotoRelativa: string): Promise<number[]> {
	return appInvoke<number[]>(TAURI_COMMANDS.leerFotoOxigeno, { fotoRelativa });
}

export async function obtenerUltimaLecturaOxigeno(): Promise<UltimaLecturaOxigeno | null> {
	return appInvoke<UltimaLecturaOxigeno | null>(TAURI_COMMANDS.obtenerUltimaLecturaOxigeno);
}

export async function listarRespaldosLocales(): Promise<BackupFileInfo[]> {
	return appInvoke<BackupFileInfo[]>(TAURI_COMMANDS.listarRespaldosLocales);
}

export async function restaurarRespaldo(sourcePath: string, adminPassword: string): Promise<void> {
	return appInvoke(TAURI_COMMANDS.restaurarRespaldo, {
		sourcePath,
		adminPassword,
	});
}
