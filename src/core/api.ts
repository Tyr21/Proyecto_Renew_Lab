import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "./constants";
import type {
	AppSettings,
	Appointment,
	AppointmentInput,
	CrearIngresoInput,
	Ingreso,
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

export async function obtenerIngresos(): Promise<Ingreso[]> {
	return invoke<Ingreso[]>(TAURI_COMMANDS.obtenerIngresos);
}

export async function eliminarIngreso(id: string): Promise<void> {
	return invoke(TAURI_COMMANDS.eliminarIngreso, { id });
}
