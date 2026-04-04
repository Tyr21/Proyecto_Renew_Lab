use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::DbConn;
use crate::settings_model::AppSettings;

const METODOS_VALIDOS: &[&str] = &["Efectivo", "Tarjeta", "Transferencia"];

// ---------------------------------------------------------------------------
// Modelos serializables
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FacturaLineaRow {
	pub id: String,
	pub factura_id: String,
	pub orden: i64,
	pub descripcion: String,
	pub cantidad: f64,
	pub precio_unitario: f64,
	pub tasa_impuesto_pct: f64,
	pub base_imponible: f64,
	pub impuesto: f64,
	pub total_linea: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FacturaRow {
	pub id: String,
	pub estado: String,
	pub serie: String,
	pub numero: Option<i64>,
	pub cliente_nombre: String,
	pub cliente_documento_tipo: String,
	pub cliente_documento_numero: String,
	pub subtotal: f64,
	pub impuesto_total: f64,
	pub total: f64,
	pub notas: String,
	pub cita_id: Option<String>,
	pub fecha_emision: Option<String>,
	pub anulacion_motivo: Option<String>,
	pub anulada_at: Option<String>,
	pub created_at: String,
	pub updated_at: String,
	pub lineas: Vec<FacturaLineaRow>,
}

// ---------------------------------------------------------------------------
// Inputs del frontend
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FacturaLineaInput {
	pub descripcion: String,
	pub cantidad: f64,
	pub precio_unitario: f64,
	pub tasa_impuesto_pct: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardarBorradorInput {
	pub id: Option<String>,
	pub cliente_nombre: String,
	pub cliente_documento_tipo: String,
	pub cliente_documento_numero: String,
	pub notas: String,
	pub cita_id: Option<String>,
	pub lineas: Vec<FacturaLineaInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmitirFacturaInput {
	pub factura_id: String,
	pub metodo_pago: String,
	pub crear_ingreso: bool,
}

// ---------------------------------------------------------------------------
// Helpers de lectura
// ---------------------------------------------------------------------------

fn row_to_factura(row: &rusqlite::Row<'_>) -> rusqlite::Result<FacturaRow> {
	Ok(FacturaRow {
		id: row.get(0)?,
		estado: row.get(1)?,
		serie: row.get(2)?,
		numero: row.get(3)?,
		cliente_nombre: row.get(4)?,
		cliente_documento_tipo: row.get(5)?,
		cliente_documento_numero: row.get(6)?,
		subtotal: row.get(7)?,
		impuesto_total: row.get(8)?,
		total: row.get(9)?,
		notas: row.get(10)?,
		cita_id: row.get(11)?,
		fecha_emision: row.get(12)?,
		anulacion_motivo: row.get(13)?,
		anulada_at: row.get(14)?,
		created_at: row.get(15)?,
		updated_at: row.get(16)?,
		lineas: Vec::new(),
	})
}

fn load_lineas(conn: &Connection, factura_id: &str) -> Result<Vec<FacturaLineaRow>, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, factura_id, orden, descripcion, cantidad, precio_unitario,
				tasa_impuesto_pct, base_imponible, impuesto, total_linea
			FROM factura_lineas WHERE factura_id = ?1 ORDER BY orden
		"#,
		)
		.map_err(|e| e.to_string())?;
	let rows = stmt
		.query_map(params![factura_id], |r| {
			Ok(FacturaLineaRow {
				id: r.get(0)?,
				factura_id: r.get(1)?,
				orden: r.get(2)?,
				descripcion: r.get(3)?,
				cantidad: r.get(4)?,
				precio_unitario: r.get(5)?,
				tasa_impuesto_pct: r.get(6)?,
				base_imponible: r.get(7)?,
				impuesto: r.get(8)?,
				total_linea: r.get(9)?,
			})
		})
		.map_err(|e| e.to_string())?
		.collect::<Result<Vec<_>, _>>()
		.map_err(|e| e.to_string())?;
	Ok(rows)
}

fn load_factura_full(conn: &Connection, id: &str) -> Result<FacturaRow, String> {
	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, estado, serie, numero, cliente_nombre, cliente_documento_tipo,
				cliente_documento_numero, subtotal, impuesto_total, total, notas,
				cita_id, fecha_emision, anulacion_motivo, anulada_at,
				created_at, updated_at
			FROM facturas WHERE id = ?1
		"#,
		)
		.map_err(|e| e.to_string())?;
	let mut f = stmt
		.query_row(params![id], row_to_factura)
		.map_err(|e| format!("Factura no encontrada: {e}"))?;
	f.lineas = load_lineas(conn, id)?;
	Ok(f)
}

