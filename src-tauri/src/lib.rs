mod appointment_model;
mod commands;
mod db;
mod finance;
mod settings_model;
mod time_rules;

use std::sync::Mutex;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_opener::init())
		.setup(|app| {
			let conn = db::open_connection(app.handle()).map_err(|e| {
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
		])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
