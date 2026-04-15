import { useCallback, useEffect, useRef, useState } from "react";
import { buscarClientes, eliminarCliente } from "../../core/api";
import { formatInvokeError } from "../../core/errors";
import type { AppSettings, Cliente } from "../../core/types";
import { ClienteModal } from "./ClienteModal";

interface ClientesDashboardProps {
	settings: AppSettings;
}

const MESES = [
	"Ene", "Feb", "Mar", "Abr", "May", "Jun",
	"Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function ClientesDashboard({ settings }: ClientesDashboardProps) {
	const [query, setQuery] = useState("");
	const [resultados, setResultados] = useState<Cliente[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<"create" | "edit">("create");
	const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const ejecutarBusqueda = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResultados([]);
			setSearching(false);
			return;
		}
		setSearching(true);
		setSearchError(null);
		try {
			const found = await buscarClientes(q.trim());
			setResultados(found);
		} catch (e) {
			setSearchError(formatInvokeError(e) || "Error al buscar clientes");
		} finally {
			setSearching(false);
		}
	}, []);

	function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
		const val = e.target.value;
		setQuery(val);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			void ejecutarBusqueda(val);
		}, 200);
	}

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	function abrirCrear() {
		setClienteEditando(null);
		setModalMode("create");
		setModalOpen(true);
	}

	function abrirEditar(cliente: Cliente) {
		setClienteEditando(cliente);
		setModalMode("edit");
		setModalOpen(true);
	}

	function handleSaved(cliente: Cliente) {
		setModalOpen(false);
		// Refrescar resultados si hay query activo, o limpiar
		if (query.trim()) {
			void ejecutarBusqueda(query);
		} else {
			// Mostrar el cliente recién creado/editado
			setResultados([cliente]);
		}
	}

	async function handleEliminar(id: string) {
		if (!window.confirm("¿Confirmar eliminación del cliente?")) return;
		setDeletingId(id);
		try {
			await eliminarCliente(id);
			setResultados((prev) => prev.filter((c) => c.id !== id));
		} catch (e) {
			setSearchError(formatInvokeError(e) || "No se pudo eliminar el cliente");
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
			<div className="mx-auto max-w-3xl space-y-6">
				{/* Header */}
				<header className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-semibold text-slate-800">
							👥 Clientes
						</h1>
						<p className="mt-0.5 text-sm text-slate-500">
							Busca por nombre, apellido o número de documento
						</p>
					</div>
					<button
						type="button"
						onClick={abrirCrear}
						className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 shadow-sm"
					>
						+ Crear cliente
					</button>
				</header>

				{/* Buscador */}
				<div className="relative">
					<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
						🔍
					</span>
					<input
						type="search"
						value={query}
						onChange={handleQueryChange}
						placeholder="Buscar por nombre, apellido o documento…"
						className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
					/>
					{searching ? (
						<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
							Buscando…
						</span>
					) : null}
				</div>

				{/* Error de búsqueda */}
				{searchError ? (
					<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
						{searchError}
					</div>
				) : null}

				{/* Resultados */}
				{!query.trim() ? (
					<div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-400 text-sm">
						Escribe al menos un carácter para buscar clientes
					</div>
				) : resultados.length === 0 && !searching ? (
					<div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-400 text-sm">
						No se encontraron clientes para <strong>"{query}"</strong>
					</div>
				) : (
					<div className="space-y-3">
						{resultados.map((c) => (
							<div
								key={c.id}
								className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										{/* Nombre completo */}
										<p className="font-semibold text-slate-900 truncate">
											{c.apellidos}, {c.nombres}
										</p>

										{/* Documento */}
										<p className="mt-1 text-sm text-slate-600">
											{c.documentType} {c.documentNumber}
										</p>

										{/* Datos de contacto */}
										<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
											{c.phoneNationalNumber ? (
												<span>
													📞 {c.phoneDialCode} {c.phoneNationalNumber}
												</span>
											) : null}
											{c.email ? (
												<span>✉️ {c.email}</span>
											) : null}
											{c.birthdayMonth ? (
												<span>🎂 {MESES[c.birthdayMonth - 1]}</span>
											) : null}
										</div>

										{/* Notas */}
										{c.notas ? (
											<p className="mt-2 text-xs text-slate-400 italic truncate">
												{c.notas}
											</p>
										) : null}
									</div>

									{/* Acciones */}
									<div className="flex shrink-0 gap-2">
										<button
											type="button"
											onClick={() => abrirEditar(c)}
											className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
										>
											Editar
										</button>
										{settings.adminMode ? (
											<button
												type="button"
												disabled={deletingId === c.id}
												onClick={() => void handleEliminar(c.id)}
												className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
											>
												{deletingId === c.id ? "…" : "Eliminar"}
											</button>
										) : null}
									</div>
								</div>
							</div>
						))}

						{resultados.length === 5 ? (
							<p className="text-center text-xs text-slate-400">
								Mostrando los primeros 5 resultados — refina tu búsqueda para encontrar más
							</p>
						) : null}
					</div>
				)}
			</div>

			<ClienteModal
				open={modalOpen}
				settings={settings}
				mode={modalMode}
				initial={clienteEditando}
				onClose={() => setModalOpen(false)}
				onSaved={handleSaved}
			/>
		</div>
	);
}
