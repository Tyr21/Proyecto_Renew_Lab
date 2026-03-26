use std::sync::Mutex;

use chrono::{DateTime, Local, Utc};
use rusqlite::params;
use uuid::Uuid;

use crate::appointment_model::{AppointmentInput, AppointmentRow};
use crate::settings_model::AppSettings;
use crate::time_rules::{
	is_duration_multiple_30, is_half_hour_aligned, is_appointment_past, minutes_since_midnight,
	overlaps_intervals, parse_hh_mm, within_business_window,
};

pub type DbConn = Mutex<rusqlite::Connection>;

fn load_settings_json(conn: &rusqlite::Connection) -> Result<AppSettings, String> {
	let json: String = conn
		.query_row(
			"SELECT settings_json FROM app_config WHERE id = 1",
			[],
			|row| row.get(0),
		)
		.map_err(|e| e.to_string())?;
	serde_json::from_str(&json).map_err(|e| e.to_string())
}

fn save_settings_json(conn: &rusqlite::Connection, settings: &AppSettings) -> Result<(), String> {
	let json = serde_json::to_string(settings).map_err(|e| e.to_string())?;
	conn
		.execute(
			"UPDATE app_config SET settings_json = ?1 WHERE id = 1",
			params![json],
		)
		.map_err(|e| e.to_string())?;
	Ok(())
}

#[tauri::command]
pub fn get_settings(db: tauri::State<'_, DbConn>) -> Result<AppSettings, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	load_settings_json(&conn)
}

#[tauri::command]
pub fn save_settings(db: tauri::State<'_, DbConn>, settings: AppSettings) -> Result<AppSettings, String> {
	if settings.default_duration_minutes == 0 || settings.default_duration_minutes % 30 != 0 {
		return Err("La duración por defecto debe ser múltiplo de 30 minutos".into());
	}
	if settings.document_types.is_empty() {
		return Err("Debe existir al menos un tipo de documento".into());
	}
	if !settings
		.document_types
		.iter()
		.any(|d| d == &settings.default_document_type)
	{
		return Err("El tipo de documento por defecto debe estar en la lista".into());
	}
	if settings.service_types.is_empty() {
		return Err("Debe existir al menos un tipo de servicio".into());
	}
	for st in &settings.service_types {
		if st.id.trim().is_empty() || st.label.trim().is_empty() {
			return Err("Cada servicio requiere id y etiqueta".into());
		}
		if st.concurrent_capacity < 1 {
			return Err("La capacidad concurrente debe ser al menos 1".into());
		}
	}
	let conn = db.lock().map_err(|e| e.to_string())?;
	save_settings_json(&conn, &settings)?;
	Ok(settings)
}

fn row_to_appointment(row: &rusqlite::Row<'_>) -> rusqlite::Result<AppointmentRow> {
	Ok(AppointmentRow {
		id: row.get(0)?,
		patient_full_name: row.get(1)?,
		document_type: row.get(2)?,
		document_number: row.get(3)?,
		phone_dial_code: row.get(4)?,
		phone_national_number: row.get(5)?,
		birthday_month: row.get(6)?,
		appointment_date: row.get(7)?,
		start_time: row.get(8)?,
		end_time: row.get(9)?,
		service_type: row.get(10)?,
		status: row.get(11)?,
		created_at: row.get(12)?,
		updated_at: row.get(13)?,
	})
}

#[tauri::command]
pub fn list_appointments_range(
	db: tauri::State<'_, DbConn>,
	start_date: String,
	end_date: String,
) -> Result<Vec<AppointmentRow>, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, patient_full_name, document_type, document_number,
				phone_dial_code, phone_national_number, birthday_month,
				appointment_date, start_time, end_time, service_type, status,
				created_at, updated_at
			FROM appointments
			WHERE appointment_date >= ?1 AND appointment_date <= ?2
			ORDER BY appointment_date, start_time
		"#,
		)
		.map_err(|e| e.to_string())?;
	let rows = stmt
		.query_map(params![start_date, end_date], row_to_appointment)
		.map_err(|e| e.to_string())?
		.collect::<Result<Vec<_>, _>>()
		.map_err(|e| e.to_string())?;
	Ok(rows)
}

fn validate_input_times(input: &AppointmentInput) -> Result<(chrono::NaiveTime, chrono::NaiveTime), String> {
	let start = parse_hh_mm(&input.start_time)?;
	let end = parse_hh_mm(&input.end_time)?;
	if !is_half_hour_aligned(start) || !is_half_hour_aligned(end) {
		return Err("Las horas deben alinearse a intervalos de 30 minutos".into());
	}
	if !is_duration_multiple_30(start, end) {
		return Err("La duración debe ser múltiplo de 30 minutos".into());
	}
	if !within_business_window(start, end) {
		return Err("La cita debe quedar entre 07:00 y 20:00 (fin máximo 20:00)".into());
	}
	Ok((start, end))
}

