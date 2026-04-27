use chrono::{Local, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::clientes::{self, CrearClienteInput};
use crate::commands::{DbConn, load_settings_json};
use crate::error;

const METODOS_VALIDOS: &[&str] = &["Efectivo", "Tarjeta", "Transferencia"];

pub const PAQUETE_STATUS_ACTIVO: &str = "activo";
pub const PAQUETE_STATUS_AGOTADO: &str = "agotado";
pub const PAQUETE_STATUS_VENCIDO: &str = "vencido";
pub const PAQUETE_STATUS_ANULADO: &str = "anulado";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaqueteRow {
	pub id: String,
	pub cliente_id: String,
	pub service_type: String,
	pub total_sesiones: i64,
	pub precio_total: f64,
	pub status: String,
	pub expires_at: Option<String>,
	pub created_at: String,
	pub updated_at: String,
	pub consumidas: i64,
	pub reservadas: i64,
	pub restantes: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrearPaqueteInput {
	pub cliente_id: String,
	pub service_type: String,
	pub total_sesiones: i64,
	pub precio_total: f64,
	pub metodo_pago: String,
	pub expires_at: Option<String>,
	/// Si viene informado, se usa como concepto del ingreso (p. ej. nombre del plan configurado).
	#[serde(default)]
	pub ingreso_concepto: Option<String>,
}

fn validate_metodo(m: &str) -> bool {
	METODOS_VALIDOS.contains(&m)
}

fn parse_expires_date(s: &str) -> Result<NaiveDate, String> {
	let t = s.trim();
	if t.is_empty() {
		return Err("Fecha de vencimiento vacía".into());
	}
	NaiveDate::parse_from_str(t, "%Y-%m-%d").map_err(|_| "Fecha de vencimiento inválida (use AAAA-MM-DD)".into())
}

/// Cuenta sesiones consumidas (`asistio`) y reservadas (`pendiente`) del paquete.
pub(crate) fn contar_sesiones_paquete(
	conn: &Connection,
	paquete_id: &str,
) -> Result<(i64, i64), String> {
	let consumidas: i64 = conn
		.query_row(
			r#"
			SELECT COUNT(*) FROM appointments
			WHERE paquete_id = ?1 AND status = 'asistio'
			"#,
			params![paquete_id],
			|row| row.get(0),
		)
		.map_err(error::db)?;
	let reservadas: i64 = conn
		.query_row(
			r#"
			SELECT COUNT(*) FROM appointments
			WHERE paquete_id = ?1 AND status = 'pendiente'
			"#,
			params![paquete_id],
			|row| row.get(0),
		)
		.map_err(error::db)?;
	Ok((consumidas, reservadas))
}

fn paquete_expirado_por_fecha(expires_at: Option<&str>) -> bool {
	let Some(raw) = expires_at else {
		return false;
	};
	let Ok(d) = NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d") else {
		return false;
	};
	let today = Local::now().date_naive();
	d < today
}

/// Ajusta `status` del paquete según cupo y fecha (no toca `anulado`).
pub(crate) fn sync_paquete_status(conn: &Connection, paquete_id: &str) -> Result<(), String> {
	let row: (String, i64, Option<String>) = conn
		.query_row(
			"SELECT status, total_sesiones, expires_at FROM paquetes WHERE id = ?1",
			params![paquete_id],
			|row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
		)
		.map_err(error::db)?;

	let (status, total, expires_at) = row;
	if status == PAQUETE_STATUS_ANULADO {
		return Ok(());
	}

	let (consumidas, _reservadas) = contar_sesiones_paquete(conn, paquete_id)?;
	let now_s = Utc::now().to_rfc3339();

	let next = if paquete_expirado_por_fecha(expires_at.as_deref()) {
		PAQUETE_STATUS_VENCIDO
	} else if consumidas >= total {
		PAQUETE_STATUS_AGOTADO
	} else {
		PAQUETE_STATUS_ACTIVO
	};

	if next != status {
		conn.execute(
			"UPDATE paquetes SET status = ?1, updated_at = ?2 WHERE id = ?3",
			params![next, now_s, paquete_id],
		)
		.map_err(error::db)?;
	}
	Ok(())
}

pub(crate) fn sync_paquetes_status_for_ids(conn: &Connection, ids: &[String]) -> Result<(), String> {
	let mut seen = std::collections::HashSet::<String>::new();
	for id in ids {
		let t = id.trim();
		if t.is_empty() || !seen.insert(t.to_string()) {
			continue;
		}
		let exists: i64 = conn
			.query_row(
				"SELECT COUNT(*) FROM paquetes WHERE id = ?1",
				params![t],
				|row| row.get(0),
			)
			.map_err(error::db)?;
		if exists > 0 {
			sync_paquete_status(conn, t)?;
		}
	}
	Ok(())
}

/// Valida que el paquete permita una nueva reserva y coincida paciente/servicio.
pub(crate) fn validar_paquete_para_reserva(
	conn: &Connection,
	paquete_id: &str,
	document_type: &str,
	document_number: &str,
	service_type: &str,
	excluir_cita_id: Option<&str>,
) -> Result<(), String> {
	let row: (String, String, String, String, String, Option<String>) = conn
		.query_row(
			r#"
			SELECT p.status, p.cliente_id, p.service_type, c.document_type, c.document_number, p.expires_at
			FROM paquetes p
			JOIN clientes c ON c.id = p.cliente_id
			WHERE p.id = ?1
			"#,
			params![paquete_id],
			|row| {
				Ok((
					row.get(0)?,
					row.get(1)?,
					row.get(2)?,
					row.get(3)?,
					row.get(4)?,
					row.get(5)?,
				))
			},
		)
		.map_err(|_| "Paquete no encontrado".to_string())?;

	let (p_status, _cliente_id, p_service, c_doc_type, c_doc_num, expires_at) = row;

	if p_status == PAQUETE_STATUS_ANULADO {
		return Err("El paquete está anulado".into());
	}
	if p_status == PAQUETE_STATUS_VENCIDO || paquete_expirado_por_fecha(expires_at.as_deref()) {
		return Err("El paquete está vencido".into());
	}
	if p_status != PAQUETE_STATUS_ACTIVO {
		return Err("El paquete no está activo".into());
	}
	if p_service != service_type {
		return Err("El paquete no corresponde a este tipo de servicio".into());
	}
	if c_doc_type.trim() != document_type.trim() || c_doc_num.trim() != document_number.trim() {
		return Err("El paquete pertenece a otro cliente (documento no coincide)".into());
	}

	let total: i64 = conn
		.query_row(
			"SELECT total_sesiones FROM paquetes WHERE id = ?1",
			params![paquete_id],
			|row| row.get(0),
		)
		.map_err(error::db)?;

	let mut consumidas: i64 = conn
		.query_row(
			r#"
			SELECT COUNT(*) FROM appointments
			WHERE paquete_id = ?1 AND status = 'asistio'
			"#,
			params![paquete_id],
			|row| row.get(0),
		)
		.map_err(error::db)?;

	let mut reservadas: i64 = conn
		.query_row(
			r#"
			SELECT COUNT(*) FROM appointments
			WHERE paquete_id = ?1 AND status = 'pendiente'
			"#,
			params![paquete_id],
			|row| row.get(0),
		)
		.map_err(error::db)?;

	if let Some(ex) = excluir_cita_id {
		let was: Option<(String, String)> = conn
			.query_row(
				"SELECT paquete_id, status FROM appointments WHERE id = ?1",
				params![ex],
				|row| Ok((row.get(0)?, row.get(1)?)),
			)
			.optional()
			.map_err(error::db)?;
		if let Some((pid, st)) = was {
			if pid.trim() == paquete_id {
				if st == "asistio" {
					consumidas -= 1;
				} else if st == "pendiente" {
					reservadas -= 1;
				}
			}
		}
	}

	if consumidas + reservadas >= total {
		return Err("No hay sesiones disponibles en este paquete".into());
	}
	Ok(())
}

fn row_to_paquete_row(
	row: &rusqlite::Row<'_>,
	consumidas: i64,
	reservadas: i64,
	total: i64,
) -> rusqlite::Result<PaqueteRow> {
	let restantes = total - consumidas - reservadas;
	Ok(PaqueteRow {
		id: row.get(0)?,
		cliente_id: row.get(1)?,
		service_type: row.get(2)?,
		total_sesiones: total,
		precio_total: row.get(4)?,
		status: row.get(5)?,
		expires_at: row.get(6)?,
		created_at: row.get(7)?,
		updated_at: row.get(8)?,
		consumidas,
		reservadas,
		restantes,
	})
}

#[tauri::command]
pub fn listar_paquetes_cliente(
	db: State<'_, DbConn>,
	cliente_id: String,
) -> Result<Vec<PaqueteRow>, String> {
	let conn = db.lock().map_err(error::lock)?;
	let cid = cliente_id.trim();
	if cid.is_empty() {
		return Err("cliente_id es obligatorio".into());
	}

	let mut stmt_ids = conn
		.prepare("SELECT id FROM paquetes WHERE cliente_id = ?1 ORDER BY created_at DESC")
		.map_err(error::db)?;
	let ids: Vec<String> = stmt_ids
		.query_map(params![cid], |row| row.get(0))
		.map_err(error::db)?
		.collect::<Result<Vec<_>, _>>()
		.map_err(error::db)?;

	for id in &ids {
		sync_paquete_status(&conn, id)?;
	}

	let mut stmt = conn
		.prepare(
			r#"
			SELECT id, cliente_id, service_type, total_sesiones, precio_total, status, expires_at, created_at, updated_at
			FROM paquetes WHERE cliente_id = ?1
			ORDER BY created_at DESC
		"#,
		)
		.map_err(error::db)?;

	let rows = stmt
		.query_map(params![cid], |row| {
			let id: String = row.get(0)?;
			let total: i64 = row.get(3)?;
			let (cons, res) = contar_sesiones_paquete(&conn, &id).map_err(|e| {
				rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(
					e,
				)))
			})?;
			row_to_paquete_row(row, cons, res, total)
		})
		.map_err(error::db)?;

	let mut out = Vec::new();
	for r in rows {
		out.push(r.map_err(error::db)?);
	}

	Ok(out)
}