fn calc_linea(input: &FacturaLineaInput) -> (f64, f64, f64) {
	let base = input.cantidad * input.precio_unitario;
	let imp = base * (input.tasa_impuesto_pct / 100.0);
	(base, imp, base + imp)
}

fn load_settings(conn: &Connection) -> Result<AppSettings, String> {
	let json: String = conn
		.query_row(
			"SELECT settings_json FROM app_config WHERE id = 1",
			[],
			|row| row.get(0),
		)
		.map_err(|e| e.to_string())?;
	serde_json::from_str(&json).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Comandos Tauri
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn listar_facturas(
	db: State<'_, DbConn>,
	start_date: String,
	end_date: String,
	estado: Option<String>,
) -> Result<Vec<FacturaRow>, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let base_query = r#"
		SELECT id, estado, serie, numero, cliente_nombre, cliente_documento_tipo,
			cliente_documento_numero, subtotal, impuesto_total, total, notas,
			cita_id, fecha_emision, anulacion_motivo, anulada_at,
			created_at, updated_at
		FROM facturas
		WHERE date(COALESCE(fecha_emision, created_at), 'localtime') >= ?1
		  AND date(COALESCE(fecha_emision, created_at), 'localtime') <= ?2
	"#;

	let mut facturas: Vec<FacturaRow> = if let Some(ref est) = estado {
		let q = format!("{base_query} AND estado = ?3 ORDER BY created_at DESC");
		let mut stmt = conn.prepare(&q).map_err(|e| e.to_string())?;
		let rows = stmt
			.query_map(params![&start_date, &end_date, est], row_to_factura)
			.map_err(|e| e.to_string())?
			.collect::<Result<Vec<_>, _>>()
			.map_err(|e| e.to_string())?;
		rows
	} else {
		let q = format!("{base_query} ORDER BY created_at DESC");
		let mut stmt = conn.prepare(&q).map_err(|e| e.to_string())?;
		let rows = stmt
			.query_map(params![&start_date, &end_date], row_to_factura)
			.map_err(|e| e.to_string())?
			.collect::<Result<Vec<_>, _>>()
			.map_err(|e| e.to_string())?;
		rows
	};

	for f in &mut facturas {
		f.lineas = load_lineas(&conn, &f.id)?;
	}
	Ok(facturas)
}

#[tauri::command]
pub fn obtener_factura(db: State<'_, DbConn>, id: String) -> Result<FacturaRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	load_factura_full(&conn, &id)
}

