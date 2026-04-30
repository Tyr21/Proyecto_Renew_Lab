mod admin_auth;
mod appointment_model;
mod backup;
mod backup_commands;
mod clientes;
mod commands;
mod db;
mod error;
mod eventos;
mod facturacion;
mod finance;
mod oxigeno;
mod paquetes;
mod reports;
mod settings_model;
mod startup_auth;
mod time_rules;

use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

/// Tamaño máximo por archivo de log antes de rotar (5 MB).
const LOG_MAX_FILE_SIZE: u128 = 5 * 1024 * 1024;
/// Nombre base del archivo de logs en `LogDir`.
const LOG_FILE_NAME: &str = "renew-lab";

fn try_startup_backup(app_data_dir: &std::path::Path) {
	let db_path = app_data_dir.join("consultorio.db");
	if !db_path.exists() {
		return;
	}
	let Ok(tmp_conn) =
		rusqlite::Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
	else {
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
		Ok(n) if n > 0 => log::info!(target: "backup", "{n} respaldo(s) creado(s) al iniciar"),
		Err(e) => log::error!(target: "backup", "error en respaldo de inicio: {e}"),
		_ => {}
	}
}

/// Plugin de logs persistentes con rotación por tamaño.
///
/// Escribe a:
/// - Consola (stdout) — útil en `tauri dev` y para soporte vía DevTools.
/// - Archivo en `LogDir` del sistema (ver README) con rotación automática
///   cuando un archivo supera `LOG_MAX_FILE_SIZE`. Los archivos antiguos
///   se conservan con timestamp en el nombre.
fn build_log_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
	tauri_plugin_log::Builder::new()
		.targets([
			Target::new(TargetKind::Stdout),
			Target::new(TargetKind::LogDir {
				file_name: Some(LOG_FILE_NAME.into()),
			}),
		])
		.max_file_size(LOG_MAX_FILE_SIZE)
		.rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
		.level(log::LevelFilter::Info)
		.build()
}

fn build_tauri_app() -> tauri::Builder<tauri::Wry> {
	let builder = tauri::Builder::default()
		.plugin(build_log_plugin())
		.plugin(tauri_plugin_dialog::init());

	#[cfg(not(any(target_os = "android", target_os = "ios")))]
	let builder = builder
		.plugin(tauri_plugin_process::init())
		.plugin(tauri_plugin_updater::Builder::new().build());

	builder
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	build_tauri_app()
		.setup(|app| {
			let dir = app
				.handle()
				.path()
				.app_data_dir()
				.map_err(|e| std::io::Error::other(e.to_string()))?;
			std::fs::create_dir_all(&dir).map_err(|e| std::io::Error::other(e.to_string()))?;

			try_startup_backup(&dir);

			let conn = db::open_connection(app.handle()).map_err(std::io::Error::other)?;
			commands::ensure_persisted_admin_mode_off(&conn).map_err(std::io::Error::other)?;
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
			clientes::advertencia_homonimia_cliente,
			clientes::buscar_clientes,
			clientes::buscar_cliente_por_documento_exacto,
			clientes::obtener_cliente,
			clientes::obtener_resumen_cliente_dashboard,
			clientes::eliminar_cliente,
			paquetes::crear_paquete,
			paquetes::crear_cliente_y_paquete,
			paquetes::listar_paquetes_cliente,
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
			oxigeno::listar_oxigeno_por_rango,
			oxigeno::registrar_evento_oxigeno,
			oxigeno::resumen_oxigeno_rango,
			oxigeno::leer_foto_oxigeno,
			oxigeno::obtener_ultima_lectura_oxigeno,
			backup_commands::listar_respaldos_locales,
			backup_commands::restaurar_respaldo,
		])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
