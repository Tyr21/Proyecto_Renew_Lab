use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::{DbConn, load_settings_json};
use crate::error;

const METODOS_VALIDOS: &[&str] = &["Efectivo", "Tarjeta", "Transferencia"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngresoRow {
	pub id: String,
	pub cita_id: Option<String>,
	pub paciente_nombre: String,
	pub paciente_documento: String,
	pub concepto: String,
	pub monto: f64,
	pub metodo_pago: String,
	pub fecha_pago: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrearIngresoInput {
	pub cita_id: Option<String>,
	pub paciente_nombre: String,
	pub paciente_documento: String,
	pub concepto: String,
	pub monto: f64,
	pub metodo_pago: String,
}

fn row_to_ingreso(row: &rusqlite::Row<'_>) -> rusqlite::Result<IngresoRow> {
	Ok(IngresoRow {
		id: row.get(0)?,
		cita_id: row.get(1)?,
		paciente_nombre: row.get(2)?,
		paciente_documento: row.get(3)?,
		concepto: row.get(4)?,
		monto: row.get(5)?,
		metodo_pago: row.get(6)?,
		fecha_pago: row.get(7)?,
	})
}

fn load_ingreso_by_id(conn: &Connection, id: &str) -> Result<IngresoRow, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, cita_id, paciente_nombre, paciente_documento, concepto, monto, metodo_pago, fecha_pago
			FROM ingresos WHERE id = ?1
		"#,
		)
		.map_err(error::db)?;
	let row = stmt
		.query_row(params![id], row_to_ingreso)
		.map_err(error::db)?;
	Ok(row)
}

fn validate_metodo(m: &str) -> bool {
	METODOS_VALIDOS.iter().any(|&v| v == m)
}

/// Ingreso con datos de factura vinculada (si existe) para listados e impresión.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovimientoFinancieroDetalle {
	pub id: String,
	pub fecha_pago: String,
	pub paciente_nombre: String,
	pub paciente_documento: String,
	pub concepto: String,
	pub monto: f64,
	pub metodo_pago: String,
	pub factura_id: Option<String>,
	pub factura_serie: Option<String>,
	pub factura_numero: Option<i64>,
	pub factura_total: Option<f64>,
	/// Ingreso ligado a venta de paquete (`ingresos.paquete_id`); no es número de factura.
	pub paquete_id: Option<String>,
}

fn row_to_movimiento_detalle(row: &rusqlite::Row<'_>) -> rusqlite::Result<MovimientoFinancieroDetalle> {
	Ok(MovimientoFinancieroDetalle {
		id: row.get(0)?,
		fecha_pago: row.get(1)?,
		paciente_nombre: row.get(2)?,
		paciente_documento: row.get(3)?,
		concepto: row.get(4)?,
		monto: row.get(5)?,
		metodo_pago: row.get(6)?,
		factura_id: row.get(7)?,
		factura_serie: row.get(8)?,
		factura_numero: row.get(9)?,
		factura_total: row.get(10)?,
		paquete_id: row.get(11)?,
	})
}

#[tauri::command]
pub fn listar_movimientos_financieros_detalle(
	db: State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<MovimientoFinancieroDetalle>, String> {
	let conn = db.lock().map_err(error::lock)?;
	let mut stmt = conn
		.prepare(
			r#"
			SELECT i.id, i.fecha_pago, i.paciente_nombre, i.paciente_documento, i.concepto, i.monto, i.metodo_pago,
			       i.factura_id, f.serie, f.numero, f.total, i.paquete_id
			FROM ingresos i
			LEFT JOIN facturas f ON i.factura_id = f.id
			WHERE date(i.fecha_pago, 'localtime') >= ?1
			  AND date(i.fecha_pago, 'localtime') <= ?2
			ORDER BY i.fecha_pago DESC
		"#,
		)
		.map_err(error::db)?;
	let rows = stmt
		.query_map(params![&start_date, &end_date], row_to_movimiento_detalle)
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;
	Ok(rows)
}

#[tauri::command]
pub fn crear_ingreso(
	db: State<'_, DbConn>,
	input: CrearIngresoInput,
) -> Result<IngresoRow, String> {
	let conn = db.lock().map_err(error::lock)?;
	if input.paciente_nombre.trim().is_empty() {
		return Err("El nombre del paciente es obligatorio".into());
	}
	if input.paciente_documento.trim().is_empty() {
		return Err("El documento del paciente es obligatorio".into());
	}
	if input.concepto.trim().is_empty() {
		return Err("El concepto es obligatorio".into());
	}
	if input.monto <= 0.0 || !input.monto.is_finite() {
		return Err("El monto debe ser un número positivo".into());
	}
	if !validate_metodo(input.metodo_pago.trim()) {
		return Err("Método de pago inválido".into());
	}

	let id = Uuid::new_v4().to_string();
	let fecha_pago = Utc::now().to_rfc3339();
	let cita_id = input
		.cita_id
		.as_ref()
		.map(|s| s.trim())
		.filter(|s| !s.is_empty())
		.map(|s| s.to_string());

	conn.execute(
		r#"
		INSERT INTO ingresos (id, cita_id, paciente_nombre, paciente_documento, concepto, monto, metodo_pago, fecha_pago)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
	"#,
		params![
			id,
			cita_id,
			input.paciente_nombre.trim(),
			input.paciente_documento.trim(),
			input.concepto.trim(),
			input.monto,
			input.metodo_pago.trim(),
			fecha_pago,
		],
	)
	.map_err(error::db)?;

	load_ingreso_by_id(&conn, &id)
}

#[tauri::command]
pub fn obtener_ingresos(
	db: State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<IngresoRow>, String> {
	let conn = db.lock().map_err(error::lock)?;
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, cita_id, paciente_nombre, paciente_documento, concepto, monto, metodo_pago, fecha_pago
			FROM ingresos
			WHERE date(fecha_pago, 'localtime') >= ?1
			  AND date(fecha_pago, 'localtime') <= ?2
			ORDER BY fecha_pago DESC
		"#,
		)
		.map_err(error::db)?;
	let rows = stmt
		.query_map(params![&start_date, &end_date], row_to_ingreso)
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;
	Ok(rows)
}

#[tauri::command]
pub fn eliminar_ingreso(db: State<'_, DbConn>, id: String) -> Result<(), String> {
	let id = id.trim().to_string();
	if id.is_empty() {
		return Err("El id del ingreso es obligatorio".into());
	}
	let conn = db.lock().map_err(error::lock)?;
	let settings = load_settings_json(&conn)?;
	if !settings.admin_mode {
		return Err("Se requiere modo administrador para eliminar ingresos".into());
	}
	let exists: i64 = conn
		.query_row(
			"SELECT COUNT(*) FROM ingresos WHERE id = ?1",
			params![id],
			|row| row.get(0),
		)
		.map_err(error::db)?;
	if exists == 0 {
		return Err("Ingreso no encontrado".into());
	}
	conn.execute("DELETE FROM ingresos WHERE id = ?1", params![id])
		.map_err(error::db)?;
	Ok(())
}
