const BASE_STYLES = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;padding:28px 32px;font-size:12px}
h1{font-size:16px;font-weight:700;margin-bottom:2px}
.subtitle{font-size:11px;color:#64748b;margin-bottom:18px}
.cards{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.card{border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;min-width:140px}
.card-label{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;margin-bottom:4px}
.card-value{font-size:16px;font-weight:700}
.card-detail{font-size:10px;color:#94a3b8;margin-top:2px}
.card-accent .card-value{color:#065f46}
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:#64748b;border-bottom:1px solid #e2e8f0;padding:7px 6px}
th.num{text-align:right}
td{padding:7px 6px;border-bottom:1px solid #f1f5f9}
td.num{text-align:right;font-variant-numeric:tabular-nums}
td.bold{font-weight:600}
.section-title{font-size:13px;font-weight:600;margin:16px 0 8px}
.tag-warn{font-size:10px;color:#b45309;font-weight:600}
.footer{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8}
@media print{body{padding:0}@page{margin:16mm 12mm}}
`;

/**
 * Renderiza HTML en un iframe oculto y dispara el dialogo de impresion/PDF.
 * Usa iframe en vez de window.open() porque la WebView de Tauri bloquea popups.
 */
export function openPrintWindow(title: string, bodyHtml: string): void {
	const existing = document.getElementById("__print_frame");
	if (existing) existing.remove();

	const iframe = document.createElement("iframe");
	iframe.id = "__print_frame";
	iframe.style.position = "fixed";
	iframe.style.width = "0";
	iframe.style.height = "0";
	iframe.style.border = "none";
	iframe.style.left = "-9999px";
	document.body.appendChild(iframe);

	const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
	if (!doc) {
		iframe.remove();
		return;
	}

	doc.open();
	doc.write(
		`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>` +
		`<style>${BASE_STYLES}</style></head><body>${bodyHtml}</body></html>`,
	);
	doc.close();

	setTimeout(() => {
		try {
			iframe.contentWindow?.print();
		} finally {
			setTimeout(() => iframe.remove(), 1000);
		}
	}, 250);
}

/** Escapa caracteres especiales de HTML */
export function esc(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
