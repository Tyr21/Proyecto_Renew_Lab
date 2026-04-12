import { useCallback, useRef } from "react";
import { formatCurrency } from "../../core/currencyFormat";
import type { BillingSettings, Factura } from "../../core/types";

interface FacturaPrintViewProps {
	factura: Factura;
	billing: BillingSettings;
	onClose: () => void;
}

/**
 * SECURITY: The print flow reads `printRef.innerHTML` and injects it into an
 * iframe via `doc.write()`. All content inside `printRef` MUST be pure React
 * text nodes — never use `dangerouslySetInnerHTML` or raw HTML strings here,
 * as that would create an XSS amplification vector through the print channel.
 */
export function FacturaPrintView({ factura, billing, onClose }: FacturaPrintViewProps) {
	const printRef = useRef<HTMLDivElement>(null);

	const handlePrint = useCallback(() => {
		const content = printRef.current;
		if (!content) return;

		const existing = document.getElementById("__factura_print_frame");
		if (existing) existing.remove();

		const iframe = document.createElement("iframe");
		iframe.id = "__factura_print_frame";
		iframe.style.position = "fixed";
		iframe.style.width = "0";
		iframe.style.height = "0";
		iframe.style.border = "none";
		iframe.style.left = "-9999px";
		document.body.appendChild(iframe);

		const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
		if (!doc) { iframe.remove(); return; }

		doc.open();
		doc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Factura ${factura.serie}-${factura.numero ?? ""}</title>
<style>
	*{margin:0;padding:0;box-sizing:border-box}
	body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;padding:24px;font-size:13px}
	h1{font-size:18px;font-weight:700}
	.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0ea5e9;padding-bottom:16px;margin-bottom:16px}
	.header-left{max-width:60%}
	.header-right{text-align:right}
	.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600}
	.badge-emitida{background:#d1fae5;color:#065f46}
	.badge-anulada{background:#fee2e2;color:#991b1b}
	.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
	.info-block span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
	table{width:100%;border-collapse:collapse;margin-bottom:16px}
	th{text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding:8px 6px}
	td{padding:8px 6px;border-bottom:1px solid #f1f5f9}
	.num{text-align:right;font-variant-numeric:tabular-nums}
	.totals{display:flex;justify-content:flex-end}
	.totals-box{width:240px;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
	.totals-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
	.totals-row.grand{border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px;font-weight:700;font-size:14px}
	.notas{margin-top:16px;padding:8px 12px;background:#f8fafc;border-radius:6px;font-size:12px;color:#475569}
	.footer{margin-top:32px;text-align:center;font-size:11px;color:#94a3b8}
	@media print{body{padding:0}button{display:none!important}}
</style>
</head><body>${content.innerHTML}</body></html>`);
		doc.close();

		setTimeout(() => {
			try { iframe.contentWindow?.print(); }
			finally { setTimeout(() => iframe.remove(), 1000); }
		}, 250);
	}, [factura]);

	const fechaDisplay = factura.fechaEmision
		? new Date(factura.fechaEmision).toLocaleDateString("es-CO", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: "";

	return (
		<div
			className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
		>
			<div className="my-6 w-full max-w-3xl rounded-xl bg-white shadow-xl">
				<div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
					<h2 className="text-sm font-medium text-slate-800">Vista previa de impresión</h2>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handlePrint}
							className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
						>
							Imprimir
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
						>
							Cerrar
						</button>
					</div>
				</div>

				<div ref={printRef} className="p-8 text-[13px] text-slate-800">
					<div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0ea5e9", paddingBottom: 16, marginBottom: 16 }}>
						<div style={{ maxWidth: "60%" }}>
							<h1 style={{ fontSize: 18, fontWeight: 700 }}>
								{billing.razonSocial || "Consultorio"}
							</h1>
							{billing.nit ? <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>NIT: {billing.nit}</p> : null}
							{billing.direccion ? <p style={{ fontSize: 12, color: "#64748b" }}>{billing.direccion}</p> : null}
							{billing.telefono ? <p style={{ fontSize: 12, color: "#64748b" }}>Tel: {billing.telefono}</p> : null}
						</div>
						<div style={{ textAlign: "right" }}>
							<p style={{ fontSize: 16, fontWeight: 700 }}>
								Factura {factura.serie}-{factura.numero}
							</p>
							<p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{fechaDisplay}</p>
							<span
								className={`badge ${factura.estado === "emitida" ? "badge-emitida" : "badge-anulada"}`}
								style={{
									display: "inline-block",
									padding: "2px 10px",
									borderRadius: 12,
									fontSize: 11,
									fontWeight: 600,
									marginTop: 4,
									background: factura.estado === "emitida" ? "#d1fae5" : "#fee2e2",
									color: factura.estado === "emitida" ? "#065f46" : "#991b1b",
								}}
							>
								{factura.estado.toUpperCase()}
							</span>
						</div>
					</div>

					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
						<div>
							<span style={{ display: "block", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>Cliente</span>
							<p style={{ fontWeight: 600 }}>{factura.clienteNombre}</p>
						</div>
						<div>
							<span style={{ display: "block", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>Documento</span>
							<p>{factura.clienteDocumentoTipo} {factura.clienteDocumentoNumero}</p>
						</div>
					</div>

					<table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
						<thead>
							<tr>
								<th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>#</th>
								<th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Descripción</th>
								<th style={{ textAlign: "right", fontSize: 11, textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Cant.</th>
								<th style={{ textAlign: "right", fontSize: 11, textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>P. unit.</th>
								<th style={{ textAlign: "right", fontSize: 11, textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>IVA</th>
								<th style={{ textAlign: "right", fontSize: 11, textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Total</th>
							</tr>
						</thead>
						<tbody>
							{factura.lineas.map((l, i) => (
								<tr key={l.id}>
									<td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{i + 1}</td>
									<td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{l.descripcion}</td>
									<td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.cantidad}</td>
									<td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(l.precioUnitario)}</td>
									<td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.tasaImpuestoPct}%</td>
									<td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{formatCurrency(l.totalLinea)}</td>
								</tr>
							))}
						</tbody>
					</table>

					<div style={{ display: "flex", justifyContent: "flex-end" }}>
						<div style={{ width: 240, border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
							<div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
								<span>Subtotal</span>
								<span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(factura.subtotal)}</span>
							</div>
							<div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
								<span>IVA</span>
								<span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(factura.impuestoTotal)}</span>
							</div>
							<div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 8, marginTop: 4, fontWeight: 700, fontSize: 14 }}>
								<span>Total</span>
								<span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(factura.total)}</span>
							</div>
						</div>
					</div>

					{factura.notas ? (
						<div style={{ marginTop: 16, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, fontSize: 12, color: "#475569" }}>
							{factura.notas}
						</div>
					) : null}

					{factura.estado === "anulada" && factura.anulacionMotivo ? (
						<div style={{ marginTop: 16, padding: "8px 12px", background: "#fef2f2", borderRadius: 6, fontSize: 12, color: "#991b1b" }}>
							<strong>ANULADA:</strong> {factura.anulacionMotivo}
						</div>
					) : null}

					<p style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
						Documento generado localmente — Consultorio Renew Lab
					</p>
				</div>
			</div>
		</div>
	);
}
