import { useEffect, useState } from "react";
import {
	actualizarEvento,
	crearEvento,
	eliminarEvento,
} from "../../core/api";
import { EVENTO_CHANGED_EVENT } from "../../core/constants";
import { formatInvokeError } from "../../core/errors";
import type { Evento, EventoColor, EventoInput } from "../../core/types";
import { EVENTO_COLORS } from "../../core/types";
import { generateSlotStarts } from "../../core/timeFormat";

interface EventoModalProps {
	open: boolean;
	initial?: Evento | null;
	presetDate?: string | null;
	presetTime?: string | null;
	adminMode: boolean;
	onClose: () => void;
}

const COLOR_LABELS: Record<EventoColor, { label: string; classes: string }> = {
	amber: { label: "Amarillo", classes: "bg-amber-400 border-amber-600" },
	rose: { label: "Rosa", classes: "bg-rose-400 border-rose-600" },
	violet: { label: "Violeta", classes: "bg-violet-400 border-violet-600" },
	teal: { label: "Teal", classes: "bg-teal-400 border-teal-600" },
	sky: { label: "Azul", classes: "bg-sky-400 border-sky-600" },
	slate: { label: "Gris", classes: "bg-slate-400 border-slate-600" },
};

const SLOT_OPTIONS = generateSlotStarts();

export function EventoModal({
	open,
	initial,
	presetDate,
	presetTime,
	adminMode,
	onClose,
}: EventoModalProps) {
	const isEdit = !!initial;

	const [titulo, setTitulo] = useState("");
	const [descripcion, setDescripcion] = useState("");
	const [fecha, setFecha] = useState("");
	const [todoElDia, setTodoElDia] = useState(true);
	const [horaInicio, setHoraInicio] = useState("07:00");
	const [horaFin, setHoraFin] = useState("07:30");
	const [color, setColor] = useState<EventoColor>("amber");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		if (initial) {
			setTitulo(initial.titulo);
			setDescripcion(initial.descripcion);
			setFecha(initial.fecha);
			setTodoElDia(initial.todoElDia);
			setHoraInicio(initial.horaInicio ?? "07:00");
			setHoraFin(initial.horaFin ?? "07:30");
			setColor(initial.color);
		} else {
			setTitulo("");
			setDescripcion("");
			setFecha(presetDate ?? "");
			if (presetTime) {
				setTodoElDia(false);
				setHoraInicio(presetTime);
				const idx = SLOT_OPTIONS.indexOf(presetTime);
				setHoraFin(SLOT_OPTIONS[idx + 1] ?? "20:00");
			} else {
				setTodoElDia(true);
				setHoraInicio("07:00");
				setHoraFin("07:30");
			}
			setColor("amber");
		}
		setError(null);
		setBusy(false);
	}, [open, initial, presetDate, presetTime]);

	if (!open) return null;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);

		const input: EventoInput = {
			titulo: titulo.trim(),
			descripcion: descripcion.trim() || undefined,
			fecha,
			todoElDia,
			horaInicio: todoElDia ? null : horaInicio,
			horaFin: todoElDia ? null : horaFin,
			color,
		};

		try {
			if (isEdit && initial) {
				await actualizarEvento(initial.id, input);
			} else {
				await crearEvento(input);
			}
			window.dispatchEvent(new Event(EVENTO_CHANGED_EVENT));
			onClose();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (!initial) return;
		if (!confirm("¿Eliminar este evento?")) return;
		setBusy(true);
		try {
			await eliminarEvento(initial.id);
			window.dispatchEvent(new Event(EVENTO_CHANGED_EVENT));
			onClose();
		} catch (err) {
			setError(formatInvokeError(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="w-full max-w-md rounded-xl bg-white shadow-xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="evento-modal-title"
			>
				<header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
					<h2
						id="evento-modal-title"
						className="text-base font-semibold text-slate-800"
					>
						{isEdit ? "Editar evento" : "Nuevo evento / recordatorio"}
					</h2>
					<button
						type="button"
						className="text-slate-400 hover:text-slate-700"
						onClick={onClose}
					>
						✕
					</button>
				</header>

				<form
					onSubmit={(e) => void handleSubmit(e)}
					className="space-y-4 px-5 py-4"
				>
					{error ? (
						<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
							{error}
						</p>
					) : null}

					<label className="block text-sm">
						<span className="font-medium text-slate-700">Título *</span>
						<input
							type="text"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={titulo}
							onChange={(e) => setTitulo(e.target.value)}
							required
							placeholder="Ej: Mantenimiento cámaras hiperbáricas"
						/>
					</label>

					<label className="block text-sm">
						<span className="font-medium text-slate-700">Descripción</span>
						<textarea
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={descripcion}
							onChange={(e) => setDescripcion(e.target.value)}
							rows={2}
							placeholder="Detalles opcionales…"
						/>
					</label>

					<label className="block text-sm">
						<span className="font-medium text-slate-700">Fecha *</span>
						<input
							type="date"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							value={fecha}
							onChange={(e) => setFecha(e.target.value)}
							required
						/>
					</label>

					<fieldset className="space-y-3">
						<legend className="text-sm font-medium text-slate-700">Horario</legend>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="tipoHorario"
								checked={todoElDia}
								onChange={() => setTodoElDia(true)}
							/>
							Todo el día
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="tipoHorario"
								checked={!todoElDia}
								onChange={() => setTodoElDia(false)}
							/>
							Hora específica
						</label>

						{!todoElDia ? (
							<div className="grid grid-cols-2 gap-3">
								<label className="text-sm">
									<span className="text-slate-600">Inicio</span>
									<select
										className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
										value={horaInicio}
										onChange={(e) => {
											setHoraInicio(e.target.value);
											const idx = SLOT_OPTIONS.indexOf(e.target.value);
											if (idx >= 0 && SLOT_OPTIONS[idx + 1]) {
												setHoraFin(SLOT_OPTIONS[idx + 1]);
											}
										}}
									>
										{SLOT_OPTIONS.map((s) => (
											<option key={s} value={s}>{s}</option>
										))}
									</select>
								</label>
								<label className="text-sm">
									<span className="text-slate-600">Fin</span>
									<select
										className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
										value={horaFin}
										onChange={(e) => setHoraFin(e.target.value)}
									>
										{SLOT_OPTIONS.filter((s) => s > horaInicio).map((s) => (
											<option key={s} value={s}>{s}</option>
										))}
										<option value="20:00">20:00</option>
									</select>
								</label>
							</div>
						) : null}
					</fieldset>

					<fieldset>
						<legend className="text-sm font-medium text-slate-700 mb-1.5">Color</legend>
						<div className="flex gap-2">
							{EVENTO_COLORS.map((c) => (
								<button
									key={c}
									type="button"
									title={COLOR_LABELS[c].label}
									className={`h-7 w-7 rounded-full border-2 transition ${COLOR_LABELS[c].classes} ${color === c ? "ring-2 ring-offset-1 ring-slate-800 scale-110" : "opacity-70 hover:opacity-100"}`}
									onClick={() => setColor(c)}
								/>
							))}
						</div>
					</fieldset>

					<div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
						<div>
							{isEdit && adminMode ? (
								<button
									type="button"
									className="text-sm text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5"
									onClick={() => void handleDelete()}
									disabled={busy}
								>
									Eliminar
								</button>
							) : null}
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
								onClick={onClose}
							>
								Cancelar
							</button>
							<button
								type="submit"
								className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
								disabled={busy}
							>
								{busy ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear evento"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
