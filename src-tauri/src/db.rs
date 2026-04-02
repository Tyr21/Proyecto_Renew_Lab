use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager};

use crate::settings_model::AppSettings;

const DB_FILE: &str = "consultorio.db";

pub fn open_connection(app: &AppHandle) -> Result<Connection, String> {
	let dir = app
		.path()
		.app_data_dir()
		.map_err(|e| e.to_string())?;
	std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
	let path = dir.join(DB_FILE);
	let conn = Connection::open(path).map_err(|e| e.to_string())?;
	conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(|e| e.to_string())?;
	run_migrations(&conn)?;
	seed_settings_if_empty(&conn)?;
	Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
	conn
		.execute_batch(
			r#"
			CREATE TABLE IF NOT EXISTS appointments (
				id TEXT PRIMARY KEY,
				patient_full_name TEXT NOT NULL,
				document_type TEXT NOT NULL,
				document_number TEXT NOT NULL,
				phone_dial_code TEXT NOT NULL,
				phone_national_number TEXT NOT NULL,
				birthday_month INTEGER,
				appointment_date TEXT NOT NULL,
				start_time TEXT NOT NULL,
				end_time TEXT NOT NULL,
				service_type TEXT NOT NULL,
				status TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_appointments_date
				ON appointments(appointment_date);

			CREATE TABLE IF NOT EXISTS app_config (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				settings_json TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS ingresos (
				id TEXT PRIMARY KEY,
				cita_id TEXT,
				paciente_documento TEXT NOT NULL,
				concepto TEXT NOT NULL,
				monto REAL NOT NULL,
				metodo_pago TEXT NOT NULL,
				fecha_pago TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha_pago);
		"#,
		)
		.map_err(|e| e.to_string())?;

	// Migración incremental: agrega paciente_nombre si aún no existe
	let _ = conn.execute(
		"ALTER TABLE ingresos ADD COLUMN paciente_nombre TEXT NOT NULL DEFAULT ''",
		[],
	);

	Ok(())
}

fn seed_settings_if_empty(conn: &Connection) -> Result<(), String> {
	let existing: Option<String> = conn
		.query_row(
			"SELECT settings_json FROM app_config WHERE id = 1",
			[],
			|row| row.get(0),
		)
		.optional()
		.map_err(|e| e.to_string())?;

	if existing.is_none() {
		let defaults = AppSettings::default();
		let json = serde_json::to_string(&defaults).map_err(|e| e.to_string())?;
		conn.execute(
			"INSERT INTO app_config (id, settings_json) VALUES (1, ?1)",
			params![json],
		)
		.map_err(|e| e.to_string())?;
	}
	Ok(())
}

#[cfg(test)]
pub fn open_in_memory_test_database() -> Result<Connection, String> {
	let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
	conn
		.execute_batch("PRAGMA foreign_keys = ON;")
		.map_err(|e| e.to_string())?;
	run_migrations(&conn)?;
	seed_settings_if_empty(&conn)?;
	Ok(conn)
}
