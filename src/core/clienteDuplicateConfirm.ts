import {
	actualizarCliente,
	crearCliente,
	crearClienteYPaquete,
} from "./api";
import { formatInvokeError } from "./errors";
import type {
	Cliente,
	ClienteInput,
	ClienteYPaqueteCreado,
	CrearClienteYPaqueteInput,
} from "./types";

/** Debe coincidir con `CONFIRM_DUPLICATE_FULL_NAME_PREFIX` en `src-tauri/src/clientes.rs`. */
export const CLIENTE_CONFIRM_DUPLICATE_FULL_NAME_PREFIX = "[CONFIRM_DUPLICATE_FULL_NAME] ";

export function isConfirmDuplicateFullNameMessage(msg: string): boolean {
	return msg.startsWith(CLIENTE_CONFIRM_DUPLICATE_FULL_NAME_PREFIX);
}

export function messageWithoutDuplicateFullNamePrefix(msg: string): string {
	return msg.slice(CLIENTE_CONFIRM_DUPLICATE_FULL_NAME_PREFIX.length);
}

export async function crearClienteRespectingDuplicateNameConfirm(
	input: ClienteInput,
): Promise<Cliente> {
	try {
		return await crearCliente(input);
	} catch (e) {
		const msg = formatInvokeError(e);
		if (
			isConfirmDuplicateFullNameMessage(msg) &&
			typeof window !== "undefined" &&
			window.confirm(messageWithoutDuplicateFullNamePrefix(msg))
		) {
			return await crearCliente({ ...input, confirmDuplicateFullName: true });
		}
		throw e;
	}
}

export async function actualizarClienteRespectingDuplicateNameConfirm(
	id: string,
	input: ClienteInput,
): Promise<Cliente> {
	try {
		return await actualizarCliente(id, input);
	} catch (e) {
		const msg = formatInvokeError(e);
		if (
			isConfirmDuplicateFullNameMessage(msg) &&
			typeof window !== "undefined" &&
			window.confirm(messageWithoutDuplicateFullNamePrefix(msg))
		) {
			return await actualizarCliente(id, { ...input, confirmDuplicateFullName: true });
		}
		throw e;
	}
}

export async function crearClienteYPaqueteRespectingDuplicateNameConfirm(
	input: CrearClienteYPaqueteInput,
): Promise<ClienteYPaqueteCreado> {
	try {
		return await crearClienteYPaquete(input);
	} catch (e) {
		const msg = formatInvokeError(e);
		if (
			isConfirmDuplicateFullNameMessage(msg) &&
			typeof window !== "undefined" &&
			window.confirm(messageWithoutDuplicateFullNamePrefix(msg))
		) {
			return await crearClienteYPaquete({
				...input,
				cliente: { ...input.cliente, confirmDuplicateFullName: true },
			});
		}
		throw e;
	}
}
