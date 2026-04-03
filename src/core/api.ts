import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "./constants";
import type {
	AppSettings,
	Appointment,
	AppointmentInput,
	CitasPorMes,
	Cliente,
	ClienteInput,
	CrearIngresoInput,
	IngresosPorMes,
	Ingreso,
	MetodoPagoStats,
	ServicioStats,
} from "./types";

export async function getSettings(): Promise<AppSettings> {
	return invoke<AppSettings>(TAURI_COMMANDS.getSettings);
}

export async function saveSettings(
	settings: AppSettings,
): Promise<AppSettings> {
	return invoke<AppSettings>(TAURI_COMMANDS.saveSettings, { settings });
}

export async function listAppointmentsRange(
	startDate: string,
	endDate: string,
): Promise<Appointment[]> {
	return invoke<Appointment[]>(TAURI_COMMANDS.listAppointmentsRange, {
		startDate,
		endDate,
	});
}

export async function createAppointment(
	input: AppointmentInput,
): Promise<Appointment> {
	return invoke<Appointment>(TAURI_COMMANDS.createAppointment, { input });
}

export async function updateAppointment(
	id: string,
	input: AppointmentInput,
): Promise<Appointment> {
	return invoke<Appointment>(TAURI_COMMANDS.updateAppointment, {
		id,
		input,
	});
}

export async function deleteAppointment(id: string): Promise<void> {
	return invoke(TAURI_COMMANDS.deleteAppointment, { id });
}

export async function getAppointment(id: string): Promise<Appointment> {
	return invoke<Appointment>(TAURI_COMMANDS.getAppointment, { id });
}

export async function crearIngreso(
	input: CrearIngresoInput,
): Promise<Ingreso> {
	return invoke<Ingreso>(TAURI_COMMANDS.crearIngreso, { input });
}

export async function obtenerIngresos(
	startDate: string,
	endDate: string,
): Promise<Ingreso[]> {
	return invoke<Ingreso[]>(TAURI_COMMANDS.obtenerIngresos, { startDate, endDate });
}

export async function eliminarIngreso(id: string): Promise<void> {
	return invoke(TAURI_COMMANDS.eliminarIngreso, { id });
}

export async function estadisticasCitasPorMes(
	startDate: string,
	endDate: string,
): Promise<CitasPorMes[]> {
	return invoke<CitasPorMes[]>(TAURI_COMMANDS.estadisticasCitasPorMes, {
		startDate,
		endDate,
	});
}

export async function estadisticasIngresosPorMes(
	startDate: string,
	endDate: string,
): Promise<IngresosPorMes[]> {
	return invoke<IngresosPorMes[]>(TAURI_COMMANDS.estadisticasIngresosPorMes, {
		startDate,
		endDate,
	});
}

export async function estadisticasServicios(
	startDate: string,
	endDate: string,
): Promise<ServicioStats[]> {
	return invoke<ServicioStats[]>(TAURI_COMMANDS.estadisticasServicios, {
		startDate,
		endDate,
	});
}

export async function estadisticasMetodosPago(
	startDate: string,
	endDate: string,
): Promise<MetodoPagoStats[]> {
	return invoke<MetodoPagoStats[]>(TAURI_COMMANDS.estadisticasMetodosPago, {
		startDate,
		endDate,
	});
}

export async function crearCliente(input: ClienteInput): Promise<Cliente> {
	return invoke<Cliente>(TAURI_COMMANDS.crearCliente, { input });
}

export async function actualizarCliente(
	id: string,
	input: ClienteInput,
): Promise<Cliente> {
	return invoke<Cliente>(TAURI_COMMANDS.actualizarCliente, { id, input });
}

export async function buscarClientes(query: string): Promise<Cliente[]> {
	return invoke<Cliente[]>(TAURI_COMMANDS.buscarClientes, { query });
}

export async function obtenerCliente(id: string): Promise<Cliente> {
	return invoke<Cliente>(TAURI_COMMANDS.obtenerCliente, { id });
}

export async function eliminarCliente(id: string): Promise<void> {
	return invoke(TAURI_COMMANDS.eliminarCliente, { id });
}
