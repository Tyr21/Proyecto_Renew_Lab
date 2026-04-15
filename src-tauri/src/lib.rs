mod admin_auth;
mod appointment_model;
mod backup;
mod clientes;
mod commands;
mod db;
mod error;
mod eventos;
mod facturacion;
mod finance;
mod reports;
mod settings_model;
mod startup_auth;
mod time_rules;

use std::sync::Mutex;

use tauri::Manager;

fn try_startup_backup(app_data_dir: &std::path::Path) {
	let db_path = app_data_dir.join("consultorio.db");
	if !db_path.exists() {
		return;
	}
	let Ok(tmp_conn) = rusqlite::Connection::open_with_flags(
		&db_path,
		rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
	) else {
		return;
	};
	let settings_json: Option<String> = tmp_conn
		.query_row(
			"SELECT settings_json FROM app_config WHERE id = 1",
			[],
			|row| row.get(0),
		)
		.ok();
	drop(tmp_conn);

	let backup_settings = settings_json
		.and_then(|json| serde_json::from_str::<settings_model::AppSettings>(&json).ok())
		.map(|s| s.backup)
		.unwrap_or_default();

	match backup::run_startup_backup(app_data_dir, &backup_settings) {
		Ok(n) if n > 0 => println!("[backup] {n} respaldo(s) creado(s) al iniciar"),
		Err(e) => eprintln!("[backup] error: {e}"),
		_ => {}
	}
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.setup(|app| {
			let dir = app.handle().path().app_data_dir().map_err(|e| {
				std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
			})?;
			std::fs::create_dir_all(&dir).map_err(|e| {
				std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
			})?;

			try_startup_backup(&dir);

			let conn = db::open_connection(app.handle()).map_err(|e| {
				std::io::Error::new(std::io::ErrorKind::Other, e)
			})?;
			commands::ensure_persisted_admin_mode_off(&conn).map_err(|e| {
				std::io::Error::new(std::io::ErrorKind::Other, e)
			})?;
			app.manage(Mutex::new(conn));
			Ok(())
		})
		.invoke_handler(tauri::generate_handler![
			commands::get_settings,
			commands::save_settings,
			commands::list_appointments_range,
			commands::create_appointment,
			commands::update_appointment,
			commands::delete_appointment,
			commands::get_appointment,
			finance::crear_ingreso,
			finance::obtener_ingresos,
			finance::listar_movimientos_financieros_detalle,
			finance::eliminar_ingreso,
			reports::estadisticas_citas_por_mes,
			reports::estadisticas_ingresos_por_mes,
			reports::estadisticas_servicios,
			reports::estadisticas_metodos_pago,
			clientes::crear_cliente,
			clientes::actualizar_cliente,
			clientes::buscar_clientes,
			clientes::obtener_cliente,
			clientes::eliminar_cliente,
			facturacion::listar_facturas,
			facturacion::obtener_factura,
			facturacion::guardar_borrador_factura,
			facturacion::emitir_factura,
			facturacion::anular_factura,
			eventos::listar_eventos_rango,
			eventos::crear_evento,
			eventos::actualizar_evento,
			eventos::eliminar_evento,
			startup_auth::get_startup_auth_status,
			startup_auth::verify_startup_password,
			startup_auth::set_startup_password,
			startup_auth::clear_startup_password_with_admin,
			startup_auth::set_startup_password_with_admin,
			admin_auth::get_admin_auth_status,
			admin_auth::verify_admin_password,
			admin_auth::set_admin_password,
			admin_auth::clear_admin_password,
		])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
