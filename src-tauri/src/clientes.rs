use chrono::{Local, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::{load_settings_json, DbConn};
use crate::error;

/// Servicios completados recientes en el resumen (solo lectura).
const CLIENTE_RESUMEN_ULTIMOS_SERVICIOS_LIMITE: i64 = 15;
/// Próximas citas en el resumen del cliente.
const CLIENTE_RESUMEN_PROXIMAS_CITAS_LIMITE: i64 = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClienteRow {
	pub id: String,
	pub nombres: String,
	pub apellidos: String,
	pub document_type: String,
	pub document_number: String,
	pub phone_dial_code: String,
	pub phone_national_number: String,
	pub email: String,
	pub birthday_month: Option<i64>,
	pub notas: String,
	pub created_at: String,
	pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CitaResumenClienteRow {
	pub id: String,
	pub appointment_date: String,
	pub start_time: String,
	pub end_time: String,
	pub service_type: String,
	pub status: String,
	pub is_paid: bool,
	pub paquete_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClienteResumenDashboard {
	pub cliente: ClienteRow,
	pub ultimos_servicios: Vec<CitaResumenClienteRow>,
	pub proximas_citas: Vec<CitaResumenClienteRow>,
}

/// Prefijo en mensajes de error cuando hay homonimia; la UI puede pedir confirmación y reintentar con `confirm_duplicate_full_name`.
pub(crate) const CONFIRM_DUPLICATE_FULL_NAME_PREFIX: &str = "[CONFIRM_DUPLICATE_FULL_NAME] ";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrearClienteInput {
	pub nombres: String,
	pub apellidos: String,
	pub document_type: String,
	pub document_number: String,
	pub phone_dial_code: String,
	pub phone_national_number: String,
	pub email: String,
	pub birthday_month: Option<i64>,
	pub notas: String,
	#[serde(default)]
	pub confirm_duplicate_full_name: bool,
}

fn row_to_cliente(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClienteRow> {
	Ok(ClienteRow {
		id: row.get(0)?,
		nombres: row.get(1)?,
		apellidos: row.get(2)?,
		document_type: row.get(3)?,
		document_number: row.get(4)?,
		phone_dial_code: row.get(5)?,
		phone_national_number: row.get(6)?,
		email: row.get(7)?,
		birthday_month: row.get(8)?,
		notas: row.get(9)?,
		created_at: row.get(10)?,
		updated_at: row.get(11)?,
	})
}

pub(crate) fn load_cliente_by_id(conn: &Connection, id: &str) -> Result<ClienteRow, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, nombres, apellidos, document_type, document_number,
			       phone_dial_code, phone_national_number, email,
			       birthday_month, notas, created_at, updated_at
			FROM clientes WHERE id = ?1
		"#,
		)
		.map_err(error::db)?;
	stmt.query_row(params![id], row_to_cliente)
		.map_err(error::db)
}

pub(crate) fn validate_crear_cliente_input(input: &CrearClienteInput) -> Result<(), String> {
	if input.nombres.trim().is_empty() {
		return Err("El nombre es obligatorio".into());
	}
	if input.apellidos.trim().is_empty() {
		return Err("Los apellidos son obligatorios".into());
	}
	if input.document_type.trim().is_empty() {
		return Err("El tipo de documento es obligatorio".into());
	}
	if input.document_number.trim().is_empty() {
		return Err("El número de documento es obligatorio".into());
	}
	Ok(())
}

fn title_case_segment(segment: &str) -> String {
	if segment.is_empty() {
		return String::new();
	}
	let mut chars = segment.chars();
	// unwrap: segment no vacío ⇒ hay al menos un carácter
	let first = chars.next().unwrap();
	let rest: String = chars.as_str().to_lowercase();
	format!("{}{}", first.to_uppercase(), rest)
}

/// Primera letra de cada palabra (y de cada parte tras guion) en mayúscula; el resto en minúsculas.
pub(crate) fn format_nombre_propio(s: &str) -> String {
	s.split_whitespace()
		.filter(|w| !w.is_empty())
		.map(|w| {
			w.split('-')
				.map(title_case_segment)
				.collect::<Vec<_>>()
				.join("-")
		})
		.collect::<Vec<_>>()
		.join(" ")
}

/// Otro cliente (distinto `excluir_id` si se informa) con los mismos nombres y apellidos ya normalizados en BD.
pub(crate) fn encontrar_otro_cliente_mismo_nombre_apellidos(
	conn: &Connection,
	nombres_fmt: &str,
	apellidos_fmt: &str,
	excluir_id: Option<&str>,
) -> Result<Option<ClienteRow>, String> {
	if nombres_fmt.trim().is_empty() || apellidos_fmt.trim().is_empty() {
		return Ok(None);
	}
	let dup_nombre: Option<ClienteRow> = if let Some(ex) = excluir_id {
		let mut stmt = conn
			.prepare(
				r#"
				SELECT id, nombres, apellidos, document_type, document_number,
				       phone_dial_code, phone_national_number, email,
				       birthday_month, notas, created_at, updated_at
				FROM clientes
				WHERE TRIM(nombres) = TRIM(?1) AND TRIM(apellidos) = TRIM(?2)
				  AND TRIM(id) != TRIM(?3)
				LIMIT 1
			"#,
			)
			.map_err(error::db)?;
		stmt
			.query_row(params![nombres_fmt, apellidos_fmt, ex], row_to_cliente)
			.optional()
			.map_err(error::db)?
	} else {
		let mut stmt = conn
			.prepare(
				r#"
				SELECT id, nombres, apellidos, document_type, document_number,
				       phone_dial_code, phone_national_number, email,
				       birthday_month, notas, created_at, updated_at
				FROM clientes
				WHERE TRIM(nombres) = TRIM(?1) AND TRIM(apellidos) = TRIM(?2)
				LIMIT 1
			"#,
			)
			.map_err(error::db)?;
		stmt
			.query_row(params![nombres_fmt, apellidos_fmt], row_to_cliente)
			.optional()
			.map_err(error::db)?
	};
	Ok(dup_nombre)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClienteHomonimiaAdvertencia {
	pub id: String,
	pub nombres: String,
	pub apellidos: String,
	pub document_type: String,
	pub document_number: String,
}

/// Para avisos en UI mientras se escribe (misma lógica que al guardar).
#[tauri::command]
pub fn advertencia_homonimia_cliente(
	db: State<'_, DbConn>,
	nombres: String,
	apellidos: String,
	excluir_cliente_id: Option<String>,
) -> Result<Option<ClienteHomonimiaAdvertencia>, String> {
	let nombres_fmt = format_nombre_propio(nombres.trim());
	let apellidos_fmt = format_nombre_propio(apellidos.trim());
	if nombres_fmt.is_empty() || apellidos_fmt.is_empty() {
		return Ok(None);
	}
	let conn = db.lock().map_err(error::lock)?;
	let ex = excluir_cliente_id
		.as_deref()
		.map(str::trim)
		.filter(|s| !s.is_empty());
	let row = encontrar_otro_cliente_mismo_nombre_apellidos(&conn, &nombres_fmt, &apellidos_fmt, ex)?;
	Ok(row.map(|r| ClienteHomonimiaAdvertencia {
		id: r.id,
		nombres: r.nombres,
		apellidos: r.apellidos,
		document_type: r.document_type,
		document_number: r.document_number,
	}))
}

/// Comprueba otro registro con el mismo documento o el mismo nombre y apellidos (tras normalizar como al guardar).
pub(crate) fn validar_duplicados_al_guardar_cliente(
	conn: &Connection,
	input: &CrearClienteInput,
	nombres_fmt: &str,
	apellidos_fmt: &str,
	excluir_id: Option<&str>,
) -> Result<(), String> {
	let doc = input.document_number.trim();
	let dup_doc: Option<ClienteRow> = if let Some(ex) = excluir_id {
		let mut stmt = conn
			.prepare(
				r#"
				SELECT id, nombres, apellidos, document_type, document_number,
				       phone_dial_code, phone_national_number, email,
				       birthday_month, notas, created_at, updated_at
				FROM clientes
				WHERE TRIM(document_number) = TRIM(?1) AND TRIM(id) != TRIM(?2)
				LIMIT 1
			"#,
			)
			.map_err(error::db)?;
		stmt
			.query_row(params![doc, ex], row_to_cliente)
			.optional()
			.map_err(error::db)?
	} else {
		let mut stmt = conn
			.prepare(
				r#"
				SELECT id, nombres, apellidos, document_type, document_number,
				       phone_dial_code, phone_national_number, email,
				       birthday_month, notas, created_at, updated_at
				FROM clientes
				WHERE TRIM(document_number) = TRIM(?1)
				LIMIT 1
			"#,
			)
			.map_err(error::db)?;
		stmt
			.query_row(params![doc], row_to_cliente)
			.optional()
			.map_err(error::db)?
	};
	if dup_doc.is_some() {
		return Err(format!(
			"Ya existe un cliente con el número de documento {}.",
			doc
		));
	}

	if !input.confirm_duplicate_full_name {
		if let Some(other) =
			encontrar_otro_cliente_mismo_nombre_apellidos(conn, nombres_fmt, apellidos_fmt, excluir_id)?
		{
			let detalle = format!(
				"Ya existe otro cliente con el mismo nombre y apellidos ({} {}), con documento {} {}. Dos personas con el mismo nombre completo son poco frecuentes: compruebe que no esté registrando otra vez a la misma persona con un documento distinto por error. Si son dos personas distintas (homónimos), confirme para continuar.",
				other.nombres.trim(),
				other.apellidos.trim(),
				other.document_type.trim(),
				other.document_number.trim()
			);
			return Err(format!(
				"{}{}",
				CONFIRM_DUPLICATE_FULL_NAME_PREFIX, detalle
			));
		}
	}
	Ok(())
}

/// Inserta un cliente en una conexión ya abierta (misma lógica que el comando `crear_cliente`).
pub(crate) fn crear_cliente_en_conn(conn: &Connection, input: CrearClienteInput) -> Result<ClienteRow, String> {
	validate_crear_cliente_input(&input)?;
	let nombres = format_nombre_propio(input.nombres.trim());
	let apellidos = format_nombre_propio(input.apellidos.trim());
	validar_duplicados_al_guardar_cliente(conn, &input, &nombres, &apellidos, None)?;
	let id = Uuid::new_v4().to_string();
	let now = Utc::now().to_rfc3339();

	conn.execute(
		r#"
		INSERT INTO clientes (
			id, nombres, apellidos, document_type, document_number,
			phone_dial_code, phone_national_number, email,
			birthday_month, notas, created_at, updated_at
		) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
	"#,
		params![
			id,
			nombres,
			apellidos,
			input.document_type.trim(),
			input.document_number.trim(),
			input.phone_dial_code.trim(),
			input.phone_national_number.trim(),
			input.email.trim(),
			input.birthday_month,
			input.notas.trim(),
			now,
			now,
		],
	)
	.map_err(|e| {
		let msg = e.to_string();
		if msg.contains("UNIQUE constraint failed") {
			format!(
				"Ya existe un cliente con el número de documento {}.",
				input.document_number.trim()
			)
		} else {
			error::db(e)
		}
	})?;

	load_cliente_by_id(conn, &id)
}

#[tauri::command]
pub fn crear_cliente(
	db: State<'_, DbConn>,
	input: CrearClienteInput,
) -> Result<ClienteRow, String> {
	let conn = db.lock().map_err(error::lock)?;
	crear_cliente_en_conn(&conn, input)
}

#[tauri::command]
pub fn actualizar_cliente(
	db: State<'_, DbConn>,
	id: String,
	input: CrearClienteInput,
) -> Result<ClienteRow, String> {
	validate_crear_cliente_input(&input)?;
	let nombres = format_nombre_propio(input.nombres.trim());
	let apellidos = format_nombre_propio(input.apellidos.trim());
	let id = id.trim().to_string();
	if id.is_empty() {
		return Err("El id del cliente es obligatorio".into());
	}
	let conn = db.lock().map_err(error::lock)?;
	validar_duplicados_al_guardar_cliente(&conn, &input, &nombres, &apellidos, Some(&id))?;
	let now = Utc::now().to_rfc3339();

	let rows_affected = conn
		.execute(
			r#"
			UPDATE clientes SET
				nombres = ?2,
				apellidos = ?3,
				document_type = ?4,
				document_number = ?5,
				phone_dial_code = ?6,
				phone_national_number = ?7,
				email = ?8,
				birthday_month = ?9,
				notas = ?10,
				updated_at = ?11
			WHERE id = ?1
		"#,
			params![
				id,
				nombres,
				apellidos,
				input.document_type.trim(),
				input.document_number.trim(),
				input.phone_dial_code.trim(),
				input.phone_national_number.trim(),
				input.email.trim(),
				input.birthday_month,
				input.notas.trim(),
				now,
			],
		)
		.map_err(|e| {
			let msg = e.to_string();
			if msg.contains("UNIQUE constraint failed") {
				format!(
					"Ya existe un cliente con el número de documento {}.",
					input.document_number.trim()
				)
			} else {
				error::db(e)
			}
		})?;

	if rows_affected == 0 {
		return Err("Cliente no encontrado".into());
	}

	load_cliente_by_id(&conn, &id)
}

#[cfg(test)]
mod format_tests {
	use super::format_nombre_propio;

	#[test]
	fn nombre_propio_basico() {
		assert_eq!(format_nombre_propio("JUAN carlos"), "Juan Carlos");
		assert_eq!(format_nombre_propio("maría"), "María");
	}

	#[test]
	fn nombre_propio_guion() {
		assert_eq!(format_nombre_propio("MARÍA-josé"), "María-José");
	}

	#[test]
	fn marcador_apellido_unico() {
		assert_eq!(format_nombre_propio("."), ".");
	}
}

#[cfg(test)]
mod document_exact_lookup_tests {
	use rusqlite::Connection;

	use super::load_cliente_por_documento_exacto;

	fn setup_schema(conn: &Connection) {
		conn.execute_batch(
			r#"
			CREATE TABLE clientes (
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
			CREATE UNIQUE INDEX idx_clientes_document ON clientes(document_number);
		"#,
		)
		.unwrap();
	}

	#[test]
	fn encuentra_por_documento_exacto() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		conn.execute(
			r#"INSERT INTO clientes VALUES ('id1','Ana','López','CC','12345','','','',NULL,'','now','now')"#,
			[],
		)
		.unwrap();
		let c = load_cliente_por_documento_exacto(&conn, "CC", "12345")
			.unwrap()
			.unwrap();
		assert_eq!(c.id, "id1");
		assert_eq!(c.document_number, "12345");
	}

	#[test]
	fn respeta_trim() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		conn.execute(
			r#"INSERT INTO clientes VALUES ('id1','Ana','López',' CC ',' 99 ','','','',NULL,'','now','now')"#,
			[],
		)
		.unwrap();
		let c = load_cliente_por_documento_exacto(&conn, "CC", "99").unwrap().unwrap();
		assert_eq!(c.id, "id1");
	}

	#[test]
	fn numero_vacio_devuelve_none() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		let r = load_cliente_por_documento_exacto(&conn, "CC", "   ").unwrap();
		assert!(r.is_none());
	}

	#[test]
	fn sin_coincidencia_devuelve_none() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		conn.execute(
			r#"INSERT INTO clientes VALUES ('id1','Ana','López','CC','1','','','',NULL,'','now','now')"#,
			[],
		)
		.unwrap();
		let r = load_cliente_por_documento_exacto(&conn, "CC", "2").unwrap();
		assert!(r.is_none());
	}
}

