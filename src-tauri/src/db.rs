use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager};

use crate::settings_model::AppSettings;

const DB_FILE: &str = "consultorio.db";

// ---------------------------------------------------------------------------
// CIFRADO DE BASE DE DATOS — Evaluación de seguridad (2026-04)
// ---------------------------------------------------------------------------
// La BD almacena datos sensibles de pacientes (nombres, documentos, teléfonos)
// en texto plano. Para cifrarla con SQLCipher:
//
// 1. Cambiar en Cargo.toml: features = ["bundled-sqlcipher-vendored-openssl"]
//    (esto compila OpenSSL junto con SQLCipher, sin dependencias externas).
//
// 2. Después de `Connection::open()`, ejecutar:
//      conn.execute_batch("PRAGMA key = 'clave-segura';")?;
//
// 3. Gestión de clave: usar el keychain del SO (Windows Credential Manager
//    / DPAPI) mediante la crate `keyring` para almacenar/recuperar la clave.
//    NUNCA almacenar la clave en el código o en configuración.
//
// 4. Migrar la BD existente (sin cifrar) a cifrada:
//      - Abrir BD sin cifrar
//      - ATTACH la nueva BD cifrada con la clave
//      - SELECT sqlcipher_export('nombre_attached')
//      - Reemplazar el archivo original
//
// 5. Los respaldos (backup.rs) copiarán el archivo cifrado tal cual, que es
//    ilegible sin la clave.
//
// REQUISITOS PREVIOS: Planificar mecanismo de recuperación de clave y
// migración antes de activar en producción.
// ---------------------------------------------------------------------------

