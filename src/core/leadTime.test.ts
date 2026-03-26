import { describe, expect, it, vi, afterEach } from "vitest";
import { isSlotBookableWithLeadTime, leadTimeErrorMessage } from "./leadTime";

describe("leadTime", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("rechaza inicio antes del límite", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-06-15T10:00:00"));

		expect(isSlotBookableWithLeadTime("2025-06-15", "10:15")).toBe(false);
		expect(leadTimeErrorMessage("2025-06-15", "10:15")).toBeTruthy();
	});

	it("acepta inicio después del límite", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-06-15T10:00:00"));

		expect(isSlotBookableWithLeadTime("2025-06-15", "10:30")).toBe(true);
		expect(leadTimeErrorMessage("2025-06-15", "10:30")).toBeNull();
	});

	it("permite mediodía cuando faltan más de 30 min (caso 11:21 → 12:00)", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 26, 11, 21, 0));

		expect(isSlotBookableWithLeadTime("2026-03-26", "12:00")).toBe(true);
	});
});
