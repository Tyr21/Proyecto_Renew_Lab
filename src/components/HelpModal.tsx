interface HelpModalProps {
	open: boolean;
	onClose: () => void;
}

/**
 * Guía breve en pantalla (complementa docs/MANUAL_USUARIO.md).
 */
export function HelpModal({ open, onClose }: HelpModalProps) {
	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="help-modal-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="shrink-0 border-b border-slate-200 px-5 py-4">
					<h2
						id="help-modal-title"
						className="text-lg font-semibold text-slate-800"
					>
						Ayuda
					</h2>
					<p className="mt-1 text-sm text-slate-600">
						Resumen de la aplicación. Los datos se guardan en este equipo (base de
						datos local); el funcionamiento habitual no requiere Internet.
					</p>
				</div>
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm text-slate-700">
					<section>
						<h3 className="font-semibold text-slate-800">Navegación</h3>
						<p className="mt-2">
							Arriba tiene cuatro pestañas: <strong>Calendario</strong>,{" "}
							<strong>Reportes</strong>, <strong>Clientes</strong> y{" "}
							<strong>Configuración</strong>. Este botón de ayuda no cierra su
							trabajo: vuelva cuando lo necesite.
						</p>
					</section>

					<section>
						<h3 className="font-semibold text-slate-800">Calendario</h3>
						<ul className="mt-2 list-disc space-y-1.5 pl-5">
							<li>
								Semana en columnas y panel lateral con el día de hoy; puede
								incluir domingo según ajustes.
							</li>
							<li>
								Clic en un hueco libre para nueva cita; clic en una cita para
								verla o editarla. El sistema respeta la capacidad por tipo de
								servicio (varias plazas a la misma hora si está configurado).
							</li>
							<li>
								Estados: pendiente, asistió o no asistió. Si marcó{" "}
								<strong>asistió</strong>, puede abrirse el registro de pago desde
								el aviso.
							</li>
							<li>
								Eventos y recordatorios (mantenimiento, etc.) se crean desde los
								controles del calendario.
							</li>
						</ul>
					</section>

					<section>
						<h3 className="font-semibold text-slate-800">Reportes</h3>
						<p className="mt-2">
							Todo está bajo la pestaña <strong>Reportes</strong>, usando las
							subpestañas:
						</p>
						<ul className="mt-2 list-disc space-y-1.5 pl-5">
							<li>
								<strong>Cierre de caja:</strong> ingresos por rango de fechas,
								totales por medio de pago, gráfico por día, exportar CSV o PDF.
								Incluye tabla de <strong>oxígeno</strong> (sesiones atendidas,
								consumo teórico y lecturas del día) para el mismo rango.
							</li>
							<li>
								<strong>Facturas:</strong> borradores, emitir, consultar emitidas
								o anuladas según permisos.
							</li>
							<li>
								<strong>Oxígeno:</strong> registro por día (dos medidores, tipo
								de evento, notas). La foto debe ser JPG o PNG con{" "}
								<strong>fecha EXIF</strong> del mismo día de operación (salvo tipo
								“Extra”, donde la foto es opcional). El saldo declarado es
								opcional y no sustituye las lecturas.
							</li>
							<li>
								<strong>Estadísticas:</strong> indicadores y gráficas por período.
							</li>
							<li>
								<strong>Movimientos detallados:</strong> cada ingreso con
								detalles; filtre por fechas e imprima o exporte si aplica.
							</li>
						</ul>
					</section>

					<section>
						<h3 className="font-semibold text-slate-800">Clientes</h3>
						<ul className="mt-2 list-disc space-y-1.5 pl-5">
							<li>Busque por nombre o documento y abra la ficha del paciente.</li>
							<li>
								Al agendar o editar citas puede autocompletar datos si el cliente
								ya existe.
							</li>
						</ul>
					</section>

					<section>
						<h3 className="font-semibold text-slate-800">Configuración</h3>
						<ul className="mt-2 list-disc space-y-1.5 pl-5">
							<li>
								Requiere <strong>contraseña de administrador</strong> al entrar;
								al salir y volver, se vuelve a pedir.
							</li>
							<li>
								Aquí ajusta calendario, documentos, servicios y precios sugeridos,
								facturación, respaldos automáticos, oxígeno (unidad, K por sesión,
								tipo de servicio a contar) y modo administrador / contraseñas.
							</li>
							<li>
								El <strong>modo administrador</strong> no permanece activo al
								cerrar y abrir la aplicación: debe activarlo de nuevo si lo
								necesita.
							</li>
						</ul>
					</section>

					<section>
						<h3 className="font-semibold text-slate-800">Si algo no guarda</h3>
						<p className="mt-2">
							Lea el mensaje de error: suele indicar datos faltantes, cupo lleno u
							otra regla del consultorio. Use respaldos periódicos según lo
							configurado en Configuración.
						</p>
					</section>
				</div>
				<div className="shrink-0 border-t border-slate-200 px-5 py-3">
					<button
						type="button"
						onClick={onClose}
						className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
					>
						Cerrar
					</button>
				</div>
			</div>
		</div>
	);
}