fn validate_against_settings(settings: &AppSettings, input: &AppointmentInput) -> Result<(), String> {
	let name = input.patient_full_name.trim();
	if name.is_empty() {
		return Err("El nombre completo es obligatorio".into());
	}
	if !settings.document_types.contains(&input.document_type) {
		return Err("Tipo de documento no permitido".into());
	}
	let doc = input.document_number.trim();
	if doc.is_empty() || !doc.chars().all(|c| c.is_alphanumeric()) {
		return Err("El documento debe ser alfanumérico".into());
	}
	let phone = input.phone_national_number.trim();
	if phone.is_empty() || !phone.chars().all(|c| c.is_ascii_digit()) {
		return Err("El teléfono (nacional) es obligatorio y solo dígitos".into());
	}
	if settings.capacity_for_service(&input.service_type).is_none() {
		return Err("Tipo de servicio no configurado".into());
	}
	if let Some(m) = input.birthday_month {
		if !(1..=12).contains(&m) {
			return Err("Mes de cumpleaños debe estar entre 1 y 12".into());
		}
	}
	let st = input.status.as_deref().unwrap_or("pendiente");
	if st != "pendiente" && st != "asistio" && st != "no_asistio" {
		return Err("Estado de cita inválido".into());
	}
	Ok(())
}

fn count_overlapping_same_service(
	conn: &rusqlite::Connection,
	date: &str,
	service_type: &str,
	start_min: i32,
	end_min: i32,
	exclude_id: Option<&str>,
) -> Result<u32, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, start_time, end_time, service_type
			FROM appointments
			WHERE appointment_date = ?1 AND service_type = ?2
		"#,
		)
		.map_err(|e| e.to_string())?;
	let rows = stmt
		.query_map(params![date, service_type], |row| {
			Ok((
				row.get::<_, String>(0)?,
				row.get::<_, String>(1)?,
				row.get::<_, String>(2)?,
				row.get::<_, String>(3)?,
			))
		})
		.map_err(|e| e.to_string())?;

	let mut count: u32 = 0;
	for r in rows {
		let (apt_id, start_str, end_str, _) = r.map_err(|e| e.to_string())?;
		if Some(apt_id.as_str()) == exclude_id {
			continue;
		}
		let s = parse_hh_mm(&start_str)?;
		let e = parse_hh_mm(&end_str)?;
		let sm = minutes_since_midnight(s);
		let em = minutes_since_midnight(e);
		if overlaps_intervals(start_min, end_min, sm, em) {
			count += 1;
		}
	}
	Ok(count)
}

#[tauri::command]
pub fn create_appointment(
	db: tauri::State<'_, DbConn>,
	input: AppointmentInput,
) -> Result<AppointmentRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let settings = load_settings_json(&conn)?;
	validate_against_settings(&settings, &input)?;
	let (start_t, end_t) = validate_input_times(&input)?;
	let start_min = minutes_since_midnight(start_t);
	let end_min = minutes_since_midnight(end_t);
	let cap = settings
		.capacity_for_service(&input.service_type)
		.ok_or_else(|| "Tipo de servicio no configurado".to_string())?;
	let overlaps = count_overlapping_same_service(
		&conn,
		&input.appointment_date,
		&input.service_type,
		start_min,
		end_min,
		None,
	)?;
	if overlaps >= cap {
		return Err(format!(
			"Capacidad superada para este servicio (máx. {} concurrentes). Reduce solapes o amplía capacidad en configuración.",
			cap
		));
	}

	let id = Uuid::new_v4().to_string();
	let now: DateTime<Utc> = Utc::now();
	let now_s = now.to_rfc3339();
	let status = "pendiente".to_string();

	conn.execute(
		r#"
		INSERT INTO appointments (
			id, patient_full_name, document_type, document_number,
			phone_dial_code, phone_national_number, birthday_month,
			appointment_date, start_time, end_time, service_type, status,
			created_at, updated_at
		) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
	"#,
		params![
			id,
			input.patient_full_name.trim(),
			input.document_type,
			input.document_number.trim(),
			input.phone_dial_code,
			input.phone_national_number.trim(),
			input.birthday_month,
			input.appointment_date,
			input.start_time,
			input.end_time,
			input.service_type,
			status,
			now_s,
			now_s,
		],
	)
	.map_err(|e| e.to_string())?;

	load_appointment_by_id(&conn, &id)
}

