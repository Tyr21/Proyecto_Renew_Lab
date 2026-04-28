import { useCallback, useEffect, useState, type ReactElement } from "react";
import { obtenerResumenClienteDashboard } from "../../core/api";
import { formatInvokeError } from "../../core/errors";
import { serviceLabelFromSettings } from "../../core/serviceLabels";
import { formatTimeLabel } from "../../core/timeFormat";
import type {
	AppSettings,
	CitaResumenCliente,
	Cliente,
	ClienteResumenDashboard,
} from "../../core/types";

interface ClienteResumenModalProps {
	open: boolean;
	clienteId: string | null;
	settings: AppSettings;
	adminMode: boolean;
	onClose: () => void;
	onEditar: (cliente: Cliente) => void;
	onEliminar?: (id: string) => void;
}

const MESES_CORTO = [
	"Ene",
	"Feb",
	"Mar",
	"Abr",
	"May",
	"Jun",
	"Jul",
	"Ago",
	"Sep",
	"Oct",
	"Nov",
	"Dic",
];

function etiquetaFecha(isoDate: string): string {
	const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));
	if (!y || !m || !d) return isoDate;
	const dt = new Date(y, m - 1, d);
	return new Intl.DateTimeFormat("es-CO", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(dt);
}

function filaCita(c: CitaResumenCliente, settings: AppSettings, clave: string): ReactElement {
	const enPlan = Boolean(c.paqueteId && String(c.paqueteId).trim().length > 0);
	const etiquetaPago = c.isPaid ? "Sí" : enPlan ? "No (cubierta por plan)" : "No";

	return (
		<li key={clave} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<span className="font-medium text-slate-800">
					{etiquetaFecha(c.appointmentDate)} · {formatTimeLabel(c.startTime, settings.timeDisplay)}{" "}
					– {formatTimeLabel(c.endTime, settings.timeDisplay)}
				</span>
				<span className="text-xs text-slate-500">
					{c.status === "asistio"
						? "Asistió"
						: c.status === "no_asistio"
							? "No asistió"
							: "Pendiente"}
				</span>
			</div>
			<p className="mt-1 text-slate-700">{serviceLabelFromSettings(settings, c.serviceType)}</p>
			<div className="mt-1 flex flex-wrap gap-2 text-xs">
				<span
					className={`rounded px-1.5 py-0.5 font-medium ${
						enPlan ? "bg-violet-100 text-violet-800" : "bg-slate-200 text-slate-700"
					}`}
				>
					{enPlan ? "Plan de sesiones" : "Sin plan"}
				</span>
				<span
					className={`rounded px-1.5 py-0.5 font-medium ${
						c.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
					}`}
				>
					Pagado: {etiquetaPago}
				</span>
			</div>
		</li>
	);
}

export function ClienteResumenModal({
	open,
	clienteId,
	settings,
	adminMode,
	onClose,
	onEditar,
	onEliminar,
}: ClienteResumenModalProps) {
	const [data, setData] = useState<ClienteResumenDashboard | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const cargar = useCallback(async () => {
		if (!clienteId?.trim()) return;
		setLoading(true);
		setError(null);
		try {
			const r = await obtenerResumenClienteDashboard(clienteId.trim());
			setData(r);
		} catch (e) {
			setError(formatInvokeError(e) || "No se pudo cargar la ficha");
			setData(null);
		} finally {
			setLoading(false);
		}
	}, [clienteId]);

	useEffect(() => {
		if (!open || !clienteId?.trim()) {
			setData(null);
			setError(null);
			return;
		}
		void cargar();
	}, [open, clienteId, cargar]);

	if (!open) {
		return null;
	}

	const c = data?.cliente;

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="cliente-resumen-titulo"
		>
			<div className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
				<div className="shrink-0 border-b border-slate-200 px-5 py-4">
					<div className="flex items-start justify-between gap-3">
						<h2 id="cliente-resumen-titulo" className="text-lg font-semibold text-slate-800">
							Ficha del cliente
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
						>
							Cerrar
						</button>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
					{loading ? (
						<p className="text-sm text-slate-500">Cargando…</p>
					) : error ? (
						<p className="text-sm text-red-600" role="alert">
							{error}
						</p>
					) : c ? (
						<div className="space-y-6">
							<section className="space-y-2 text-sm">
								<p className="text-base font-semibold text-slate-900">
									{c.nombres} {c.apellidos}
								</p>
								<p className="text-slate-600">
									<span className="font-medium text-slate-700">Documento: </span>
									{c.documentType} {c.documentNumber}
								</p>
								{c.phoneNationalNumber ? (
									<p className="text-slate-600">
										<span className="font-medium text-slate-700">Teléfono: </span>
										{c.phoneDialCode} {c.phoneNationalNumber}
									</p>
								) : null}
								{c.email ? (
									<p className="text-slate-600">
										<span className="font-medium text-slate-700">Correo: </span>
										{c.email}
									</p>
								) : null}
								{c.birthdayMonth ? (
									<p className="text-slate-600">
										<span className="font-medium text-slate-700">Mes cumpleaños: </span>
										{MESES_CORTO[c.birthdayMonth - 1] ?? c.birthdayMonth}
									</p>
								) : null}
								{c.notas ? (
									<p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
										<span className="font-medium text-slate-700">Notas: </span>
										{c.notas}
									</p>
								) : null}
							</section>

							<section>
								<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Últimos servicios realizados
								</h3>
								{data!.ultimosServicios.length === 0 ? (
									<p className="mt-2 text-sm text-slate-400">
										No hay citas completadas registradas con este documento.
									</p>
								) : (
									<ul className="mt-2 space-y-2">
										{data!.ultimosServicios.map((row) => filaCita(row, settings, `u-${row.id}`))}
									</ul>
								)}
							</section>

							<section>
								<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Próximas citas (5)
								</h3>
								{data!.proximasCitas.length === 0 ? (
									<p className="mt-2 text-sm text-slate-400">
										No hay citas programadas desde ahora con este documento.
									</p>
								) : (
									<ul className="mt-2 space-y-2">
										{data!.proximasCitas.map((row) => filaCita(row, settings, `p-${row.id}`))}
									</ul>
								)}
							</section>
						</div>
					) : (
						<p className="text-sm text-slate-500">Sin datos.</p>
					)}
				</div>

				{c ? (
					<div className="shrink-0 space-y-2 border-t border-slate-200 px-5 py-3">
						<button
							type="button"
							onClick={() => onEditar(c)}
							className="w-full rounded-lg bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-700"
						>
							Editar cliente
						</button>
						{adminMode && onEliminar ? (
							<button
								type="button"
								onClick={() => onEliminar(c.id)}
								className="w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
							>
								Eliminar cliente
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
