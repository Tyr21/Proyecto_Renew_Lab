use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::DbConn;

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

fn load_cliente_by_id(conn: &Connection, id: &str) -> Result<ClienteRow, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, nombres, apellidos, document_type, document_number,
			       phone_dial_code, phone_national_number, email,
			       birthday_month, notas, created_at, updated_at
			FROM clientes WHERE id = ?1
		"#,
		)
		.map_err(|e| e.to_string())?;
	stmt.query_row(params![id], row_to_cliente)
		.map_err(|e| e.to_string())
}

fn validate_input(input: &CrearClienteInput) -> Result<(), String> {
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

#[tauri::command]
pub fn crear_cliente(
	db: State<'_, DbConn>,
	input: CrearClienteInput,
) -> Result<ClienteRow, String> {
	validate_input(&input)?;
	let conn = db.lock().map_err(|e| e.to_string())?;
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
			input.nombres.trim(),
			input.apellidos.trim(),
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
		if e.to_string().contains("UNIQUE constraint failed") {
			format!(
				"Ya existe un cliente con el documento {}",
				input.document_number.trim()
			)
		} else {
			e.to_string()
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
	validate_input(&input)?;
	let id = id.trim().to_string();
	if id.is_empty() {
		return Err("El id del cliente es obligatorio".into());
	}
	let conn = db.lock().map_err(|e| e.to_string())?;
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
				input.nombres.trim(),
				input.apellidos.trim(),
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
			if e.to_string().contains("UNIQUE constraint failed") {
				format!(
					"Ya existe un cliente con el documento {}",
					input.document_number.trim()
				)
			} else {
				e.to_string()
			}
		})?;

	if rows_affected == 0 {
		return Err("Cliente no encontrado".into());
	}

	load_cliente_by_id(&conn, &id)
}

#[tauri::command]
pub fn buscar_clientes(
	db: State<'_, DbConn>,
	query: String,
) -> Result<Vec<ClienteRow>, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let q = format!("%{}%", query.trim());

	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, nombres, apellidos, document_type, document_number,
			       phone_dial_code, phone_national_number, email,
			       birthday_month, notas, created_at, updated_at
			FROM clientes
			WHERE nombres LIKE ?1
			   OR apellidos LIKE ?1
			   OR document_number LIKE ?1
			ORDER BY apellidos, nombres
			LIMIT 5
		"#,
		)
		.map_err(|e| e.to_string())?;

	let rows = stmt
		.query_map(params![q], row_to_cliente)
		.map_err(|e| e.to_string())?
		.collect::<Result<Vec<_>, _>>()
		.map_err(|e| e.to_string())?;

	Ok(rows)
}

#[tauri::command]
pub fn obtener_cliente(
	db: State<'_, DbConn>,
	id: String,
) -> Result<ClienteRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
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
	let conn = db.lock().map_err(|e| e.to_string())?;
	let rows_affected = conn
		.execute("DELETE FROM clientes WHERE id = ?1", params![id])
		.map_err(|e| e.to_string())?;
	if rows_affected == 0 {
		return Err("Cliente no encontrado".into());
	}
	Ok(())
}
