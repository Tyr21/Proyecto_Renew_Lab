import { vi, type Mock } from "vitest";

/**
 * Stub para `invoke` cuando un test mockea `@tauri-apps/api/core` en lugar de `src/core/api`.
 * La mayoría de componentes usan funciones de `api.ts`; ahí basta `vi.mock("../../core/api", ...)`.
 */
export function createInvokeMock(
	handler: (cmd: string, args?: Record<string, unknown>) => unknown,
): Mock<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>> {
	return vi.fn(async (cmd: string, args?: Record<string, unknown>) =>
		Promise.resolve(handler(cmd, args)),
	);
}
