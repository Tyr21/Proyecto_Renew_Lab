use chrono::{Local, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::{DbConn, load_settings_json};
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

#[tauri::command]
pub fn crear_cliente(
	db: State<'_, DbConn>,
	input: CrearClienteInput,
) -> Result<ClienteRow, String> {
	validate_crear_cliente_input(&input)?;
	let nombres = format_nombre_propio(input.nombres.trim());
	let apellidos = format_nombre_propio(input.apellidos.trim());
	let conn = db.lock().map_err(error::lock)?;
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
				"Ya existe un cliente con el documento {}",
				input.document_number.trim()
			)
		} else {
			error::db(e)
		}
	})?;

	load_cliente_by_id(&conn, &id)
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
					"Ya existe un cliente con el documento {}",
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

#[tauri::command]
pub fn buscar_clientes(
	db: State<'_, DbConn>,
	query: String,
) -> Result<Vec<ClienteRow>, String> {
	let conn = db.lock().map_err(error::lock)?;
	let escaped = query.trim().replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
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
pub fn obtener_cliente(
	db: State<'_, DbConn>,
	id: String,
) -> Result<ClienteRow, String> {
	let conn = db.lock().map_err(error::lock)?;
	load_cliente_by_id(&conn, id.trim())
}

#[tauri::command]
pub fn eliminar_cliente(
	db: State<'_, DbConn>,
	id: String,
) -> Result<(), String> {
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