#[cfg(test)]
mod duplicate_validation_tests {
	use rusqlite::Connection;

	use super::{
		format_nombre_propio, validar_duplicados_al_guardar_cliente, CrearClienteInput,
		CONFIRM_DUPLICATE_FULL_NAME_PREFIX,
	};

	fn setup_schema(conn: &Connection) {
		conn.execute_batch(
			r#"
			CREATE TABLE clientes (
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
			CREATE UNIQUE INDEX idx_clientes_document ON clientes(document_number);
		"#,
		)
		.unwrap();
	}

	fn input(doc: &str, nombres: &str, apellidos: &str, confirm_name: bool) -> CrearClienteInput {
		CrearClienteInput {
			nombres: nombres.into(),
			apellidos: apellidos.into(),
			document_type: "CC".into(),
			document_number: doc.into(),
			phone_dial_code: "+57".into(),
			phone_national_number: "".into(),
			email: "".into(),
			birthday_month: None,
			notas: "".into(),
			confirm_duplicate_full_name: confirm_name,
		}
	}

	#[test]
	fn rechaza_documento_duplicado_al_crear() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		conn.execute(
			r#"INSERT INTO clientes VALUES ('a','Juan','Pérez','CC','1','','','',NULL,'','now','now')"#,
			[],
		)
		.unwrap();
		let n = format_nombre_propio("PEDRO");
		let a = format_nombre_propio("GARCÍA");
		let r = validar_duplicados_al_guardar_cliente(&conn, &input("1", "PEDRO", "GARCÍA", false), &n, &a, None);
		assert!(r.is_err());
		assert!(r.unwrap_err().contains("número de documento"));
	}

