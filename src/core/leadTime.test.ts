import { describe, expect, it, vi, afterEach } from "vitest";
import { MAX_GRACE_PERIOD_MINUTES } from "./constants";
import { gracePeriodBookingErrorMessage, isSlotBookableWithGracePeriod } from "./leadTime";

describe("grace period (agendamiento)", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const dateIso = "2025-06-15";

	it("slot 12:00 — now 11:50: OK", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2025, 5, 15, 11, 50, 0));

		expect(isSlotBookableWithGracePeriod(dateIso, "12:00")).toBe(true);
		expect(gracePeriodBookingErrorMessage(dateIso, "12:00")).toBeNull();
	});

	it("slot 12:00 — now 12:10: OK (walk-in dentro del periodo)", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2025, 5, 15, 12, 10, 0));

		expect(isSlotBookableWithGracePeriod(dateIso, "12:00")).toBe(true);
		expect(gracePeriodBookingErrorMessage(dateIso, "12:00")).toBeNull();
	});

	it("slot 12:00 — now 12:16: rechazado (gracia vencida)", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2025, 5, 15, 12, 16, 0));

		expect(isSlotBookableWithGracePeriod(dateIso, "12:00")).toBe(false);
		expect(gracePeriodBookingErrorMessage(dateIso, "12:00")).toBe(
			`El periodo de gracia (${MAX_GRACE_PERIOD_MINUTES} min) para agendar en este horario ha expirado.`,
		);
	});
});
