import type { ClienteHomonimiaAdvertencia } from "../../core/types";

interface ClienteHomonimiaAdvertenciaBannerProps {
	coincidencia: ClienteHomonimiaAdvertencia | null;
	className?: string;
}

export function ClienteHomonimiaAdvertenciaBanner({
	coincidencia,
	className = "",
}: ClienteHomonimiaAdvertenciaBannerProps) {
	if (!coincidencia) return null;

	return (
		<div
			role="status"
			className={`rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
		>
			<p className="font-semibold text-amber-900">Advertencia: mismo nombre y apellidos</p>
			<p className="mt-2 leading-snug">
				Ya existe un cliente registrado como{" "}
				<span className="font-medium">
					{coincidencia.nombres} {coincidencia.apellidos}
				</span>{" "}
				({coincidencia.documentType} {coincidencia.documentNumber}). Dos personas con el mismo nombre completo son
				poco frecuentes; revise que no esté duplicando por error a la misma persona con otro documento.
			</p>
		</div>
	);
}
