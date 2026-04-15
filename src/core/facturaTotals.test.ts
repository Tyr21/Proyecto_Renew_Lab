import { describe, expect, it } from "vitest";
import { calcFacturaTotals, calcLineaTotals } from "./facturaTotals";

describe("calcLineaTotals", () => {
	it("calcula base, impuesto y total para una línea con IVA 19%", () => {
		const r = calcLineaTotals({
			descripcion: "Servicio",
			cantidad: 1,
			precioUnitario: 180_000,
			tasaImpuestoPct: 19,
		});
		expect(r.baseImponible).toBeCloseTo(180_000);
		expect(r.impuesto).toBeCloseTo(34_200);
		expect(r.totalLinea).toBeCloseTo(214_200);
	});

	it("línea con cantidad mayor a 1", () => {
		const r = calcLineaTotals({
			descripcion: "Sesión",
			cantidad: 3,
			precioUnitario: 50_000,
			tasaImpuestoPct: 19,
		});
		expect(r.baseImponible).toBeCloseTo(150_000);
		expect(r.impuesto).toBeCloseTo(28_500);
		expect(r.totalLinea).toBeCloseTo(178_500);
	});

	it("línea sin impuesto", () => {
		const r = calcLineaTotals({
			descripcion: "Exento",
			cantidad: 2,
			precioUnitario: 100_000,
			tasaImpuestoPct: 0,
		});
		expect(r.baseImponible).toBeCloseTo(200_000);
		expect(r.impuesto).toBe(0);
		expect(r.totalLinea).toBeCloseTo(200_000);
	});
});

describe("calcFacturaTotals", () => {
	it("suma correctamente múltiples líneas", () => {
		const r = calcFacturaTotals([
			{ descripcion: "A", cantidad: 1, precioUnitario: 100_000, tasaImpuestoPct: 19 },
			{ descripcion: "B", cantidad: 2, precioUnitario: 50_000, tasaImpuestoPct: 0 },
		]);
		expect(r.subtotal).toBeCloseTo(200_000);
		expect(r.impuestoTotal).toBeCloseTo(19_000);
		expect(r.total).toBeCloseTo(219_000);
	});

	it("retorna ceros para lista vacía", () => {
		const r = calcFacturaTotals([]);
		expect(r.subtotal).toBe(0);
		expect(r.impuestoTotal).toBe(0);
		expect(r.total).toBe(0);
	});
});
