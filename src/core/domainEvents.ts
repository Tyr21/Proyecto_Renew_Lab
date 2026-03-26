import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "./constants";
import { emitDomainEventLocal } from "./eventBus";
import type {
	Appointment,
	DomainEventName,
	DomainEventPayload,
} from "./types";

export function buildDomainPayload(row: Appointment): DomainEventPayload {
	return {
		cita_id: row.id,
		paciente_documento: row.documentNumber,
		tipo_servicio: row.serviceType,
		estado: row.status,
		timestamp: new Date().toISOString(),
	};
}

export async function publishDomainEvent(
	name: DomainEventName,
	row: Appointment,
): Promise<void> {
	const payload = buildDomainPayload(row);
	emitDomainEventLocal(name, payload);
	await invoke(TAURI_COMMANDS.logDomainEvent, {
		input: {
			eventName: name,
			payload,
		},
	});
}
