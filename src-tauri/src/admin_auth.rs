//! Contraseña de administrador (acceso a Configuración y operaciones sensibles). Argon2 en `admin_auth`.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::commands::DbConn;
use crate::error;

const MIN_PASSWORD_LEN: usize = 8;
const MAX_PASSWORD_LEN: usize = 128;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminAuthStatus {
	pub has_password: bool,
}

pub(crate) fn load_admin_hash(conn: &rusqlite::Connection) -> Result<Option<String>, String> {
	let hash: Option<String> = conn
		.query_row(
			"SELECT password_hash FROM admin_auth WHERE id = 1",
			[],
			|row| row.get::<_, Option<String>>(0),
		)
		.map_err(error::db)?;
	Ok(hash.and_then(|h| {
		let t = h.trim();
		if t.is_empty() {
			None
		} else {
			Some(h)
		}
	}))
}

fn hash_password(plain: &str) -> Result<String, String> {
	let salt = SaltString::generate(&mut OsRng);
	Argon2::default()
		.hash_password(plain.as_bytes(), &salt)
		.map(|h| h.to_string())
		.map_err(|e| {
			log::error!(target: "admin_auth", "hash error: {e}");
			"No se pudo procesar la contraseña".into()
		})
}

fn verify_password(stored: &str, plain: &str) -> bool {
	let Ok(parsed) = PasswordHash::new(stored) else {
		return false;
	};
	Argon2::default()
		.verify_password(plain.as_bytes(), &parsed)
		.is_ok()
}

fn validate_new_password(p: &str) -> Result<(), String> {
	let t = p.trim();
	if t.len() < MIN_PASSWORD_LEN {
		return Err(format!(
			"La contraseña debe tener al menos {MIN_PASSWORD_LEN} caracteres"
		));
	}
	if t.len() > MAX_PASSWORD_LEN {
		return Err(format!(
			"La contraseña no puede superar {MAX_PASSWORD_LEN} caracteres"
		));
	}
	Ok(())
}

/// Verifica la contraseña de administrador contra la BD (misma conexión ya bloqueada).
pub(crate) fn verify_admin_password_with_conn(
	conn: &rusqlite::Connection,
	password: &str,
) -> Result<(), String> {
	let Some(hash) = load_admin_hash(conn)? else {
		return Err("No hay contraseña de administrador configurada".into());
	};
	if !verify_password(&hash, password) {
		return Err("Contraseña de administrador incorrecta".into());
	}
	Ok(())
}

#[tauri::command]
pub fn get_admin_auth_status(db: State<'_, DbConn>) -> Result<AdminAuthStatus, String> {
	let conn = db.lock().map_err(error::lock)?;
	let h = load_admin_hash(&conn)?;
	Ok(AdminAuthStatus {
		has_password: h.is_some(),
	})
}

#[tauri::command]
pub fn verify_admin_password(db: State<'_, DbConn>, password: String) -> Result<(), String> {
	let conn = db.lock().map_err(error::lock)?;
	verify_admin_password_with_conn(&conn, &password)
}

#[tauri::command]
pub fn set_admin_password(
	db: State<'_, DbConn>,
	current_password: Option<String>,
	new_password: String,
) -> Result<(), String> {
	validate_new_password(&new_password)?;
	let new_trim = new_password.trim().to_string();

	let conn = db.lock().map_err(error::lock)?;
	let existing = load_admin_hash(&conn)?;

	if let Some(hash) = &existing {
		let cur = current_password.as_deref().unwrap_or("").trim();
		if cur.is_empty() {
			return Err("Indique la contraseña actual de administrador".into());
		}
		if !verify_password(hash, cur) {
			return Err("La contraseña actual de administrador no es correcta".into());
		}
	}

	let new_hash = hash_password(&new_trim)?;
	conn.execute(
		"UPDATE admin_auth SET password_hash = ?1 WHERE id = 1",
		params![new_hash],
	)
	.map_err(error::db)?;
	Ok(())
}

#[tauri::command]
pub fn clear_admin_password(db: State<'_, DbConn>, current_password: String) -> Result<(), String> {
	let conn = db.lock().map_err(error::lock)?;
	let Some(hash) = load_admin_hash(&conn)? else {
		return Err("No hay contraseña de administrador para quitar".into());
	};
	let cur = current_password.trim();
	if cur.is_empty() {
		return Err("Indique la contraseña actual de administrador".into());
	}
	if !verify_password(&hash, cur) {
		return Err("Contraseña de administrador incorrecta".into());
	}
	conn.execute(
		"UPDATE admin_auth SET password_hash = NULL WHERE id = 1",
		[],
	)
	.map_err(error::db)?;
	Ok(())
}
