import type { DomainEventName, DomainEventPayload } from "./types";

const BUS = new EventTarget();

export function subscribeDomainEvent(
	name: DomainEventName,
	handler: (payload: DomainEventPayload) => void,
): () => void {
	const fn = ((ev: Event) => {
		const ce = ev as CustomEvent<DomainEventPayload>;
		handler(ce.detail);
	}) as EventListener;
	BUS.addEventListener(name, fn);
	return () => BUS.removeEventListener(name, fn);
}

export function emitDomainEventLocal(
	name: DomainEventName,
	payload: DomainEventPayload,
): void {
	BUS.dispatchEvent(new CustomEvent(name, { detail: payload }));
}
