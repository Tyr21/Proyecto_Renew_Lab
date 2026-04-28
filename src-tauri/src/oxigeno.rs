//! Registro de lecturas de oxígeno, fotos (JPG/PNG por cabecera), EXIF opcional para fecha de captura y resúmenes para cierre.

use std::io::Cursor;
use std::path::{Path, PathBuf};

use exif::{In, Reader as ExifReader, Tag, Value};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

use crate::commands::{load_settings_json, DbConn};
use crate::error;

const OXYGEN_PHOTOS_DIR: &str = "oxigeno_fotos";

/// Firma inicial JPEG (SOI + siguiente marcador).
const JPEG_MAGIC: &[u8] = &[0xFF, 0xD8, 0xFF];
/// Firma PNG estándar.
const PNG_MAGIC: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FormatoImagenOxigeno {
	Jpeg,
	Png,
}

pub static OXIGENO_TIPOS: &[&str] = &["recarga_pipeta", "cierre"];

/// Convierte cadena EXIF típica `YYYY:MM:DD HH:MM:SS` a `YYYY-MM-DD`.
pub(crate) fn parse_exif_datetime_to_iso_date(raw: &str) -> Result<String, String> {
	let date_part = raw
		.split_whitespace()
		.next()
		.ok_or_else(|| format!("Fecha EXIF vacía: {raw}"))?;
	let parts: Vec<&str> = date_part.split(':').collect();
	if parts.len() != 3 {
		return Err(format!("Fecha EXIF no reconocida: {raw}"));
	}
	let y = parts[0];
	let m = parts[1];
	let d = parts[2];
	if y.len() != 4 || m.len() != 2 || d.len() != 2 {
		return Err(format!("Fecha EXIF no reconocida: {raw}"));
	}
	Ok(format!("{y}-{m}-{d}"))
}

/// Comprueba cabecera JPEG o PNG. No inspecciona el resto del contenedor.
fn detectar_jpeg_o_png(bytes: &[u8]) -> Result<FormatoImagenOxigeno, String> {
	if bytes.len() < JPEG_MAGIC.len() {
		return Err("Archivo de imagen demasiado pequeño o corrupto.".into());
	}
	if bytes[..JPEG_MAGIC.len()] == *JPEG_MAGIC {
		return Ok(FormatoImagenOxigeno::Jpeg);
	}
	if bytes.len() < PNG_MAGIC.len() {
		return Err("Archivo de imagen demasiado pequeño o corrupto.".into());
	}
	if bytes[..PNG_MAGIC.len()] == *PNG_MAGIC {
		return Ok(FormatoImagenOxigeno::Png);
	}
	Err("La foto debe ser JPEG o PNG (cabecera no reconocida).".into())
}

fn extension_coincide_con_cabecera(
	fmt: FormatoImagenOxigeno,
	ext_normalizada: &str,
) -> Result<(), String> {
	match (fmt, ext_normalizada) {
		(FormatoImagenOxigeno::Jpeg, "jpg") | (FormatoImagenOxigeno::Png, "png") => Ok(()),
		_ => Err(
			"La extensión del archivo no coincide con el formato real (use JPG o PNG según la imagen)."
				.into(),
		),
	}
}

/// Si hay EXIF legible con fecha de captura, devuelve `Some(YYYY-MM-DD)`; si no hay EXIF,
/// no se puede leer o no hay fecha usable, devuelve `None`. No valida la cabecera de la imagen.
fn exif_fecha_captura_opcional(bytes: &[u8]) -> Option<String> {
	let mut cursor = Cursor::new(bytes);
	let exif = ExifReader::new().read_from_container(&mut cursor).ok()?;
	let field = exif
		.get_field(Tag::DateTimeOriginal, In::PRIMARY)
		.or_else(|| exif.get_field(Tag::DateTimeDigitized, In::PRIMARY))
		.or_else(|| exif.get_field(Tag::DateTime, In::PRIMARY))?;
	let raw = match &field.value {
		Value::Ascii(v) => {
			let slice = v.first()?;
			std::str::from_utf8(slice)
				.ok()?
				.trim_end_matches('\0')
				.to_string()
		}
		_ => return None,
	};
	parse_exif_datetime_to_iso_date(&raw).ok()
}