pub fn open_connection(app: &AppHandle) -> Result<Connection, String> {
	let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
	std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
	let path = dir.join(DB_FILE);
	let conn = Connection::open(path).map_err(|e| e.to_string())?;
	conn.execute_batch(
		"PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; PRAGMA secure_delete = ON;",
	)
	.map_err(|e| e.to_string())?;
	run_migrations(&conn)?;
	seed_settings_if_empty(&conn)?;
	Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
	conn.execute_batch(
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

			CREATE TABLE IF NOT EXISTS clientes (
				id TEXT PRIMARY KEY,
				nombres TEXT NOT NULL,
				apellidos TEXT NOT NULL,
				document_type TEXT NOT NULL,
				document_number TEXT NOT NULL,
				phone_dial_code TEXT NOT NULL DEFAULT '',
				phone_national_number TEXT NOT NULL DEFAULT '',
				email TEXT NOT NULL DEFAULT '',
				birthday_month INTEGER,
				notas TEXT NOT NULL DEFAULT '',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_document
				ON clientes(document_number);

			CREATE INDEX IF NOT EXISTS idx_clientes_nombres
				ON clientes(nombres, apellidos);
		"#,
	)
	.map_err(|e| e.to_string())?;

	// Migración incremental: agrega paciente_nombre si aún no existe
	let _ = conn.execute(
		"ALTER TABLE ingresos ADD COLUMN paciente_nombre TEXT NOT NULL DEFAULT ''",
		[],
	);

	backfill_ingresos_paciente_nombre(conn)?;

	let _ =
		conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_ingresos_cita ON ingresos(cita_id);");

	run_facturacion_migrations(conn)?;
	run_eventos_migrations(conn)?;
	run_startup_auth_migration(conn)?;
	run_admin_auth_migration(conn)?;
	run_paquetes_migrations(conn)?;
	run_oxigeno_migrations(conn)?;

	Ok(())
}

fn run_oxigeno_migrations(conn: &Connection) -> Result<(), String> {
	conn.execute_batch(
		r#"
			CREATE TABLE IF NOT EXISTS oxigeno_eventos (
				id TEXT PRIMARY KEY,
				fecha_operacion TEXT NOT NULL,
				tipo TEXT NOT NULL,
				medidor_a REAL NOT NULL,
				medidor_b REAL NOT NULL,
				saldo_enfermeria REAL,
				notas TEXT NOT NULL DEFAULT '',
				foto_relativa TEXT,
				foto_exif_fecha TEXT,
				created_at TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_oxigeno_fecha ON oxigeno_eventos(fecha_operacion);
		"#,
	)
	.map_err(|e| e.to_string())?;
	Ok(())
}

fn run_paquetes_migrations(conn: &Connection) -> Result<(), String> {
	conn.execute_batch(
		r#"
			CREATE TABLE IF NOT EXISTS paquetes (
				id TEXT PRIMARY KEY,
				cliente_id TEXT NOT NULL,
				service_type TEXT NOT NULL,
				total_sesiones INTEGER NOT NULL CHECK (total_sesiones > 0),
				precio_total REAL NOT NULL CHECK (precio_total > 0),
				status TEXT NOT NULL,
				expires_at TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_paquetes_cliente ON paquetes(cliente_id);
			CREATE INDEX IF NOT EXISTS idx_paquetes_status ON paquetes(status);
		"#,
	)
	.map_err(|e| e.to_string())?;

	let _ = conn.execute("ALTER TABLE appointments ADD COLUMN paquete_id TEXT", []);
	let _ = conn.execute_batch(
		"CREATE INDEX IF NOT EXISTS idx_appointments_paquete ON appointments(paquete_id);",
	);

	let _ = conn.execute("ALTER TABLE ingresos ADD COLUMN paquete_id TEXT", []);

	Ok(())
}

fn run_startup_auth_migration(conn: &Connection) -> Result<(), String> {
	conn.execute_batch(
		r#"
			CREATE TABLE IF NOT EXISTS startup_auth (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				password_hash TEXT
			);
			"#,
	)
	.map_err(|e| e.to_string())?;
	conn.execute(
		"INSERT OR IGNORE INTO startup_auth (id, password_hash) VALUES (1, NULL)",
		[],
	)
	.map_err(|e| e.to_string())?;
	Ok(())
}

fn run_admin_auth_migration(conn: &Connection) -> Result<(), String> {
	conn.execute_batch(
		r#"
			CREATE TABLE IF NOT EXISTS admin_auth (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				password_hash TEXT
			);
			"#,
	)
	.map_err(|e| e.to_string())?;
	conn.execute(
		"INSERT OR IGNORE INTO admin_auth (id, password_hash) VALUES (1, NULL)",
		[],
	)
	.map_err(|e| e.to_string())?;
	Ok(())
}

/// Completa `paciente_nombre` en filas antiguas donde quedó vacío tras la migración de columna.
/// 1) Por cita vinculada (`appointments.id`).
/// 2) Por documento coincidente con la última cita del paciente (`updated_at`).
fn backfill_ingresos_paciente_nombre(conn: &Connection) -> Result<(), String> {
	conn.execute(
		r#"
			UPDATE ingresos
			SET paciente_nombre = (
				SELECT a.patient_full_name
				FROM appointments a
				WHERE a.id = ingresos.cita_id
			)
			WHERE TRIM(COALESCE(paciente_nombre, '')) = ''
				AND cita_id IS NOT NULL
				AND TRIM(cita_id) != ''
				AND EXISTS (SELECT 1 FROM appointments a WHERE a.id = ingresos.cita_id)
			"#,
		[],
	)
	.map_err(|e| e.to_string())?;

	conn.execute(
		r#"
			UPDATE ingresos
			SET paciente_nombre = (
				SELECT a.patient_full_name
				FROM appointments a
				WHERE TRIM(a.document_number) = TRIM(ingresos.paciente_documento)
				ORDER BY a.updated_at DESC
				LIMIT 1
			)
			WHERE TRIM(COALESCE(paciente_nombre, '')) = ''
				AND EXISTS (
					SELECT 1 FROM appointments a
					WHERE TRIM(a.document_number) = TRIM(ingresos.paciente_documento)
				)
			"#,
		[],
	)
	.map_err(|e| e.to_string())?;

	Ok(())
}

fn run_facturacion_migrations(conn: &Connection) -> Result<(), String> {
	conn.execute_batch(
		r#"
			CREATE TABLE IF NOT EXISTS facturas (
				id TEXT PRIMARY KEY,
				estado TEXT NOT NULL DEFAULT 'borrador',
				serie TEXT NOT NULL DEFAULT 'FV',
				numero INTEGER,
				cliente_nombre TEXT NOT NULL DEFAULT '',
				cliente_documento_tipo TEXT NOT NULL DEFAULT '',
				cliente_documento_numero TEXT NOT NULL DEFAULT '',
				subtotal REAL NOT NULL DEFAULT 0,
				impuesto_total REAL NOT NULL DEFAULT 0,
				total REAL NOT NULL DEFAULT 0,
				notas TEXT NOT NULL DEFAULT '',
				cita_id TEXT,
				fecha_emision TEXT,
				anulacion_motivo TEXT,
				anulada_at TEXT,
				dian_metadata_json TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_serie_numero
				ON facturas(serie, numero) WHERE numero IS NOT NULL;

			CREATE INDEX IF NOT EXISTS idx_facturas_estado ON facturas(estado);
			CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas(fecha_emision);

			CREATE TABLE IF NOT EXISTS factura_lineas (
				id TEXT PRIMARY KEY,
				factura_id TEXT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
				orden INTEGER NOT NULL DEFAULT 0,
				descripcion TEXT NOT NULL DEFAULT '',
				cantidad REAL NOT NULL DEFAULT 1,
				precio_unitario REAL NOT NULL DEFAULT 0,
				tasa_impuesto_pct REAL NOT NULL DEFAULT 0,
				base_imponible REAL NOT NULL DEFAULT 0,
				impuesto REAL NOT NULL DEFAULT 0,
				total_linea REAL NOT NULL DEFAULT 0
			);

			CREATE INDEX IF NOT EXISTS idx_factura_lineas_factura
				ON factura_lineas(factura_id);

			CREATE TABLE IF NOT EXISTS facturacion_contadores (
				serie TEXT PRIMARY KEY,
				ultimo_numero INTEGER NOT NULL DEFAULT 0
			);
		"#,
	)
	.map_err(|e| e.to_string())?;

	let _ = conn.execute(
		"ALTER TABLE ingresos ADD COLUMN factura_id TEXT DEFAULT NULL",
		[],
	);

	let _ = conn
		.execute_batch("CREATE INDEX IF NOT EXISTS idx_ingresos_factura ON ingresos(factura_id);");

	Ok(())
}

fn run_eventos_migrations(conn: &Connection) -> Result<(), String> {
	conn.execute_batch(
		r#"
			CREATE TABLE IF NOT EXISTS eventos (
				id TEXT PRIMARY KEY,
				titulo TEXT NOT NULL,
				descripcion TEXT NOT NULL DEFAULT '',
				fecha TEXT NOT NULL,
				todo_el_dia INTEGER NOT NULL DEFAULT 1,
				hora_inicio TEXT,
				hora_fin TEXT,
				color TEXT NOT NULL DEFAULT 'amber',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha);
		"#,
	)
	.map_err(|e| e.to_string())?;
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
	conn.execute_batch("PRAGMA foreign_keys = ON;")
		.map_err(|e| e.to_string())?;
	run_migrations(&conn)?;
	seed_settings_if_empty(&conn)?;
	Ok(conn)
}

#[cfg(test)]
mod tests {
	use super::*;

	fn insert_appointment(
		conn: &Connection,
		id: &str,
		name: &str,
		document_number: &str,
		updated_at: &str,
	) {
		conn.execute(
			r#"
				INSERT INTO appointments (
					id, patient_full_name, document_type, document_number,
					phone_dial_code, phone_national_number, birthday_month,
					appointment_date, start_time, end_time, service_type, status,
					created_at, updated_at
				) VALUES (?1, ?2, 'CC', ?3, '+57', '3000000000', NULL,
					'2026-01-01', '09:00', '09:30', 'consulta', 'confirmada',
					'2026-01-01T10:00:00Z', ?4)
				"#,
			params![id, name, document_number, updated_at],
		)
		.unwrap();
	}

	#[test]
	fn backfill_paciente_nombre_desde_cita_id() {
		let conn = open_in_memory_test_database().unwrap();
		insert_appointment(&conn, "cita-1", "Ana López", "1090", "2026-01-02T10:00:00Z");
		conn.execute(
			r#"
				INSERT INTO ingresos (
					id, cita_id, paciente_nombre, paciente_documento, concepto, monto, metodo_pago, fecha_pago
				) VALUES ('ing-1', 'cita-1', '', '1090', 'Servicio', 50.0, 'Efectivo', '2026-01-03T12:00:00Z')
				"#,
			[],
		)
		.unwrap();

		backfill_ingresos_paciente_nombre(&conn).unwrap();

		let nombre: String = conn
			.query_row(
				"SELECT paciente_nombre FROM ingresos WHERE id = 'ing-1'",
				[],
				|row| row.get(0),
			)
			.unwrap();
		assert_eq!(nombre, "Ana López");
	}

	#[test]
	fn backfill_paciente_nombre_por_documento_sin_cita() {
		let conn = open_in_memory_test_database().unwrap();
		insert_appointment(
			&conn,
			"cita-x",
			"Carlos Ruiz",
			"7711",
			"2026-02-01T10:00:00Z",
		);
		conn.execute(
			r#"
				INSERT INTO ingresos (
					id, cita_id, paciente_nombre, paciente_documento, concepto, monto, metodo_pago, fecha_pago
				) VALUES ('ing-2', NULL, '', '7711', 'Otro', 20.0, 'Transferencia', '2026-02-02T12:00:00Z')
				"#,
			[],
		)
		.unwrap();

		backfill_ingresos_paciente_nombre(&conn).unwrap();

		let nombre: String = conn
			.query_row(
				"SELECT paciente_nombre FROM ingresos WHERE id = 'ing-2'",
				[],
				|row| row.get(0),
			)
			.unwrap();
		assert_eq!(nombre, "Carlos Ruiz");
	}
}
