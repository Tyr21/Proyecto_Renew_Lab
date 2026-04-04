use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::commands::DbConn;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventoRow {
	pub id: String,
	pub titulo: String,
	pub descripcion: String,
	pub fecha: String,
	pub todo_el_dia: bool,
	pub hora_inicio: Option<String>,
	pub hora_fin: Option<String>,
	pub color: String,
	pub created_at: String,
	pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventoInput {
	pub titulo: String,
	pub descripcion: Option<String>,
	pub fecha: String,
	pub todo_el_dia: bool,
	pub hora_inicio: Option<String>,
	pub hora_fin: Option<String>,
	pub color: Option<String>,
}

fn row_to_evento(row: &rusqlite::Row<'_>) -> rusqlite::Result<EventoRow> {
	let todo_el_dia_int: i64 = row.get(4)?;
	Ok(EventoRow {
		id: row.get(0)?,
		titulo: row.get(1)?,
		descripcion: row.get(2)?,
		fecha: row.get(3)?,
		todo_el_dia: todo_el_dia_int != 0,
		hora_inicio: row.get(5)?,
		hora_fin: row.get(6)?,
		color: row.get(7)?,
		created_at: row.get(8)?,
		updated_at: row.get(9)?,
	})
}

fn validate_evento(input: &EventoInput) -> Result<(), String> {
	if input.titulo.trim().is_empty() {
		return Err("El título del evento es obligatorio".into());
	}
	if input.fecha.trim().is_empty() {
		return Err("La fecha del evento es obligatoria".into());
	}
	if !input.todo_el_dia {
		let start = input.hora_inicio.as_deref().unwrap_or("");
		let end = input.hora_fin.as_deref().unwrap_or("");
		if start.is_empty() || end.is_empty() {
			return Err("Los eventos con hora específica requieren hora de inicio y fin".into());
		}
		if end <= start {
			return Err("La hora de fin debe ser posterior a la hora de inicio".into());
		}
	}
	Ok(())
}

#[tauri::command]
pub fn listar_eventos_rango(
	db: tauri::State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<EventoRow>, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, titulo, descripcion, fecha, todo_el_dia,
				hora_inicio, hora_fin, color, created_at, updated_at
			FROM eventos
			WHERE fecha >= ?1 AND fecha <= ?2
			ORDER BY fecha, todo_el_dia DESC, hora_inicio
		"#,
		)
		.map_err(|e| e.to_string())?;
	let rows = stmt
		.query_map(params![start_date, end_date], row_to_evento)
		.map_err(|e| e.to_string())?
		.collect::<Result<Vec<_>, _>>()
		.map_err(|e| e.to_string())?;
	Ok(rows)
}

#[tauri::command]
pub fn crear_evento(
	db: tauri::State<'_, DbConn>,
	input: EventoInput,
) -> Result<EventoRow, String> {
	validate_evento(&input)?;
	let conn = db.lock().map_err(|e| e.to_string())?;
	let id = Uuid::new_v4().to_string();
	let now = Utc::now().to_rfc3339();
	let color = input.color.as_deref().unwrap_or("amber");
	let descripcion = input.descripcion.as_deref().unwrap_or("");
	let (hora_inicio, hora_fin) = if input.todo_el_dia {
		(None, None)
	} else {
		(input.hora_inicio.clone(), input.hora_fin.clone())
	};

	conn.execute(
		r#"
		INSERT INTO eventos (id, titulo, descripcion, fecha, todo_el_dia,
			hora_inicio, hora_fin, color, created_at, updated_at)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
	"#,
		params![
			id,
			input.titulo.trim(),
			descripcion.trim(),
			input.fecha,
			input.todo_el_dia as i64,
			hora_inicio,
			hora_fin,
			color,
			now,
			now,
		],
	)
	.map_err(|e| e.to_string())?;

	load_evento_by_id(&conn, &id)
}

#[tauri::command]
pub fn actualizar_evento(
	db: tauri::State<'_, DbConn>,
	id: String,
	input: EventoInput,
) -> Result<EventoRow, String> {
	validate_evento(&input)?;
	let conn = db.lock().map_err(|e| e.to_string())?;

	let exists: bool = conn
		.query_row(
			"SELECT EXISTS(SELECT 1 FROM eventos WHERE id = ?1)",
			params![id],
			|row| row.get::<_, i64>(0),
		)
		.map_err(|e| e.to_string())?
		!= 0;
	if !exists {
		return Err("Evento no encontrado".into());
	}

	let now = Utc::now().to_rfc3339();
	let color = input.color.as_deref().unwrap_or("amber");
	let descripcion = input.descripcion.as_deref().unwrap_or("");
	let (hora_inicio, hora_fin) = if input.todo_el_dia {
		(None, None)
	} else {
		(input.hora_inicio.clone(), input.hora_fin.clone())
	};

	conn.execute(
		r#"
		UPDATE eventos SET
			titulo = ?1, descripcion = ?2, fecha = ?3, todo_el_dia = ?4,
			hora_inicio = ?5, hora_fin = ?6, color = ?7, updated_at = ?8
		WHERE id = ?9
	"#,
		params![
			input.titulo.trim(),
			descripcion.trim(),
			input.fecha,
			input.todo_el_dia as i64,
			hora_inicio,
			hora_fin,
			color,
			now,
			id,
		],
	)
	.map_err(|e| e.to_string())?;

	load_evento_by_id(&conn, &id)
}

