import { useCallback, useEffect, useRef, useState } from "react";
import { buscarClientes, eliminarCliente } from "../../core/api";
import { formatInvokeError } from "../../core/errors";
import { logger } from "../../core/logger";
import type { AppSettings, Cliente } from "../../core/types";
import { ClienteModal } from "./ClienteModal";
import { ClienteResumenModal } from "./ClienteResumenModal";

interface ClientesDashboardProps {
	settings: AppSettings;
}

export function ClientesDashboard({ settings }: ClientesDashboardProps) {
	const [query, setQuery] = useState("");
	const [resultados, setResultados] = useState<Cliente[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<"create" | "edit">("create");
	const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
	const [resumenClienteId, setResumenClienteId] = useState<string | null>(null);
	const [activeIndex, setActiveIndex] = useState(-1);
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
			void logger.invokeError("clientes.buscar", e);
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

	useEffect(() => {
		setActiveIndex(-1);
	}, [resultados]);

	function abrirCrear() {
		setClienteEditando(null);
		setModalMode("create");
		setModalOpen(true);
	}

	function abrirEditar(cliente: Cliente) {
		setResumenClienteId(null);
		setClienteEditando(cliente);
		setModalMode("edit");
		setModalOpen(true);
	}

	function abrirResumen(cliente: Cliente) {
		setResumenClienteId(cliente.id);
	}

	function abrirResumenPorIndice(index: number) {
		const c = resultados[index];
		if (c) abrirResumen(c);
	}

	function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (resultados.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => {
				if (i < 0) return 0;
				return i < resultados.length - 1 ? i + 1 : 0;
			});
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => {
				if (i < 0) return resultados.length - 1;
				return i > 0 ? i - 1 : resultados.length - 1;
			});
			return;
		}
		if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
			e.preventDefault();
			const idx = activeIndex >= 0 ? activeIndex : 0;
			abrirResumenPorIndice(idx);
		}
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

	async function handleEliminar(id: string): Promise<boolean> {
		if (!window.confirm("¿Confirmar eliminación del cliente?")) return false;
		try {
			await eliminarCliente(id);
			setResultados((prev) => prev.filter((c) => c.id !== id));
			return true;
		} catch (e) {
			void logger.invokeError("clientes.eliminar", e);
			setSearchError(formatInvokeError(e) || "No se pudo eliminar el cliente");
			return false;
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
							Busca por nombre, apellido o número de documento. Con resultados: flechas
							para resaltar, Enter o Tab para abrir la ficha.
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
						onKeyDown={handleSearchKeyDown}
						placeholder="Buscar por nombre, apellido o documento…"
						className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
						aria-controls="clientes-resultados-lista"
						aria-activedescendant={
							activeIndex >= 0 && resultados[activeIndex]
								? `cliente-resultado-${resultados[activeIndex].id}`
								: undefined
						}
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
					<div
						id="clientes-resultados-lista"
						className="space-y-2"
						role="listbox"
						aria-label="Coincidencias de búsqueda"
					>
						{resultados.map((c, i) => (
							<button
								key={c.id}
								id={`cliente-resultado-${c.id}`}
								type="button"
								role="option"
								aria-selected={i === activeIndex}
								onClick={() => abrirResumen(c)}
								onMouseEnter={() => setActiveIndex(i)}
								className={`flex w-full rounded-xl border px-4 py-3 text-left shadow-sm transition-colors ${
									i === activeIndex
										? "border-sky-400 bg-sky-50 ring-1 ring-sky-300"
										: "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
								}`}
							>
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-slate-900 truncate">
										{c.nombres} {c.apellidos}
									</p>
									<p className="mt-0.5 text-sm text-slate-600">
										{c.documentType} {c.documentNumber}
									</p>
								</div>
							</button>
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

			<ClienteResumenModal
				open={resumenClienteId !== null}
				clienteId={resumenClienteId}
				settings={settings}
				adminMode={settings.adminMode}
				onClose={() => setResumenClienteId(null)}
				onEditar={(cl) => abrirEditar(cl)}
				onEliminar={
					settings.adminMode
						? async (id) => {
								const ok = await handleEliminar(id);
								if (ok) setResumenClienteId(null);
						  }
						: undefined
				}
			/>
		</div>
	);
}
