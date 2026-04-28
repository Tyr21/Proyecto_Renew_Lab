import { describe, expect, it } from "vitest";
import { countOverlappingSameService, intervalsOverlapMinutes } from "./appointmentOverlap";
import type { Appointment } from "./types";

describe("intervalsOverlapMinutes", () => {
	it("detecta solape parcial", () => {
		expect(intervalsOverlapMinutes(420, 480, 450, 510)).toBe(true);
	});
	it("no solape cuando uno termina al iniciar el otro", () => {
		expect(intervalsOverlapMinutes(420, 450, 450, 480)).toBe(false);
	});
	it("no solape cuando están separados", () => {
		expect(intervalsOverlapMinutes(420, 450, 480, 510)).toBe(false);
	});
});

function apt(id: string, date: string, service: string, start: string, end: string): Appointment {
	return {
		id,
		patientFullName: "X",
		documentType: "CC",
		documentNumber: "1",
		phoneDialCode: "+57",
		phoneNationalNumber: "300",
		birthdayMonth: null,
		appointmentDate: date,
		startTime: start,
		endTime: end,
		serviceType: service,
		status: "pendiente",
		createdAt: "",
		updatedAt: "",
		isPaid: false,
	};
}

describe("countOverlappingSameService", () => {
	const day = "2025-03-10";
	const svc = "camara_hiperbarica";

	it("excluye el id indicado al editar", () => {
		const list = [apt("a", day, svc, "09:00", "10:00"), apt("b", day, svc, "09:30", "10:30")];
		const without = countOverlappingSameService(list, day, svc, "09:00", "10:00", "a");
		expect(without).toBe(1);
		const withSelf = countOverlappingSameService(list, day, svc, "09:00", "10:00");
		expect(withSelf).toBe(2);
	});

	it("ignora otro servicio u otra fecha", () => {
		const list = [
			apt("a", day, svc, "09:00", "10:00"),
			apt("b", day, "otro", "09:00", "10:00"),
			apt("c", "2025-03-11", svc, "09:00", "10:00"),
		];
		expect(countOverlappingSameService(list, day, svc, "09:30", "10:30")).toBe(1);
	});
});
