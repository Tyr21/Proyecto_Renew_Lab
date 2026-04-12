use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::DbConn;
use crate::error;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CitasPorMes {
	pub mes: String,
	pub total_citas: i64,
	pub asistieron: i64,
	pub no_asistieron: i64,
	pub porcentaje_asistencia: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngresosPorMes {
	pub mes: String,
	pub monto_total: f64,
	pub cantidad_transacciones: i64,
	pub monto_promedio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServicioStats {
	pub service_type: String,
	pub total_citas: i64,
	pub asistieron: i64,
	pub porcentaje_asistencia: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetodoPagoStats {
	pub metodo_pago: String,
	pub monto_total: f64,
	pub cantidad_transacciones: i64,
	pub porcentaje_del_total: f64,
}

#[tauri::command]
pub fn estadisticas_citas_por_mes(
	db: State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<CitasPorMes>, String> {
	let conn = db.lock().map_err(error::lock)?;

	let mut stmt = conn
		.prepare(
			r#"
			SELECT
				strftime('%Y-%m', appointment_date) as mes,
				COUNT(*) as total_citas,
				SUM(CASE WHEN status = 'asistio' THEN 1 ELSE 0 END) as asistieron,
				SUM(CASE WHEN status = 'no_asistio' THEN 1 ELSE 0 END) as no_asistieron
			FROM appointments
			WHERE appointment_date >= ?1 AND appointment_date <= ?2
			GROUP BY mes
			ORDER BY mes DESC
		"#,
		)
		.map_err(error::db)?;

	let rows = stmt
		.query_map(params![&start_date, &end_date], |row| {
			let total: i64 = row.get(1)?;
			let asistieron: i64 = row.get(2)?;
			let porcentaje = if total > 0 {
				(asistieron as f64 / total as f64) * 100.0
			} else {
				0.0
			};
			Ok(CitasPorMes {
				mes: row.get(0)?,
				total_citas: total,
				asistieron,
				no_asistieron: row.get(3)?,
				porcentaje_asistencia: porcentaje,
			})
		})
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	Ok(rows)
}

#[tauri::command]
pub fn estadisticas_ingresos_por_mes(
	db: State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<IngresosPorMes>, String> {
	let conn = db.lock().map_err(error::lock)?;

	let mut stmt = conn
		.prepare(
			r#"
			SELECT
				strftime('%Y-%m', fecha_pago) as mes,
				SUM(monto) as monto_total,
				COUNT(*) as cantidad_transacciones,
				AVG(monto) as monto_promedio
			FROM ingresos
			WHERE fecha_pago >= ?1 AND fecha_pago <= ?2
			GROUP BY mes
			ORDER BY mes DESC
		"#,
		)
		.map_err(error::db)?;

	let rows = stmt
		.query_map(params![&start_date, &end_date], |row| {
			Ok(IngresosPorMes {
				mes: row.get(0)?,
				monto_total: row.get(1)?,
				cantidad_transacciones: row.get(2)?,
				monto_promedio: row.get(3)?,
			})
		})
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	Ok(rows)
}

#[tauri::command]
pub fn estadisticas_servicios(
	db: State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<ServicioStats>, String> {
	let conn = db.lock().map_err(error::lock)?;

	let mut stmt = conn
		.prepare(
			r#"
			SELECT
				service_type,
				COUNT(*) as total_citas,
				SUM(CASE WHEN status = 'asistio' THEN 1 ELSE 0 END) as asistieron
			FROM appointments
			WHERE appointment_date >= ?1 AND appointment_date <= ?2
			GROUP BY service_type
			ORDER BY total_citas DESC
		"#,
		)
		.map_err(error::db)?;

	let rows = stmt
		.query_map(params![&start_date, &end_date], |row| {
			let total: i64 = row.get(1)?;
			let asistieron: i64 = row.get(2)?;
			let porcentaje = if total > 0 {
				(asistieron as f64 / total as f64) * 100.0
			} else {
				0.0
			};
			Ok(ServicioStats {
				service_type: row.get(0)?,
				total_citas: total,
				asistieron,
				porcentaje_asistencia: porcentaje,
			})
		})
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	Ok(rows)
}

#[tauri::command]
pub fn estadisticas_metodos_pago(
	db: State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<MetodoPagoStats>, String> {
	let conn = db.lock().map_err(error::lock)?;

	let total_general: f64 = conn
		.query_row(
			"SELECT COALESCE(SUM(monto), 0.0) FROM ingresos WHERE fecha_pago >= ?1 AND fecha_pago <= ?2",
			params![&start_date, &end_date],
			|row| row.get(0),
		)
		.map_err(error::db)?;

	let mut stmt = conn
		.prepare(
			r#"
			SELECT
				metodo_pago,
				SUM(monto) as monto_total,
				COUNT(*) as cantidad_transacciones
			FROM ingresos
			WHERE fecha_pago >= ?1 AND fecha_pago <= ?2
			GROUP BY metodo_pago
			ORDER BY monto_total DESC
		"#,
		)
		.map_err(error::db)?;

	let rows = stmt
		.query_map(params![&start_date, &end_date], |row| {
			let monto: f64 = row.get(1)?;
			let porcentaje = if total_general > 0.0 {
				(monto / total_general) * 100.0
			} else {
				0.0
			};
			Ok(MetodoPagoStats {
				metodo_pago: row.get(0)?,
				monto_total: monto,
				cantidad_transacciones: row.get(2)?,
				porcentaje_del_total: porcentaje,
			})
		})
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	Ok(rows)
}
