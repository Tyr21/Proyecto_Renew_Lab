import { useCallback, useEffect, useState } from "react";
import {
	leerFotoOxigeno,
	listarOxigenoPorRango,
	registrarEventoOxigeno,
} from "../../core/api";
import { formatInvokeError } from "../../core/errors";
import { toISODateLocal } from "../../core/weekUtils";
import type {
	AppSettings,
	OxigenoEvento,
	OxigenoEventoTipo,
} from "../../core/types";

const TIPO_OPCIONES: { value: OxigenoEventoTipo; label: string }[] = [
	{ value: "balance_inicial", label: "Balance inicial" },
	{ value: "recarga_pipeta", label: "Recarga de pipeta" },
	{ value: "cierre", label: "Cierre" },
	{ value: "extra", label: "Extra (sin foto obligatoria)" },
];

function etiquetaTipo(t: string): string {
	return TIPO_OPCIONES.find((o) => o.value === t)?.label ?? t;
}

function extensionDesdeNombre(archivo: string): string | null {
	const m = /\.([a-z0-9]+)$/i.exec(archivo.trim());
	return m ? m[1]!.toLowerCase() : null;
}

interface Props {
	settings: AppSettings;
}

export function OxygenDashboard({ settings }: Props) {
	const hoy = toISODateLocal(new Date());
	const [fechaOperacion, setFechaOperacion] = useState(hoy);
	const [eventos, setEventos] = useState<OxigenoEvento[]>([]);
	const [loadingLista, setLoadingLista] = useState(true);
	const [errorLista, setErrorLista] = useState<string | null>(null);

	const [tipo, setTipo] = useState<OxigenoEventoTipo>("balance_inicial");
	const [medidorA, setMedidorA] = useState("");
	const [medidorB, setMedidorB] = useState("");
	const [saldoEnfermeria, setSaldoEnfermeria] = useState("");
	const [notas, setNotas] = useState("");
	const [archivoFoto, setArchivoFoto] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [guardando, setGuardando] = useState(false);
	const [errorForm, setErrorForm] = useState<string | null>(null);
	const [okMsg, setOkMsg] = useState<string | null>(null);

	const fotoObligatoria = tipo !== "extra";

	const recargarLista = useCallback(async () => {
		setErrorLista(null);
		setLoadingLista(true);
		try {
			const list = await listarOxigenoPorRango(fechaOperacion, fechaOperacion);
			setEventos(list);
		} catch (e) {
			setErrorLista(formatInvokeError(e) || "No se pudieron cargar los registros");
		} finally {
			setLoadingLista(false);
		}
	}, [fechaOperacion]);

	useEffect(() => {
		void recargarLista();
	}, [recargarLista]);

	useEffect(() => {
		if (!archivoFoto) {
			setPreviewUrl(null);
			return;
		}
		const url = URL.createObjectURL(archivoFoto);
		setPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [archivoFoto]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErrorForm(null);
		setOkMsg(null);
		const a = Number.parseFloat(medidorA.replace(",", "."));
		const b = Number.parseFloat(medidorB.replace(",", "."));
		if (!Number.isFinite(a) || !Number.isFinite(b)) {
			setErrorForm("Indique lecturas numéricas válidas en ambos medidores.");
			return;
		}
		let saldo: number | null = null;
		if (saldoEnfermeria.trim()) {
			const s = Number.parseFloat(saldoEnfermeria.replace(",", "."));
			if (!Number.isFinite(s)) {
				setErrorForm("El saldo declarado debe ser un número válido.");
				return;
			}
			saldo = s;
		}
		let fotoBytes: number[] | null = null;
		let fotoExtension: string | null = null;
		if (fotoObligatoria) {
			if (!archivoFoto) {
				setErrorForm("Adjunte una foto de los medidores (JPEG o PNG).");
				return;
			}
			fotoExtension = extensionDesdeNombre(archivoFoto.name);
			if (!fotoExtension || !["jpg", "jpeg", "png"].includes(fotoExtension)) {
				setErrorForm("Use imagen JPG o PNG.");
				return;
			}
			const buf = await archivoFoto.arrayBuffer();
			fotoBytes = Array.from(new Uint8Array(buf));
		} else if (archivoFoto) {
			fotoExtension = extensionDesdeNombre(archivoFoto.name);
			if (!fotoExtension || !["jpg", "jpeg", "png"].includes(fotoExtension)) {
				setErrorForm("Si adjunta foto, use JPG o PNG.");
				return;
			}
			const buf = await archivoFoto.arrayBuffer();
			fotoBytes = Array.from(new Uint8Array(buf));
		}

		setGuardando(true);
		try {
			await registrarEventoOxigeno({
				fechaOperacion,
				tipo,
				medidorA: a,
				medidorB: b,
				saldoEnfermeria: saldo,
				notas: notas.trim() || null,
				fotoBytes,
				fotoExtension,
			});
			setOkMsg("Registro guardado correctamente.");
			setMedidorA("");
			setMedidorB("");
			setSaldoEnfermeria("");
			setNotas("");
			setArchivoFoto(null);
			await recargarLista();
		} catch (err) {
			setErrorForm(formatInvokeError(err) || "No se pudo guardar el registro");
		} finally {
			setGuardando(false);
		}
	}

	const k = settings.oxygen?.perHyperbaricSession ?? 1;
	const unidad = settings.oxygen?.unitsLabel?.trim() || "unidad(es)";
	const svcLabel =
		settings.serviceTypes.find((s) => s.id === (settings.oxygen?.serviceTypeId ?? ""))
			?.label ?? settings.oxygen?.serviceTypeId ?? "cámara";

	return (
		<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
			<div className="mx-auto max-w-4xl space-y-6">
				<header>
					<h1 className="text-xl font-semibold text-slate-800">
						Registro de oxígeno (cámara hiperbárica)
					</h1>
					<p className="mt-1 text-sm text-slate-600">
						Lecturas de medidores, saldo declarado por enfermería y foto de los medidores (JPG o PNG). El{" "}
						<strong className="font-medium text-slate-800">día operativo</strong> del registro es el que
						elija en “Día de operación”. Si la foto conserva EXIF con fecha de captura, esa fecha debe
						coincidir con ese día; si no hay EXIF (p. ej. reenvíos por WhatsApp), la foto se guarda igual y
						en la lista verá “Foto sin fecha EXIF registrada”. El consumo teórico en informes usa{" "}
						<strong className="font-medium text-slate-800">
							{k} {unidad}
						</strong>{" "}
						por sesión atendida de <strong className="font-medium text-slate-800">{svcLabel}</strong>{" "}
						(configurable en Ajustes → Oxígeno).
					</p>
				</header>

				<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
					<h2 className="text-sm font-medium text-slate-800">Nuevo registro</h2>
					<form className="mt-4 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block text-sm">
								<span className="font-medium text-slate-700">Día de operación</span>
								<input
									type="date"
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
									value={fechaOperacion}
									onChange={(e) => setFechaOperacion(e.target.value)}
								/>
							</label>
							<label className="block text-sm">
								<span className="font-medium text-slate-700">Tipo de evento</span>
								<select
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
									value={tipo}
									onChange={(e) => setTipo(e.target.value as OxigenoEventoTipo)}
								>
									{TIPO_OPCIONES.map((o) => (
										<option key={o.value} value={o.value}>
											{o.label}
										</option>
									))}
								</select>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block text-sm">
								<span className="font-medium text-slate-700">Medidor A</span>
								<input
									type="text"
									inputMode="decimal"
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 tabular-nums text-slate-800"
									value={medidorA}
									onChange={(e) => setMedidorA(e.target.value)}
									placeholder="Lectura"
								/>
							</label>
							<label className="block text-sm">
								<span className="font-medium text-slate-700">Medidor B</span>
								<input
									type="text"
									inputMode="decimal"
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 tabular-nums text-slate-800"
									value={medidorB}
									onChange={(e) => setMedidorB(e.target.value)}
									placeholder="Lectura"
								/>
							</label>
						</div>
						<label className="block text-sm">
							<span className="font-medium text-slate-700">
								Saldo declarado por enfermería (opcional)
							</span>
							<input
								type="text"
								inputMode="decimal"
								className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 tabular-nums text-slate-800"
								value={saldoEnfermeria}
								onChange={(e) => setSaldoEnfermeria(e.target.value)}
								placeholder="Opcional"
							/>
						</label>
						<label className="block text-sm">
							<span className="font-medium text-slate-700">Notas</span>
							<textarea
								className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
								rows={2}
								value={notas}
								onChange={(e) => setNotas(e.target.value)}
								placeholder="Observaciones opcionales"
							/>
						</label>
						<div>
							<span className="block text-sm font-medium text-slate-700">
								Foto de medidores{fotoObligatoria ? " (obligatoria)" : " (opcional)"}
							</span>
							<p className="mt-0.5 text-xs text-slate-500">
								JPG o PNG (la app comprueba la cabecera del archivo). Si la imagen trae fecha EXIF, debe
								ser del mismo día que “Día de operación”. Sin EXIF (frecuente en fotos reenviadas) la
								foto se acepta: el día operativo queda el del formulario.
							</p>
							<input
								type="file"
								accept="image/jpeg,image/png,.jpg,.jpeg,.png"
								className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium"
								onChange={(e) => setArchivoFoto(e.target.files?.[0] ?? null)}
							/>
							{previewUrl ? (
								<img
									src={previewUrl}
									alt="Vista previa"
									className="mt-3 max-h-48 rounded-lg border border-slate-200 object-contain"
								/>
							) : null}
						</div>
						{errorForm ? (
							<div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
								{errorForm}
							</div>
						) : null}
						{okMsg ? (
							<div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
								{okMsg}
							</div>
						) : null}
						<button
							type="submit"
							disabled={guardando}
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
						>
							{guardando ? "Guardando…" : "Guardar registro"}
						</button>
					</form>
				</section>

				<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-4 py-3">
						<h2 className="text-sm font-medium text-slate-800">
							Eventos del {fechaOperacion}
						</h2>
						<p className="text-xs text-slate-500">
							{loadingLista ? "Cargando…" : `${eventos.length} registro${eventos.length === 1 ? "" : "s"}`}
						</p>
					</div>
					{errorLista ? (
						<div className="px-4 py-3 text-sm text-red-800">{errorLista}</div>
					) : eventos.length === 0 && !loadingLista ? (
						<p className="px-4 py-8 text-center text-sm text-slate-500">
							No hay registros para esta fecha.
						</p>
					) : (
						<ul className="divide-y divide-slate-100">
							{eventos.map((ev) => (
								<li key={ev.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
									<div className="min-w-0 flex-1 space-y-1 text-sm">
										<p className="font-medium text-slate-800">{etiquetaTipo(ev.tipo)}</p>
										<p className="tabular-nums text-slate-700">
											A: {ev.medidorA} · B: {ev.medidorB}
											{ev.saldoEnfermeria != null
												? ` · Saldo decl.: ${ev.saldoEnfermeria}`
												: ""}
										</p>
										{ev.notas ? (
											<p className="text-xs text-slate-600">{ev.notas}</p>
										) : null}
										<p className="text-xs text-slate-400">
											{ev.fotoExifFecha
												? `EXIF fecha: ${ev.fotoExifFecha}`
												: ev.fotoRelativa
													? "Foto sin fecha EXIF registrada"
													: "Sin foto"}
										</p>
									</div>
									{ev.fotoRelativa ? (
										<FotoMiniatura rutaRelativa={ev.fotoRelativa} />
									) : null}
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}

function FotoMiniatura({ rutaRelativa }: { rutaRelativa: string }) {
	const [src, setSrc] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		let url: string | null = null;
		let cancelled = false;
		(async () => {
			try {
				const bytes = await leerFotoOxigeno(rutaRelativa);
				const blob = new Blob([new Uint8Array(bytes)]);
				url = URL.createObjectURL(blob);
				if (!cancelled) setSrc(url);
			} catch {
				if (!cancelled) setErr("No se pudo cargar la miniatura");
			}
		})();
		return () => {
			cancelled = true;
			if (url) URL.revokeObjectURL(url);
		};
	}, [rutaRelativa]);

	if (err) {
		return <p className="text-xs text-red-600">{err}</p>;
	}
	if (!src) {
		return <div className="h-24 w-24 shrink-0 animate-pulse rounded bg-slate-100" />;
	}
	return (
		<img
			src={src}
			alt="Medidores"
			className="h-24 w-auto max-w-[140px] rounded border border-slate-200 object-cover"
		/>
	);
}
