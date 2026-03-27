import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { suggestedPriceForServiceType } from "../core/serviceLabels";
import type { AppSettings } from "../core/types";
import {
	PaymentModal,
	type PaymentPrefill,
} from "../modules/finances/PaymentModal";

interface FinanceEventListenerProps {
	settings: AppSettings;
}

/**
 * Suscriptor al bus local: solo `cita_completada` (desacoplado del calendario).
 * Abre el modal de pago solo si `estado === "asistio"`; con `no_asistio` no hay cobro.
 */
export function FinanceEventListener({ settings }: FinanceEventListenerProps) {
	const [open, setOpen] = useState(false);
	const [prefill, setPrefill] = useState<PaymentPrefill | null>(null);
	const settingsRef = useRef(settings);
	settingsRef.current = settings;

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
						const tipoServicio =
							typeof p?.tipo_servicio === "string"
								? p.tipo_servicio
								: "";
						const suggestedPrice = suggestedPriceForServiceType(
							settingsRef.current,
							tipoServicio,
						);
						setPrefill({
							citaId:
								typeof p?.cita_id === "string" ? p.cita_id : "",
							pacienteNombre:
								typeof p?.paciente_nombre === "string"
									? p.paciente_nombre
									: "",
							pacienteDocumento:
								typeof p?.paciente_documento === "string"
									? p.paciente_documento
									: "",
							concepto: tipoServicio,
							suggestedPrice:
								suggestedPrice > 0 ? suggestedPrice : undefined,
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