#[tauri::command]
pub fn guardar_borrador_factura(
	db: State<'_, DbConn>,
	input: GuardarBorradorInput,
) -> Result<FacturaRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let settings = load_settings(&conn)?;
	let serie = settings.billing.serie_default.clone();
	let now = Utc::now().to_rfc3339();

	if input.cliente_nombre.trim().is_empty() {
		return Err("El nombre del cliente es obligatorio".into());
	}
	if input.lineas.is_empty() {
		return Err("Debe haber al menos una línea".into());
	}
	for (i, l) in input.lineas.iter().enumerate() {
		if l.descripcion.trim().is_empty() {
			return Err(format!("La descripción de la línea {} está vacía", i + 1));
		}
		if l.cantidad <= 0.0 || !l.cantidad.is_finite() {
			return Err(format!("La cantidad de la línea {} debe ser positiva", i + 1));
		}
		if l.precio_unitario < 0.0 || !l.precio_unitario.is_finite() {
			return Err(format!("El precio de la línea {} no es válido", i + 1));
		}
		if l.tasa_impuesto_pct < 0.0 || l.tasa_impuesto_pct > 100.0 || !l.tasa_impuesto_pct.is_finite() {
			return Err(format!("El IVA de la línea {} no es válido (0–100)", i + 1));
		}
	}

	let factura_id = if let Some(ref existing_id) = input.id {
		let existing = load_factura_full(&conn, existing_id)?;
		if existing.estado != "borrador" {
			return Err("Solo se puede editar una factura en estado borrador".into());
		}
		conn.execute(
			"DELETE FROM factura_lineas WHERE factura_id = ?1",
			params![existing_id],
		)
		.map_err(|e| e.to_string())?;
		existing_id.clone()
	} else {
		let new_id = Uuid::new_v4().to_string();
		conn.execute(
			r#"
			INSERT INTO facturas (id, estado, serie, cliente_nombre, cliente_documento_tipo,
				cliente_documento_numero, notas, cita_id, created_at, updated_at)
			VALUES (?1, 'borrador', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
		"#,
			params![
				new_id,
				serie,
				input.cliente_nombre.trim(),
				input.cliente_documento_tipo.trim(),
				input.cliente_documento_numero.trim(),
				input.notas.trim(),
				input.cita_id,
				now,
				now,
			],
		)
		.map_err(|e| e.to_string())?;
		new_id
	};

	let mut subtotal = 0.0_f64;
	let mut impuesto_total = 0.0_f64;

	for (i, l) in input.lineas.iter().enumerate() {
		let lid = Uuid::new_v4().to_string();
		let (base, imp, total_l) = calc_linea(l);
		subtotal += base;
		impuesto_total += imp;

		conn.execute(
			r#"
			INSERT INTO factura_lineas (id, factura_id, orden, descripcion, cantidad,
				precio_unitario, tasa_impuesto_pct, base_imponible, impuesto, total_linea)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
		"#,
			params![
				lid,
				factura_id,
				i as i64,
				l.descripcion.trim(),
				l.cantidad,
				l.precio_unitario,
				l.tasa_impuesto_pct,
				base,
				imp,
				total_l,
			],
		)
		.map_err(|e| e.to_string())?;
	}

	let total = subtotal + impuesto_total;
	conn.execute(
		r#"
		UPDATE facturas SET
			cliente_nombre = ?1, cliente_documento_tipo = ?2, cliente_documento_numero = ?3,
			notas = ?4, cita_id = ?5, subtotal = ?6, impuesto_total = ?7, total = ?8,
			updated_at = ?9
		WHERE id = ?10
	"#,
		params![
			input.cliente_nombre.trim(),
			input.cliente_documento_tipo.trim(),
			input.cliente_documento_numero.trim(),
			input.notas.trim(),
			input.cita_id,
			subtotal,
			impuesto_total,
			total,
			now,
			factura_id,
		],
	)
	.map_err(|e| e.to_string())?;

	load_factura_full(&conn, &factura_id)
}

#[tauri::command]
pub fn emitir_factura(
	db: State<'_, DbConn>,
	input: EmitirFacturaInput,
) -> Result<FacturaRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let factura = load_factura_full(&conn, &input.factura_id)?;

	if factura.estado != "borrador" {
		return Err("Solo se puede emitir una factura en estado borrador".into());
	}
	if factura.lineas.is_empty() {
		return Err("La factura no tiene líneas".into());
	}
	if factura.total <= 0.0 {
		return Err("El total de la factura debe ser mayor que cero".into());
	}
	if input.crear_ingreso && !METODOS_VALIDOS.iter().any(|&v| v == input.metodo_pago.trim()) {
		return Err("Método de pago inválido".into());
	}

	let now = Utc::now().to_rfc3339();

	let numero = next_consecutive(&conn, &factura.serie)?;

	conn.execute(
		r#"
		UPDATE facturas SET estado = 'emitida', numero = ?1, fecha_emision = ?2, updated_at = ?3
		WHERE id = ?4
	"#,
		params![numero, now, now, factura.id],
	)
	.map_err(|e| e.to_string())?;

	if input.crear_ingreso {
		let ingreso_id = Uuid::new_v4().to_string();
		conn.execute(
			r#"
			INSERT INTO ingresos (id, cita_id, paciente_nombre, paciente_documento,
				concepto, monto, metodo_pago, fecha_pago, factura_id)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
		"#,
			params![
				ingreso_id,
				factura.cita_id,
				factura.cliente_nombre.trim(),
				factura.cliente_documento_numero.trim(),
				format!("Factura {}-{}", factura.serie, numero),
				factura.total,
				input.metodo_pago.trim(),
				now,
				factura.id,
			],
		)
		.map_err(|e| e.to_string())?;
	}

	load_factura_full(&conn, &factura.id)
}

fn next_consecutive(conn: &Connection, serie: &str) -> Result<i64, String> {
	let updated = conn
		.execute(
			"UPDATE facturacion_contadores SET ultimo_numero = ultimo_numero + 1 WHERE serie = ?1",
			params![serie],
		)
		.map_err(|e| e.to_string())?;

	if updated == 0 {
		conn.execute(
			"INSERT INTO facturacion_contadores (serie, ultimo_numero) VALUES (?1, 1)",
			params![serie],
		)
		.map_err(|e| e.to_string())?;
		return Ok(1);
	}

	let num: i64 = conn
		.query_row(
			"SELECT ultimo_numero FROM facturacion_contadores WHERE serie = ?1",
			params![serie],
			|row| row.get(0),
		)
		.map_err(|e| e.to_string())?;
	Ok(num)
}