	#[test]
	fn nombre_duplicado_devuelve_prefijo_confirmacion() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		conn.execute(
			r#"INSERT INTO clientes VALUES ('a','Juan','Pérez','CC','99','','','',NULL,'','now','now')"#,
			[],
		)
		.unwrap();
		let n = format_nombre_propio("JUAN");
		let a = format_nombre_propio("PÉREZ");
		let err = validar_duplicados_al_guardar_cliente(
			&conn,
			&input("100", "JUAN", "PÉREZ", false),
			&n,
			&a,
			None,
		)
		.unwrap_err();
		assert!(err.starts_with(CONFIRM_DUPLICATE_FULL_NAME_PREFIX));
	}

	#[test]
	fn permite_nombre_duplicado_si_confirma() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		conn.execute(
			r#"INSERT INTO clientes VALUES ('a','Juan','Pérez','CC','99','','','',NULL,'','now','now')"#,
			[],
		)
		.unwrap();
		let n = format_nombre_propio("JUAN");
		let a = format_nombre_propio("PÉREZ");
		validar_duplicados_al_guardar_cliente(
			&conn,
			&input("100", "JUAN", "PÉREZ", true),
			&n,
			&a,
			None,
		)
		.unwrap();
	}

	#[test]
	fn actualizar_misma_fila_no_es_duplicado() {
		let conn = Connection::open_in_memory().unwrap();
		setup_schema(&conn);
		conn.execute(
			r#"INSERT INTO clientes VALUES ('x','Juan','Pérez','CC','7','','','',NULL,'','now','now')"#,
			[],
		)
		.unwrap();
		let n = format_nombre_propio("JUAN");
		let a = format_nombre_propio("PÉREZ");
		validar_duplicados_al_guardar_cliente(&conn, &input("7", "JUAN", "PÉREZ", false), &n, &a, Some("x")).unwrap();
	}
}

