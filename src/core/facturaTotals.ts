import type { FacturaLineaInput } from "./types";

export interface LineaTotals {
	baseImponible: number;
	impuesto: number;
	totalLinea: number;
}

export interface FacturaTotals {
	subtotal: number;
	impuestoTotal: number;
	total: number;
}

export function calcLineaTotals(l: FacturaLineaInput): LineaTotals {
	const base = l.cantidad * l.precioUnitario;
	const imp = base * (l.tasaImpuestoPct / 100);
	return { baseImponible: base, impuesto: imp, totalLinea: base + imp };
}

export function calcFacturaTotals(lineas: FacturaLineaInput[]): FacturaTotals {
	let subtotal = 0;
	let impuestoTotal = 0;
	for (const l of lineas) {
		const { baseImponible, impuesto } = calcLineaTotals(l);
		subtotal += baseImponible;
		impuestoTotal += impuesto;
	}
	return { subtotal, impuestoTotal, total: subtotal + impuestoTotal };
}
