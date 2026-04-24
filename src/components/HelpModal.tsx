interface HelpModalProps {
	open: boolean;
	onClose: () => void;
}

/**
 * Guía breve para el uso diario (sin apartado de Configuración).
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
				className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl flex flex-col"
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
						Resumen de lo que puede hacer en la aplicación.
					</p>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-700 space-y-5">
					<section>
						<h3 className="font-semibold text-slate-800">Calendario</h3>
						<ul className="mt-2 list-disc space-y-1 pl-5">
							<li>
								Vea la semana en columnas y el panel lateral con el día de hoy.
							</li>
							<li>
								Haga clic en un espacio libre para agendar una cita; en una cita
								para verla o editarla.
							</li>
							<li>
								Puede marcar si el paciente asistió o no; si asistió, se puede
								registrar el pago desde el aviso que aparece.
							</li>
							<li>
								Cree recordatorios o eventos desde el calendario para no olvidar
								tareas.
							</li>
						</ul>
					</section>

					<section>
						<h3 className="font-semibold text-slate-800">Reportes</h3>
						<p className="mt-2">
							Aquí están los informes y el dinero. Use las pestañas internas:
						</p>
						<ul className="mt-2 list-disc space-y-1 pl-5">
							<li>
								<strong>Cierre de caja:</strong> ingresos por fechas, totales por
								medio de pago, tabla de oxígeno (sesiones vs. consumo teórico y
								lecturas), exportar o imprimir el resumen.
							</li>
							<li>
								<strong>Facturas:</strong> borradores, emitir factura y consultar
								las ya emitidas.
							</li>
							<li>
								<strong>Oxígeno:</strong> registro diario de medidores, foto con
								fecha EXIF y saldo opcional; parámetros en Configuración.
							</li>
							<li>
								<strong>Estadísticas:</strong> gráficas y números del consultorio
								según el período que elija.
							</li>
							<li>
								<strong>Movimientos detallados:</strong> listado de cada ingreso
								con cliente, servicio, medio de pago y recibo; filtre por fechas e
								imprima o exporte si lo necesita.
							</li>
						</ul>
					</section>

					<section>
						<h3 className="font-semibold text-slate-800">Clientes</h3>
						<ul className="mt-2 list-disc space-y-1 pl-5">
							<li>Busque y abra fichas de pacientes.</li>
							<li>
								Al crear o editar citas puede autocompletar datos desde aquí si el
								cliente ya existe.
							</li>
						</ul>
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
