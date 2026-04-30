import { describe, expect, it } from "vitest";
import {
	CLIENTE_CONFIRM_DUPLICATE_FULL_NAME_PREFIX,
	isConfirmDuplicateFullNameMessage,
	messageWithoutDuplicateFullNamePrefix,
} from "./clienteDuplicateConfirm";

describe("clienteDuplicateConfirm", () => {
	it("detecta el prefijo de homonimia", () => {
		const msg = `${CLIENTE_CONFIRM_DUPLICATE_FULL_NAME_PREFIX}Detalle para el usuario.`;
		expect(isConfirmDuplicateFullNameMessage(msg)).toBe(true);
		expect(messageWithoutDuplicateFullNamePrefix(msg)).toBe("Detalle para el usuario.");
	});

	it("no confunde otros errores", () => {
		expect(isConfirmDuplicateFullNameMessage("Ya existe un cliente con el número")).toBe(false);
	});
});
