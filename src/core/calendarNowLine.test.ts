import { describe, expect, it } from "vitest";
import { SLOT_HEIGHT_PX } from "./constants";
import { calendarNowLineTopPx } from "./calendarNowLine";

describe("calendarNowLineTopPx", () => {
	it("7:00 local → 0 px", () => {
		const d = new Date(2026, 3, 18, 7, 0, 0, 0);
		expect(calendarNowLineTopPx(d)).toBe(0);
	});

	it("10:30 local → alineado con rejilla de 30 min", () => {
		const d = new Date(2026, 3, 18, 10, 30, 0, 0);
		// (630 - 420) / 30 * SLOT_HEIGHT_PX = 7 * 35 = 245
		expect(calendarNowLineTopPx(d)).toBe(7 * SLOT_HEIGHT_PX);
	});

	it("antes de la apertura → null", () => {
		const d = new Date(2026, 3, 18, 6, 59, 0, 0);
		expect(calendarNowLineTopPx(d)).toBeNull();
	});

	it("a las 20:00 o después → null", () => {
		expect(calendarNowLineTopPx(new Date(2026, 3, 18, 20, 0, 0, 0))).toBeNull();
		expect(calendarNowLineTopPx(new Date(2026, 3, 18, 21, 0, 0, 0))).toBeNull();
	});
});