#[tauri::command]
pub fn anular_factura(
	db: State<'_, DbConn>,
	id: String,
	motivo: String,
) -> Result<FacturaRow, String> {
	let conn = db.lock().map_err(|e| e.to_string())?;
	let settings = load_settings(&conn)?;
	if !settings.admin_mode {
		return Err("Se requiere modo administrador para anular facturas".into());
	}

	let factura = load_factura_full(&conn, &id)?;
	if factura.estado != "emitida" {
		return Err("Solo se puede anular una factura emitida".into());
	}
	if motivo.trim().is_empty() {
		return Err("El motivo de anulación es obligatorio".into());
	}

	let now = Utc::now().to_rfc3339();
	conn.execute(
		"UPDATE facturas SET estado = 'anulada', anulacion_motivo = ?1, anulada_at = ?2, updated_at = ?3 WHERE id = ?4",
		params![motivo.trim(), now, now, id],
	)
	.map_err(|e| e.to_string())?;

	conn.execute(
		"DELETE FROM ingresos WHERE factura_id = ?1",
		params![id],
	)
	.map_err(|e| e.to_string())?;

	load_factura_full(&conn, &id)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
	use super::*;
	use crate::db::open_in_memory_test_database;

	fn sample_borrador_input() -> GuardarBorradorInput {
		GuardarBorradorInput {
			id: None,
			cliente_nombre: "Ana López".into(),
			cliente_documento_tipo: "CC".into(),
			cliente_documento_numero: "1090".into(),
			notas: String::new(),
			cita_id: None,
			lineas: vec![FacturaLineaInput {
				descripcion: "Cámara Hiperbárica".into(),
				cantidad: 1.0,
				precio_unitario: 180_000.0,
				tasa_impuesto_pct: 19.0,
			}],
		}
	}

	fn guardar_borrador(conn: &Connection, input: GuardarBorradorInput) -> Result<FacturaRow, String> {
		let settings = load_settings(conn)?;
		let serie = settings.billing.serie_default.clone();
		let now = Utc::now().to_rfc3339();

		if input.lineas.is_empty() {
			return Err("Debe haber al menos una línea".into());
		}

		let factura_id = if let Some(ref existing_id) = input.id {
			let existing = load_factura_full(conn, existing_id)?;
			if existing.estado != "borrador" {
				return Err("Solo se puede editar una factura en estado borrador".into());
			}
			conn.execute(
				"DELETE FROM factura_lineas WHERE factura_id = ?1",
				params![existing_id],
			)
			.map_err(|e| e.to_string())?;
			existing_id.clone()
		} else {
			let new_id = Uuid::new_v4().to_string();
			conn.execute(
				r#"
				INSERT INTO facturas (id, estado, serie, cliente_nombre, cliente_documento_tipo,
					cliente_documento_numero, notas, cita_id, created_at, updated_at)
				VALUES (?1, 'borrador', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
			"#,
				params![
					new_id, serie,
					input.cliente_nombre.trim(), input.cliente_documento_tipo.trim(),
					input.cliente_documento_numero.trim(), input.notas.trim(),
					input.cita_id, now, now,
				],
			)
			.map_err(|e| e.to_string())?;
			new_id
		};

		let mut subtotal = 0.0_f64;
		let mut impuesto_total = 0.0_f64;
		for (i, l) in input.lineas.iter().enumerate() {
			let lid = Uuid::new_v4().to_string();
			let (base, imp, total_l) = calc_linea(l);
			subtotal += base;
			impuesto_total += imp;
			conn.execute(
				r#"
				INSERT INTO factura_lineas (id, factura_id, orden, descripcion, cantidad,
					precio_unitario, tasa_impuesto_pct, base_imponible, impuesto, total_linea)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
			"#,
				params![lid, factura_id, i as i64, l.descripcion.trim(), l.cantidad,
					l.precio_unitario, l.tasa_impuesto_pct, base, imp, total_l],
			)
			.map_err(|e| e.to_string())?;
		}

		let total = subtotal + impuesto_total;
		conn.execute(
			r#"UPDATE facturas SET cliente_nombre = ?1, cliente_documento_tipo = ?2,
				cliente_documento_numero = ?3, notas = ?4, cita_id = ?5,
				subtotal = ?6, impuesto_total = ?7, total = ?8, updated_at = ?9
			WHERE id = ?10"#,
			params![
				input.cliente_nombre.trim(), input.cliente_documento_tipo.trim(),
				input.cliente_documento_numero.trim(), input.notas.trim(),
				input.cita_id, subtotal, impuesto_total, total, now, factura_id,
			],
		)
		.map_err(|e| e.to_string())?;

		load_factura_full(conn, &factura_id)
	}

	fn emitir(conn: &Connection, factura_id: &str, metodo: &str, crear_ingreso: bool) -> Result<FacturaRow, String> {
		let factura = load_factura_full(conn, factura_id)?;
		if factura.estado != "borrador" {
			return Err("Solo se puede emitir una factura en estado borrador".into());
		}
		if factura.total <= 0.0 {
			return Err("Total debe ser mayor que cero".into());
		}
		let now = Utc::now().to_rfc3339();
		let numero = next_consecutive(conn, &factura.serie)?;
		conn.execute(
			"UPDATE facturas SET estado = 'emitida', numero = ?1, fecha_emision = ?2, updated_at = ?3 WHERE id = ?4",
			params![numero, now, now, factura.id],
		)
		.map_err(|e| e.to_string())?;

		if crear_ingreso {
			let ingreso_id = Uuid::new_v4().to_string();
			conn.execute(
				r#"INSERT INTO ingresos (id, cita_id, paciente_nombre, paciente_documento,
					concepto, monto, metodo_pago, fecha_pago, factura_id)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"#,
				params![
					ingreso_id, factura.cita_id, factura.cliente_nombre.trim(),
					factura.cliente_documento_numero.trim(),
					format!("Factura {}-{}", factura.serie, numero),
					factura.total, metodo, now, factura.id,
				],
			)
			.map_err(|e| e.to_string())?;
		}

		load_factura_full(conn, &factura.id)
	}

	#[test]
	fn borrador_calcula_totales() {
		let conn = open_in_memory_test_database().unwrap();
		let f = guardar_borrador(&conn, sample_borrador_input()).unwrap();
		assert_eq!(f.estado, "borrador");
		assert!(f.numero.is_none());
		assert_eq!(f.lineas.len(), 1);
		let expected_base = 180_000.0;
		let expected_imp = 180_000.0 * 0.19;
		assert!((f.subtotal - expected_base).abs() < 0.01);
		assert!((f.impuesto_total - expected_imp).abs() < 0.01);
		assert!((f.total - (expected_base + expected_imp)).abs() < 0.01);
	}

	#[test]
	fn emitir_asigna_consecutivo_y_crea_ingreso() {
		let conn = open_in_memory_test_database().unwrap();
		let borrador = guardar_borrador(&conn, sample_borrador_input()).unwrap();
		let emitida = emitir(&conn, &borrador.id, "Efectivo", true).unwrap();
		assert_eq!(emitida.estado, "emitida");
		assert_eq!(emitida.numero, Some(1));
		assert!(emitida.fecha_emision.is_some());

		let ingreso_count: i64 = conn
			.query_row(
				"SELECT COUNT(*) FROM ingresos WHERE factura_id = ?1",
				params![emitida.id],
				|row| row.get(0),
			)
			.unwrap();
		assert_eq!(ingreso_count, 1);
	}

	#[test]
	fn consecutivo_incrementa() {
		let conn = open_in_memory_test_database().unwrap();
		let b1 = guardar_borrador(&conn, sample_borrador_input()).unwrap();
		let b2 = guardar_borrador(&conn, sample_borrador_input()).unwrap();
		let e1 = emitir(&conn, &b1.id, "Efectivo", false).unwrap();
		let e2 = emitir(&conn, &b2.id, "Tarjeta", false).unwrap();
		assert_eq!(e1.numero, Some(1));
		assert_eq!(e2.numero, Some(2));
	}

	#[test]
	fn no_puede_emitir_factura_ya_emitida() {
		let conn = open_in_memory_test_database().unwrap();
		let b = guardar_borrador(&conn, sample_borrador_input()).unwrap();
		emitir(&conn, &b.id, "Efectivo", false).unwrap();
		let err = emitir(&conn, &b.id, "Efectivo", false).unwrap_err();
		assert!(err.contains("borrador"));
	}

	#[test]
	fn no_puede_editar_factura_emitida() {
		let conn = open_in_memory_test_database().unwrap();
		let b = guardar_borrador(&conn, sample_borrador_input()).unwrap();
		emitir(&conn, &b.id, "Efectivo", false).unwrap();
		let mut update = sample_borrador_input();
		update.id = Some(b.id.clone());
		let err = guardar_borrador(&conn, update).unwrap_err();
		assert!(err.contains("borrador"));
	}
}