fn sanitize_image_extension(ext: &str) -> Result<String, String> {
	let e = ext.trim().trim_start_matches('.').to_lowercase();
	match e.as_str() {
		"jpg" | "jpeg" => Ok("jpg".into()),
		"png" => Ok("png".into()),
		"" => Err("Indique extensión de imagen (jpg o png)".into()),
		_ => Err("Solo se admiten fotos jpg o png".into()),
	}
}

fn app_oxygen_dir(app: &AppHandle) -> Result<PathBuf, String> {
	let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
	Ok(dir.join(OXYGEN_PHOTOS_DIR))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OxigenoEvento {
	pub id: String,
	pub fecha_operacion: String,
	pub tipo: String,
	pub medidor_a: f64,
	pub medidor_b: f64,
	pub saldo_enfermeria: Option<f64>,
	pub notas: String,
	pub foto_relativa: Option<String>,
	pub foto_exif_fecha: Option<String>,
	pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrarEventoOxigenoInput {
	pub fecha_operacion: String,
	pub tipo: String,
	pub medidor_a: f64,
	pub medidor_b: f64,
	pub saldo_enfermeria: Option<f64>,
	pub notas: Option<String>,
	pub foto_bytes: Option<Vec<u8>>,
	pub foto_extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OxigenoResumenDia {
	pub fecha: String,
	pub sesiones_camara: i64,
	pub consumo_teorico: f64,
	pub delta_medidor_a: Option<f64>,
	pub delta_medidor_b: Option<f64>,
	pub eventos_registrados: i64,
	pub unidad_etiqueta: String,
	pub sin_lecturas: bool,
	pub varianza_vs_teorico_a: Option<f64>,
	pub varianza_vs_teorico_b: Option<f64>,
}

/// Último evento guardado (más reciente en `created_at`) para mostrar contexto al registrar lecturas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UltimaLecturaOxigeno {
	pub medidor_a: f64,
	pub medidor_b: f64,
	pub fecha_operacion: String,
	pub created_at: String,
}

fn validate_fecha_ymd(s: &str) -> Result<(), String> {
	if s.len() != 10 || s.chars().nth(4) != Some('-') || s.chars().nth(7) != Some('-') {
		return Err("fecha_operacion debe ser YYYY-MM-DD".into());
	}
	Ok(())
}

#[tauri::command]
pub fn listar_oxigeno_por_rango(
	db: tauri::State<'_, DbConn>,
	fecha_desde: String,
	fecha_hasta: String,
) -> Result<Vec<OxigenoEvento>, String> {
	validate_fecha_ymd(&fecha_desde)?;
	validate_fecha_ymd(&fecha_hasta)?;
	let conn = db.lock().map_err(error::lock)?;
	let mut stmt = conn
		.prepare(
			r#"SELECT id, fecha_operacion, tipo, medidor_a, medidor_b, saldo_enfermeria,
				notas, foto_relativa, foto_exif_fecha, created_at
			FROM oxigeno_eventos
			WHERE fecha_operacion >= ?1 AND fecha_operacion <= ?2
			ORDER BY fecha_operacion ASC, created_at ASC"#,
		)
		.map_err(error::db)?;
	let rows = stmt
		.query_map(params![&fecha_desde, &fecha_hasta], |row| {
			Ok(OxigenoEvento {
				id: row.get(0)?,
				fecha_operacion: row.get(1)?,
				tipo: row.get(2)?,
				medidor_a: row.get(3)?,
				medidor_b: row.get(4)?,
				saldo_enfermeria: row.get(5)?,
				notas: row.get(6)?,
				foto_relativa: row.get(7)?,
				foto_exif_fecha: row.get(8)?,
				created_at: row.get(9)?,
			})
		})
		.map_err(error::db)?;
	let mut out = Vec::new();
	for r in rows {
		out.push(r.map_err(error::db)?);
	}
	Ok(out)
}

/// Lecturas A/B del registro con `created_at` más reciente. Sin filas devuelve `null`.
#[tauri::command]
pub fn obtener_ultima_lectura_oxigeno(
	db: tauri::State<'_, DbConn>,
) -> Result<Option<UltimaLecturaOxigeno>, String> {
	let conn = db.lock().map_err(error::lock)?;
	let mut stmt = conn
		.prepare(
			r#"SELECT medidor_a, medidor_b, fecha_operacion, created_at
			FROM oxigeno_eventos
			ORDER BY created_at DESC
			LIMIT 1"#,
		)
		.map_err(error::db)?;
	match stmt.query_row([], |row| {
		Ok(UltimaLecturaOxigeno {
			medidor_a: row.get(0)?,
			medidor_b: row.get(1)?,
			fecha_operacion: row.get(2)?,
			created_at: row.get(3)?,
		})
	}) {
		Ok(v) => Ok(Some(v)),
		Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
		Err(e) => Err(e.to_string()),
	}
}

#[tauri::command]
pub fn registrar_evento_oxigeno(
	app: AppHandle,
	db: tauri::State<'_, DbConn>,
	input: RegistrarEventoOxigenoInput,
) -> Result<OxigenoEvento, String> {
	let tipo = input.tipo.trim().to_string();
	if !OXIGENO_TIPOS.contains(&tipo.as_str()) {
		return Err(format!("Tipo inválido. Use: {}", OXIGENO_TIPOS.join(", ")));
	}
	validate_fecha_ymd(&input.fecha_operacion)?;
	if !input.medidor_a.is_finite() || !input.medidor_b.is_finite() {
		return Err("Las lecturas de medidor deben ser números válidos".into());
	}
	if let Some(s) = input.saldo_enfermeria {
		if !s.is_finite() {
			return Err("El saldo declarado debe ser un número válido".into());
		}
	}

	let bytes = input.foto_bytes.as_ref();
	if bytes.is_none() || bytes.unwrap().is_empty() {
		return Err("Adjunte foto de los medidores para este tipo de registro.".into());
	}

	let (foto_relativa, foto_exif_fecha) = if let Some(b) = bytes.filter(|v| !v.is_empty()) {
		let ext = sanitize_image_extension(
			input
				.foto_extension
				.as_deref()
				.ok_or_else(|| "Indique extensión de la foto (jpg/png)".to_string())?,
		)?;
		let formato = detectar_jpeg_o_png(b)?;
		extension_coincide_con_cabecera(formato, &ext)?;
		let exif_date = exif_fecha_captura_opcional(b);
		if let Some(ref d) = exif_date {
			if d != &input.fecha_operacion {
				return Err(format!(
					"La fecha de la foto (EXIF: {d}) no coincide con el día de operación ({}).",
					input.fecha_operacion
				));
			}
		}
		let base = app_oxygen_dir(&app)?;
		let day_dir = base.join(&input.fecha_operacion);
		std::fs::create_dir_all(&day_dir).map_err(|e| e.to_string())?;
		let fname = format!("{}.{}", Uuid::new_v4(), ext);
		let full_path = day_dir.join(&fname);
		std::fs::write(&full_path, b).map_err(|e| e.to_string())?;
		let rel = Path::new(OXYGEN_PHOTOS_DIR)
			.join(&input.fecha_operacion)
			.join(&fname);
		let rel_str = rel.to_string_lossy().replace('\\', "/");
		(Some(rel_str), exif_date)
	} else {
		(None, None)
	};

	let id = Uuid::new_v4().to_string();
	let created_at = chrono::Utc::now().to_rfc3339();
	let notas = input.notas.unwrap_or_default().trim().to_string();

	let conn = db.lock().map_err(error::lock)?;
	conn.execute(
		r#"INSERT INTO oxigeno_eventos (
				id, fecha_operacion, tipo, medidor_a, medidor_b, saldo_enfermeria,
				notas, foto_relativa, foto_exif_fecha, created_at
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#,
		params![
			&id,
			&input.fecha_operacion,
			&tipo,
			input.medidor_a,
			input.medidor_b,
			input.saldo_enfermeria,
			&notas,
			foto_relativa.as_deref(),
			foto_exif_fecha.as_deref(),
			&created_at,
		],
	)
	.map_err(error::db)?;

	Ok(OxigenoEvento {
		id,
		fecha_operacion: input.fecha_operacion,
		tipo,
		medidor_a: input.medidor_a,
		medidor_b: input.medidor_b,
		saldo_enfermeria: input.saldo_enfermeria,
		notas,
		foto_relativa,
		foto_exif_fecha,
		created_at,
	})
}

fn count_sesiones_camara(
	conn: &rusqlite::Connection,
	fecha: &str,
	service_type: &str,
) -> Result<i64, String> {
	let n: i64 = conn
		.query_row(
			r#"SELECT COUNT(*) FROM appointments
			WHERE appointment_date = ?1 AND service_type = ?2 AND status = 'asistio'"#,
			params![fecha, service_type],
			|row| row.get(0),
		)
		.map_err(error::db)?;
	Ok(n)
}

fn deltas_y_eventos_del_dia(
	conn: &rusqlite::Connection,
	fecha: &str,
) -> Result<(i64, Option<f64>, Option<f64>), String> {
	let mut stmt = conn
		.prepare(
			r#"SELECT medidor_a, medidor_b, created_at FROM oxigeno_eventos
			WHERE fecha_operacion = ?1 ORDER BY created_at ASC"#,
		)
		.map_err(error::db)?;
	let rows = stmt
		.query_map(params![fecha], |row| {
			Ok((row.get::<_, f64>(0)?, row.get::<_, f64>(1)?))
		})
		.map_err(error::db)?;
	let mut readings: Vec<(f64, f64)> = Vec::new();
	for r in rows {
		readings.push(r.map_err(error::db)?);
	}
	let count = readings.len() as i64;
	let (da, db) = if readings.len() >= 2 {
		let first = readings.first().unwrap();
		let last = readings.last().unwrap();
		(Some(last.0 - first.0), Some(last.1 - first.1))
	} else {
		(None, None)
	};
	Ok((count, da, db))
}

#[tauri::command]
pub fn resumen_oxigeno_rango(
	db: tauri::State<'_, DbConn>,
	fecha_desde: String,
	fecha_hasta: String,
) -> Result<Vec<OxigenoResumenDia>, String> {
	validate_fecha_ymd(&fecha_desde)?;
	validate_fecha_ymd(&fecha_hasta)?;
	let conn = db.lock().map_err(error::lock)?;
	let settings = load_settings_json(&conn)?;
	let svc = settings.oxygen.service_type_id.trim();
	let k = settings.oxygen.per_hyperbaric_session;
	let label = settings.oxygen.units_label.clone();

	let d0 = chrono::NaiveDate::parse_from_str(&fecha_desde, "%Y-%m-%d")
		.map_err(|_| "fecha_desde inválida".to_string())?;
	let d1 = chrono::NaiveDate::parse_from_str(&fecha_hasta, "%Y-%m-%d")
		.map_err(|_| "fecha_hasta inválida".to_string())?;
	let mut cur = d0;
	let mut out = Vec::new();
	while cur <= d1 {
		let fecha = cur.format("%Y-%m-%d").to_string();
		let sesiones = count_sesiones_camara(&conn, &fecha, svc)?;
		let teorico = sesiones as f64 * k;
		let (eventos, da, db) = deltas_y_eventos_del_dia(&conn, &fecha)?;
		let sin_lecturas = eventos == 0;
		let var_a = da.map(|d| d - teorico);
		let var_b = db.map(|d| d - teorico);
		out.push(OxigenoResumenDia {
			fecha,
			sesiones_camara: sesiones,
			consumo_teorico: teorico,
			delta_medidor_a: da,
			delta_medidor_b: db,
			eventos_registrados: eventos,
			unidad_etiqueta: label.clone(),
			sin_lecturas,
			varianza_vs_teorico_a: var_a,
			varianza_vs_teorico_b: var_b,
		});
		cur = cur
			.succ_opt()
			.ok_or_else(|| "rango de fechas inválido".to_string())?;
	}
	Ok(out)
}

/// Lee bytes de una foto almacenada bajo `app_data/oxigeno_fotos/...`.
#[tauri::command]
pub fn leer_foto_oxigeno(app: AppHandle, foto_relativa: String) -> Result<Vec<u8>, String> {
	let rel = foto_relativa.trim();
	if rel.contains("..") || !rel.starts_with(OXYGEN_PHOTOS_DIR) {
		return Err("Ruta de foto no permitida.".into());
	}
	let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
	let full = base.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
	let canonical_base = base
		.canonicalize()
		.map_err(|e| format!("No se pudo resolver carpeta de datos: {e}"))?;
	let canonical_file = full
		.canonicalize()
		.map_err(|_| "Archivo de foto no encontrado.".to_string())?;
	if !canonical_file.starts_with(&canonical_base) {
		return Err("Ruta fuera del directorio de la aplicación.".into());
	}
	std::fs::read(&canonical_file).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
	use rusqlite::params;

	use super::*;
	use crate::db::open_in_memory_test_database;

	#[test]
	fn parse_exif_date_ok() {
		assert_eq!(
			parse_exif_datetime_to_iso_date("2026:04:20 14:30:00").unwrap(),
			"2026-04-20"
		);
	}

	#[test]
	fn parse_exif_date_rejects_bad() {
		assert!(parse_exif_datetime_to_iso_date("20-04-2026").is_err());
	}

	#[test]
	fn cabecera_imagen_rechaza_buffer_invalido() {
		assert!(detectar_jpeg_o_png(b"no-es-una-imagen").is_err());
	}

	#[test]
	fn jpeg_minimo_sin_exif_devuelve_none_en_fecha() {
		let mut v = Vec::from(JPEG_MAGIC);
		v.extend_from_slice(&[0xD9]); // EOI (imagen degenerada; basta para cabecera + lector EXIF)
		assert_eq!(detectar_jpeg_o_png(&v).unwrap(), FormatoImagenOxigeno::Jpeg);
		assert_eq!(exif_fecha_captura_opcional(&v), None);
	}

	#[test]
	fn png_minimo_sin_exif_devuelve_none_en_fecha() {
		let mut v = Vec::from(PNG_MAGIC);
		v.extend_from_slice(&[0, 0, 0, 0]);
		assert_eq!(detectar_jpeg_o_png(&v).unwrap(), FormatoImagenOxigeno::Png);
		assert_eq!(exif_fecha_captura_opcional(&v), None);
	}

	#[test]
	fn cuenta_sesiones_solo_asistio_y_tipo_camara() {
		let conn = open_in_memory_test_database().unwrap();
		let base = |id: &str, st: &str, status: &str| {
			conn.execute(
				r#"INSERT INTO appointments (
					id, patient_full_name, document_type, document_number,
					phone_dial_code, phone_national_number, birthday_month,
					appointment_date, start_time, end_time, service_type, status,
					created_at, updated_at
				) VALUES (?1, 'P', 'CC', ?1, '+57', '3000000000', NULL,
					'2026-04-19', '09:00', '10:00', ?2, ?3,
					'2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z')"#,
				params![id, st, status],
			)
			.unwrap();
		};
		base("c1", "camara_hiperbarica", "asistio");
		base("c2", "camara_hiperbarica", "asistio");
		base("c3", "camara_hiperbarica", "no_asistio");
		base("c4", "sueroterapia", "asistio");
		let n = count_sesiones_camara(&conn, "2026-04-19", "camara_hiperbarica").unwrap();
		assert_eq!(n, 2);
	}
}