#[tauri::command]
pub fn buscar_clientes(db: State<'_, DbConn>, query: String) -> Result<Vec<ClienteRow>, String> {
	let conn = db.lock().map_err(error::lock)?;
	let escaped = query
		.trim()
		.replace('\\', "\\\\")
		.replace('%', "\\%")
		.replace('_', "\\_");
	let q = format!("%{escaped}%");

	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, nombres, apellidos, document_type, document_number,
			       phone_dial_code, phone_national_number, email,
			       birthday_month, notas, created_at, updated_at
			FROM clientes
			WHERE nombres LIKE ?1 ESCAPE '\'
			   OR apellidos LIKE ?1 ESCAPE '\'
			   OR document_number LIKE ?1 ESCAPE '\'
			ORDER BY nombres, apellidos
			LIMIT 5
		"#,
		)
		.map_err(error::db)?;

	let rows = stmt
		.query_map(params![q], row_to_cliente)
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	Ok(rows)
}

/// Coincidencia exacta tipo + número (misma lógica que el cruce citas ↔ ficha en `obtener_resumen_cliente_dashboard`).
pub(crate) fn load_cliente_por_documento_exacto(
	conn: &Connection,
	document_type: &str,
	document_number: &str,
) -> Result<Option<ClienteRow>, String> {
	let dt = document_type.trim();
	let dn = document_number.trim();
	if dn.is_empty() {
		return Ok(None);
	}
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, nombres, apellidos, document_type, document_number,
			       phone_dial_code, phone_national_number, email,
			       birthday_month, notas, created_at, updated_at
			FROM clientes
			WHERE TRIM(document_type) = TRIM(?1)
			  AND TRIM(document_number) = TRIM(?2)
			LIMIT 1
		"#,
		)
		.map_err(error::db)?;

	stmt
		.query_row(params![dt, dn], row_to_cliente)
		.optional()
		.map_err(error::db)
}