#[tauri::command]
pub fn crear_paquete(
	app: AppHandle,
	db: State<'_, DbConn>,
	input: CrearPaqueteInput,
) -> Result<PaqueteRow, String> {
	let cliente_id = input.cliente_id.trim().to_string();
	if cliente_id.is_empty() {
		return Err("El cliente es obligatorio".into());
	}
	let service_type = input.service_type.trim().to_string();
	if service_type.is_empty() {
		return Err("El tipo de servicio es obligatorio".into());
	}
	if input.total_sesiones < 1 {
		return Err("El número de sesiones debe ser al menos 1".into());
	}
	if input.precio_total <= 0.0 || !input.precio_total.is_finite() {
		return Err("El precio total debe ser un número positivo".into());
	}
	if !validate_metodo(input.metodo_pago.trim()) {
		return Err("Método de pago inválido".into());
	}

	let expires_norm = if let Some(ref e) = input.expires_at {
		let d = parse_expires_date(e)?;
		Some(d.format("%Y-%m-%d").to_string())
	} else {
		None
	};

	let conn = db.lock().map_err(error::lock)?;
	let settings = load_settings_json(&conn)?;
	if settings.capacity_for_service(&service_type).is_none() {
		return Err("Tipo de servicio no configurado".into());
	}

	let nombre_cliente: (String, String) = conn
		.query_row(
			"SELECT nombres, apellidos FROM clientes WHERE id = ?1",
			params![cliente_id],
			|row| Ok((row.get(0)?, row.get(1)?)),
		)
		.map_err(|_| "Cliente no encontrado".to_string())?;

	let doc_row: (String, String) = conn
		.query_row(
			"SELECT document_type, document_number FROM clientes WHERE id = ?1",
			params![cliente_id],
			|row| Ok((row.get(0)?, row.get(1)?)),
		)
		.map_err(error::db)?;

	let label = settings
		.label_for_service(&service_type)
		.unwrap_or(&service_type);
	let concepto = input
		.ingreso_concepto
		.as_ref()
		.map(|s| s.trim().to_string())
		.filter(|s| !s.is_empty())
		.unwrap_or_else(|| {
			format!(
				"Paquete: {} ({} sesiones)",
				label,
				input.total_sesiones
			)
		});
	let paciente_nombre = format!("{} {}", nombre_cliente.0.trim(), nombre_cliente.1.trim()).trim().to_string();

	let id = Uuid::new_v4().to_string();
	let now = Utc::now().to_rfc3339();
	let ingreso_id = Uuid::new_v4().to_string();

	conn.execute("BEGIN TRANSACTION", []).map_err(error::db)?;

	let r_pkg = conn.execute(
		r#"
		INSERT INTO paquetes (id, cliente_id, service_type, total_sesiones, precio_total, status, expires_at, created_at, updated_at)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
		"#,
		params![
			id,
			cliente_id,
			service_type,
			input.total_sesiones,
			input.precio_total,
			PAQUETE_STATUS_ACTIVO,
			expires_norm,
			now,
			now,
		],
	);

	if let Err(e) = r_pkg {
		conn.execute("ROLLBACK", []).ok();
		return Err(error::db(e));
	}

	let r_ing = conn.execute(
		r#"
		INSERT INTO ingresos (id, cita_id, paciente_nombre, paciente_documento, concepto, monto, metodo_pago, fecha_pago, paquete_id)
		VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
		"#,
		params![
			ingreso_id,
			paciente_nombre,
			doc_row.1.trim(),
			concepto,
			input.precio_total,
			input.metodo_pago.trim(),
			now,
			id,
		],
	);

	if let Err(e) = r_ing {
		conn.execute("ROLLBACK", []).ok();
		return Err(error::db(e));
	}

	conn.execute("COMMIT", []).map_err(error::db)?;

	let (cons, res) = contar_sesiones_paquete(&conn, &id)?;
	let row: PaqueteRow = conn
		.query_row(
			r#"
			SELECT id, cliente_id, service_type, total_sesiones, precio_total, status, expires_at, created_at, updated_at
			FROM paquetes WHERE id = ?1
			"#,
			params![id],
			|row| {
				let total: i64 = row.get(3)?;
				row_to_paquete_row(row, cons, res, total)
			},
		)
		.map_err(error::db)?;

	let _ = app.emit(
		"paquete_creado",
		serde_json::json!({
			"paquete_id": id,
			"cliente_id": cliente_id,
			"service_type": service_type,
			"timestamp": now,
		}),
	);

	Ok(row)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrearClienteYPaqueteInput {
	pub cliente: CrearClienteInput,
	pub service_type: String,
	pub total_sesiones: i64,
	pub precio_total: f64,
	pub metodo_pago: String,
	pub expires_at: Option<String>,
	#[serde(default)]
	pub ingreso_concepto: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClienteYPaqueteCreado {
	pub cliente: clientes::ClienteRow,
	pub paquete: PaqueteRow,
}

/// Crea el cliente y el paquete + ingreso en una sola transacción.
#[tauri::command]
pub fn crear_cliente_y_paquete(
	app: AppHandle,
	db: State<'_, DbConn>,
	input: CrearClienteYPaqueteInput,
) -> Result<ClienteYPaqueteCreado, String> {
	clientes::validate_crear_cliente_input(&input.cliente)?;

	let service_type = input.service_type.trim().to_string();
	if service_type.is_empty() {
		return Err("El tipo de servicio es obligatorio".into());
	}
	if input.total_sesiones < 1 {
		return Err("El número de sesiones debe ser al menos 1".into());
	}
	if input.precio_total <= 0.0 || !input.precio_total.is_finite() {
		return Err("El precio total debe ser un número positivo".into());
	}
	if !validate_metodo(input.metodo_pago.trim()) {
		return Err("Método de pago inválido".into());
	}

	let expires_norm = if let Some(ref e) = input.expires_at {
		let d = parse_expires_date(e)?;
		Some(d.format("%Y-%m-%d").to_string())
	} else {
		None
	};

	let conn = db.lock().map_err(error::lock)?;
	let settings = load_settings_json(&conn)?;
	if settings.capacity_for_service(&service_type).is_none() {
		return Err("Tipo de servicio no configurado".into());
	}

	let c = &input.cliente;
	let nombres_fmt = clientes::format_nombre_propio(c.nombres.trim());
	let apellidos_fmt = clientes::format_nombre_propio(c.apellidos.trim());
	let paciente_nombre = format!("{} {}", nombres_fmt, apellidos_fmt)
		.trim()
		.to_string();
	let label = settings
		.label_for_service(&service_type)
		.unwrap_or(&service_type);
	let concepto = input
		.ingreso_concepto
		.as_ref()
		.map(|s| s.trim().to_string())
		.filter(|s| !s.is_empty())
		.unwrap_or_else(|| {
			format!(
				"Paquete: {} ({} sesiones)",
				label,
				input.total_sesiones
			)
		});

	let cliente_id = Uuid::new_v4().to_string();
	let paquete_id = Uuid::new_v4().to_string();
	let ingreso_id = Uuid::new_v4().to_string();
	let now = Utc::now().to_rfc3339();

	conn.execute("BEGIN TRANSACTION", []).map_err(error::db)?;

	let r_cli = conn.execute(
		r#"
		INSERT INTO clientes (
			id, nombres, apellidos, document_type, document_number,
			phone_dial_code, phone_national_number, email,
			birthday_month, notas, created_at, updated_at
		) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
		"#,
		params![
			cliente_id,
			nombres_fmt,
			apellidos_fmt,
			c.document_type.trim(),
			c.document_number.trim(),
			c.phone_dial_code.trim(),
			c.phone_national_number.trim(),
			c.email.trim(),
			c.birthday_month,
			c.notas.trim(),
			now,
			now,
		],
	);

	if let Err(e) = r_cli {
		conn.execute("ROLLBACK", []).ok();
		let msg = e.to_string();
		if msg.contains("UNIQUE constraint failed") {
			return Err(format!(
				"Ya existe un cliente con el documento {}",
				c.document_number.trim()
			));
		}
		return Err(error::db(e));
	}

	let r_pkg = conn.execute(
		r#"
		INSERT INTO paquetes (id, cliente_id, service_type, total_sesiones, precio_total, status, expires_at, created_at, updated_at)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
		"#,
		params![
			paquete_id,
			cliente_id,
			service_type,
			input.total_sesiones,
			input.precio_total,
			PAQUETE_STATUS_ACTIVO,
			expires_norm,
			now,
			now,
		],
	);

	if let Err(e) = r_pkg {
		conn.execute("ROLLBACK", []).ok();
		return Err(error::db(e));
	}

	let r_ing = conn.execute(
		r#"
		INSERT INTO ingresos (id, cita_id, paciente_nombre, paciente_documento, concepto, monto, metodo_pago, fecha_pago, paquete_id)
		VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
		"#,
		params![
			ingreso_id,
			paciente_nombre,
			c.document_number.trim(),
			concepto,
			input.precio_total,
			input.metodo_pago.trim(),
			now,
			paquete_id,
		],
	);

	if let Err(e) = r_ing {
		conn.execute("ROLLBACK", []).ok();
		return Err(error::db(e));
	}

	conn.execute("COMMIT", []).map_err(error::db)?;

	let cliente_row = clientes::load_cliente_by_id(&conn, &cliente_id)?;
	let (cons, res) = contar_sesiones_paquete(&conn, &paquete_id)?;
	let paquete_row: PaqueteRow = conn
		.query_row(
			r#"
			SELECT id, cliente_id, service_type, total_sesiones, precio_total, status, expires_at, created_at, updated_at
			FROM paquetes WHERE id = ?1
			"#,
			params![paquete_id],
			|row| {
				let total: i64 = row.get(3)?;
				row_to_paquete_row(row, cons, res, total)
			},
		)
		.map_err(error::db)?;

	let _ = app.emit(
		"paquete_creado",
		serde_json::json!({
			"paquete_id": paquete_id,
			"cliente_id": cliente_id,
			"service_type": service_type,
			"timestamp": now,
		}),
	);

	Ok(ClienteYPaqueteCreado {
		cliente: cliente_row,
		paquete: paquete_row,
	})
}
