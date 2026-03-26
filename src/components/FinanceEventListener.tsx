import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import {
	PaymentModal,
	type PaymentPrefill,
} from "../modules/finances/PaymentModal";

/**
 * Suscriptor al bus local: solo `cita_completada` (desacoplado del calendario).
 * Abre el modal de pago solo si `estado === "asistio"`; con `no_asistio` no hay cobro.
 */
export function FinanceEventListener() {
	const [open, setOpen] = useState(false);
	const [prefill, setPrefill] = useState<PaymentPrefill | null>(null);

	useEffect(() => {
		let cancelled = false;
		let unlisten: UnlistenFn | undefined;

		const setup = async () => {
			try {
				const u = await listen<Record<string, unknown>>(
					"cita_completada",
					(event) => {
						const p = event.payload;
						const estado =
							typeof p?.estado === "string" ? p.estado : "";
						// Solo cobro si hubo asistencia; `no_asistio` no abre modal (alineado con payload Rust).
						if (estado !== "asistio") {
							return;
						}
						setPrefill({
							citaId:
								typeof p?.cita_id === "string" ? p.cita_id : "",
							pacienteDocumento:
								typeof p?.paciente_documento === "string"
									? p.paciente_documento
									: "",
							concepto:
								typeof p?.tipo_servicio === "string"
									? p.tipo_servicio
									: "",
						});
						setOpen(true);
					},
				);
				if (cancelled) {
					u();
					return;
				}
				unlisten = u;
			} catch (e) {
				console.warn("[FinanceEventListener] listen:", e);
			}
		};

		void setup();

		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, []);

	return (
		<PaymentModal
			open={open}
			prefill={prefill}
			onClose={() => {
				setOpen(false);
				setPrefill(null);
			}}
		/>
	);
}