#[tauri::command]
pub fn buscar_cliente_por_documento_exacto(
	db: State<'_, DbConn>,
	document_type: String,
	document_number: String,
) -> Result<Option<ClienteRow>, String> {
	let conn = db.lock().map_err(error::lock)?;
	load_cliente_por_documento_exacto(&conn, &document_type, &document_number)
}

fn row_to_cita_resumen(row: &rusqlite::Row<'_>) -> rusqlite::Result<CitaResumenClienteRow> {
	let paid_int: i64 = row.get(6)?;
	let paquete_raw: Option<String> = row.get(7)?;
	let paquete_id = paquete_raw.and_then(|s| {
		let t = s.trim().to_string();
		if t.is_empty() {
			None
		} else {
			Some(t)
		}
	});
	Ok(CitaResumenClienteRow {
		id: row.get(0)?,
		appointment_date: row.get(1)?,
		start_time: row.get(2)?,
		end_time: row.get(3)?,
		service_type: row.get(4)?,
		status: row.get(5)?,
		is_paid: paid_int != 0,
		paquete_id,
	})
}

/// Ficha ampliada: datos del cliente, últimos servicios realizados y próximas citas (mismo documento que la ficha).
#[tauri::command]
pub fn obtener_resumen_cliente_dashboard(
	db: State<'_, DbConn>,
	cliente_id: String,
) -> Result<ClienteResumenDashboard, String> {
	let id = cliente_id.trim();
	if id.is_empty() {
		return Err("El id del cliente es obligatorio".into());
	}
	let conn = db.lock().map_err(error::lock)?;
	let cliente = load_cliente_by_id(&conn, id)?;
	let doc_type = cliente.document_type.trim();
	let doc_num = cliente.document_number.trim();

	let today = Local::now().format("%Y-%m-%d").to_string();
	let now_time = Local::now().format("%H:%M").to_string();

	let mut stmt = conn
		.prepare(
			r#"
			SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.service_type, a.status,
				EXISTS(SELECT 1 FROM ingresos i WHERE i.cita_id = a.id) AS is_paid,
				a.paquete_id
			FROM appointments a
			WHERE TRIM(a.document_type) = ?1
			  AND TRIM(a.document_number) = ?2
			  AND a.status = 'asistio'
			  AND (
				a.appointment_date < ?3
				OR (a.appointment_date = ?3 AND a.start_time < ?4)
			  )
			ORDER BY a.appointment_date DESC, a.start_time DESC
			LIMIT ?5
		"#,
		)
		.map_err(error::db)?;
	let ultimos_servicios = stmt
		.query_map(
			params![
				doc_type,
				doc_num,
				today,
				now_time,
				CLIENTE_RESUMEN_ULTIMOS_SERVICIOS_LIMITE
			],
			row_to_cita_resumen,
		)
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	let mut stmt2 = conn
		.prepare(
			r#"
			SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.service_type, a.status,
				EXISTS(SELECT 1 FROM ingresos i WHERE i.cita_id = a.id) AS is_paid,
				a.paquete_id
			FROM appointments a
			WHERE TRIM(a.document_type) = ?1
			  AND TRIM(a.document_number) = ?2
			  AND (
				a.appointment_date > ?3
				OR (a.appointment_date = ?3 AND a.start_time >= ?4)
			  )
			ORDER BY a.appointment_date ASC, a.start_time ASC
			LIMIT ?5
		"#,
		)
		.map_err(error::db)?;
	let proximas_citas = stmt2
		.query_map(
			params![
				doc_type,
				doc_num,
				today,
				now_time,
				CLIENTE_RESUMEN_PROXIMAS_CITAS_LIMITE
			],
			row_to_cita_resumen,
		)
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	Ok(ClienteResumenDashboard {
		cliente,
		ultimos_servicios,
		proximas_citas,
	})
}

#[tauri::command]
pub fn obtener_cliente(db: State<'_, DbConn>, id: String) -> Result<ClienteRow, String> {
	let conn = db.lock().map_err(error::lock)?;
	load_cliente_by_id(&conn, id.trim())
}

#[tauri::command]
pub fn eliminar_cliente(db: State<'_, DbConn>, id: String) -> Result<(), String> {
	let id = id.trim().to_string();
	if id.is_empty() {
		return Err("El id del cliente es obligatorio".into());
	}
	let conn = db.lock().map_err(error::lock)?;
	let settings = load_settings_json(&conn)?;
	if !settings.admin_mode {
		return Err("Se requiere modo administrador para eliminar clientes".into());
	}
	let rows_affected = conn
		.execute("DELETE FROM clientes WHERE id = ?1", params![id])
		.map_err(error::db)?;
	if rows_affected == 0 {
		return Err("Cliente no encontrado".into());
	}
	Ok(())
}