fn load_appointment_by_id(conn: &rusqlite::Connection, id: &str) -> Result<AppointmentRow, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, patient_full_name, document_type, document_number,
				phone_dial_code, phone_national_number, birthday_month,
				appointment_date, start_time, end_time, service_type, status,
				created_at, updated_at
			FROM appointments WHERE id = ?1
		"#,
		)
		.map_err(|e| e.to_string())?;
	let row = stmt
		.query_row(params![id], row_to_appointment)
		.map_err(|e| e.to_string())?;
	Ok(row)
}

#[tauri::command]
pub fn update_appointment(
	db: tauri::State<'_, DbConn>,
	id: String,
	input: AppointmentInput,
) -> Result<AppointmentRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let existing = load_appointment_by_id(&conn, &id)?;
	let settings = load_settings_json(&conn)?;
	let past = is_appointment_past(&existing.appointment_date, &existing.end_time)?;

	if past {
		let status = input.status.as_deref().unwrap_or(&existing.status);
		if status != "asistio" && status != "no_asistio" {
			return Err("Solo puede marcarse asistencia (asistió / no asistió) en citas pasadas".into());
		}
		if input.patient_full_name != existing.patient_full_name
			|| input.document_type != existing.document_type
			|| input.document_number != existing.document_number
			|| input.phone_dial_code != existing.phone_dial_code
			|| input.phone_national_number != existing.phone_national_number
			|| input.birthday_month != existing.birthday_month
			|| input.appointment_date != existing.appointment_date
			|| input.start_time != existing.start_time
			|| input.end_time != existing.end_time
			|| input.service_type != existing.service_type
		{
			return Err("No se pueden modificar datos de agenda en citas pasadas".into());
		}
		let now_s = Utc::now().to_rfc3339();
		conn.execute(
			"UPDATE appointments SET status = ?1, updated_at = ?2 WHERE id = ?3",
			params![status, now_s, id],
		)
		.map_err(|e| e.to_string())?;
		return load_appointment_by_id(&conn, &id);
	}

	validate_against_settings(&settings, &input)?;
	let (start_t, end_t) = validate_input_times(&input)?;
	let start_min = minutes_since_midnight(start_t);
	let end_min = minutes_since_midnight(end_t);
	let cap = settings
		.capacity_for_service(&input.service_type)
		.ok_or_else(|| "Tipo de servicio no configurado".to_string())?;
	let overlaps = count_overlapping_same_service(
		&conn,
		&input.appointment_date,
		&input.service_type,
		start_min,
		end_min,
		Some(&id),
	)?;
	if overlaps >= cap {
		return Err(format!(
			"Capacidad superada para este servicio (máx. {} concurrentes).",
			cap
		));
	}

	let status = input
		.status
		.clone()
		.unwrap_or_else(|| existing.status.clone());
	if status != "pendiente" && status != "asistio" && status != "no_asistio" {
		return Err("Estado de cita inválido".into());
	}

	let now_s = Utc::now().to_rfc3339();
	conn.execute(
		r#"
		UPDATE appointments SET
			patient_full_name = ?1,
			document_type = ?2,
			document_number = ?3,
			phone_dial_code = ?4,
			phone_national_number = ?5,
			birthday_month = ?6,
			appointment_date = ?7,
			start_time = ?8,
			end_time = ?9,
			service_type = ?10,
			status = ?11,
			updated_at = ?12
		WHERE id = ?13
	"#,
		params![
			input.patient_full_name.trim(),
			input.document_type,
			input.document_number.trim(),
			input.phone_dial_code,
			input.phone_national_number.trim(),
			input.birthday_month,
			input.appointment_date,
			input.start_time,
			input.end_time,
			input.service_type,
			status,
			now_s,
			id,
		],
	)
	.map_err(|e| e.to_string())?;

	load_appointment_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_appointment(db: tauri::State<'_, DbConn>, id: String) -> Result<(), String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let existing = load_appointment_by_id(&conn, &id)?;
	if is_appointment_past(&existing.appointment_date, &existing.end_time)? {
		return Err("No se pueden eliminar citas pasadas".into());
	}
	conn
		.execute("DELETE FROM appointments WHERE id = ?1", params![id])
		.map_err(|e| e.to_string())?;
	Ok(())
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogDomainEventInput {
	pub event_name: String,
	pub payload: serde_json::Value,
}

#[tauri::command]
pub fn log_domain_event(input: LogDomainEventInput) -> Result<(), String> {
	let ts = Local::now().to_rfc3339();
	println!(
		"[domain_event] {} | ts_log={} | payload={}",
		input.event_name,
		ts,
		input.payload
	);
	Ok(())
}

/// Carga una cita o error (para armar payload después de acciones desde el front si hace falta).
#[tauri::command]
pub fn get_appointment(db: tauri::State<'_, DbConn>, id: String) -> Result<AppointmentRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	load_appointment_by_id(&conn, &id)
}
