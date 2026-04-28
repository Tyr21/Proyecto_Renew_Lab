const COP_FORMATTER = new Intl.NumberFormat("es-CO", {
	style: "currency",
	currency: "COP",
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

/** Formato visual COP (p. ej. `$ 180.000`) para mostrar en inputs y etiquetas. */
export function formatCurrency(value: number): string {
	if (!Number.isFinite(value)) {
		return COP_FORMATTER.format(0);
	}
	return COP_FORMATTER.format(value);
}

/**
 * Interpreta el texto del input de moneda: solo dígitos → entero COP.
 * Vacío → 0.
 */
export function parseCurrencyDigits(raw: string): number {
	const digits = raw.replace(/\D/g, "");
	if (digits === "") {
		return 0;
	}
	const n = parseInt(digits, 10);
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Total con IVA a partir del subtotal antes de IVA (mismo redondeo que el modal de planes). */
export function totalConIva(
	priceBeforeVat: number,
	ivaPct: number,
): {
	base: number;
	iva: number;
	total: number;
} {
	const base = Number.isFinite(priceBeforeVat) ? priceBeforeVat : 0;
	const pct = Number.isFinite(ivaPct) ? ivaPct : 0;
	const iva = Math.round(base * (pct / 100));
	return { base, iva, total: base + iva };
}