#[tauri::command]
pub fn eliminar_evento(
	db: tauri::State<'_, DbConn>,
	id: String,
) -> Result<(), String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let affected = conn
		.execute("DELETE FROM eventos WHERE id = ?1", params![id])
		.map_err(|e| e.to_string())?;
	if affected == 0 {
		return Err("Evento no encontrado".into());
	}
	Ok(())
}

fn load_evento_by_id(conn: &rusqlite::Connection, id: &str) -> Result<EventoRow, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, titulo, descripcion, fecha, todo_el_dia,
				hora_inicio, hora_fin, color, created_at, updated_at
			FROM eventos WHERE id = ?1
		"#,
		)
		.map_err(|e| e.to_string())?;
	stmt.query_row(params![id], row_to_evento)
		.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
	use super::*;

	fn open_test_conn() -> rusqlite::Connection {
		crate::db::open_in_memory_test_database().unwrap()
	}

	fn insert_evento(conn: &rusqlite::Connection, input: &EventoInput) -> EventoRow {
		let id = Uuid::new_v4().to_string();
		let now = Utc::now().to_rfc3339();
		let color = input.color.as_deref().unwrap_or("amber");
		let desc = input.descripcion.as_deref().unwrap_or("");
		let (hi, hf) = if input.todo_el_dia {
			(None, None)
		} else {
			(input.hora_inicio.clone(), input.hora_fin.clone())
		};
		conn.execute(
			r#"INSERT INTO eventos (id, titulo, descripcion, fecha, todo_el_dia,
				hora_inicio, hora_fin, color, created_at, updated_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#,
			params![id, input.titulo.trim(), desc.trim(), input.fecha,
				input.todo_el_dia as i64, hi, hf, color, now, now],
		)
		.unwrap();
		load_evento_by_id(conn, &id).unwrap()
	}

	#[test]
	fn create_all_day_event() {
		let conn = open_test_conn();
		let ev = insert_evento(
			&conn,
			&EventoInput {
				titulo: "Mantenimiento cámaras".into(),
				descripcion: Some("Revisión trimestral".into()),
				fecha: "2099-03-15".into(),
				todo_el_dia: true,
				hora_inicio: None,
				hora_fin: None,
				color: Some("amber".into()),
			},
		);
		assert!(ev.todo_el_dia);
		assert!(ev.hora_inicio.is_none());
		assert_eq!(ev.titulo, "Mantenimiento cámaras");
	}

	#[test]
	fn create_timed_event() {
		let conn = open_test_conn();
		let ev = insert_evento(
			&conn,
			&EventoInput {
				titulo: "Revisión equipos".into(),
				descripcion: None,
				fecha: "2099-06-01".into(),
				todo_el_dia: false,
				hora_inicio: Some("10:00".into()),
				hora_fin: Some("11:30".into()),
				color: Some("rose".into()),
			},
		);
		assert!(!ev.todo_el_dia);
		assert_eq!(ev.hora_inicio.as_deref(), Some("10:00"));
		assert_eq!(ev.hora_fin.as_deref(), Some("11:30"));
	}

	#[test]
	fn validate_rejects_empty_title() {
		let err = validate_evento(&EventoInput {
			titulo: "  ".into(),
			descripcion: None,
			fecha: "2099-01-01".into(),
			todo_el_dia: true,
			hora_inicio: None,
			hora_fin: None,
			color: None,
		})
		.unwrap_err();
		assert!(err.contains("título"));
	}

	#[test]
	fn validate_rejects_timed_without_hours() {
		let err = validate_evento(&EventoInput {
			titulo: "Test".into(),
			descripcion: None,
			fecha: "2099-01-01".into(),
			todo_el_dia: false,
			hora_inicio: None,
			hora_fin: None,
			color: None,
		})
		.unwrap_err();
		assert!(err.contains("hora"));
	}

	#[test]
	fn list_range_filters_correctly() {
		let conn = open_test_conn();
		insert_evento(
			&conn,
			&EventoInput {
				titulo: "Dentro".into(),
				descripcion: None,
				fecha: "2099-05-10".into(),
				todo_el_dia: true,
				hora_inicio: None,
				hora_fin: None,
				color: None,
			},
		);
		insert_evento(
			&conn,
			&EventoInput {
				titulo: "Fuera".into(),
				descripcion: None,
				fecha: "2099-06-15".into(),
				todo_el_dia: true,
				hora_inicio: None,
				hora_fin: None,
				color: None,
			},
		);

		let mut stmt = conn
			.prepare(
				r#"SELECT id, titulo, descripcion, fecha, todo_el_dia,
					hora_inicio, hora_fin, color, created_at, updated_at
				FROM eventos WHERE fecha >= ?1 AND fecha <= ?2
				ORDER BY fecha"#,
			)
			.unwrap();
		let rows: Vec<EventoRow> = stmt
			.query_map(params!["2099-05-01", "2099-05-31"], row_to_evento)
			.unwrap()
			.collect::<Result<Vec<_>, _>>()
			.unwrap();
		assert_eq!(rows.len(), 1);
		assert_eq!(rows[0].titulo, "Dentro");
	}
}
