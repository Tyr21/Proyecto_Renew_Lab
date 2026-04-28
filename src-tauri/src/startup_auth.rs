//! Contraseña de inicio de sesión: hash Argon2 en tabla `startup_auth` (nunca expuesto al frontend).

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::admin_auth;
use crate::commands::DbConn;
use crate::error;

const MIN_PASSWORD_LEN: usize = 8;
const MAX_PASSWORD_LEN: usize = 128;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupAuthStatus {
	pub has_password: bool,
}

fn load_hash(conn: &rusqlite::Connection) -> Result<Option<String>, String> {
	let hash: Option<String> = conn
		.query_row(
			"SELECT password_hash FROM startup_auth WHERE id = 1",
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
			log::error!(target: "startup_auth", "hash error: {e}");
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

#[tauri::command]
pub fn get_startup_auth_status(db: State<'_, DbConn>) -> Result<StartupAuthStatus, String> {
	let conn = db.lock().map_err(error::lock)?;
	let h = load_hash(&conn)?;
	Ok(StartupAuthStatus {
		has_password: h.is_some(),
	})
}

#[tauri::command]
pub fn verify_startup_password(db: State<'_, DbConn>, password: String) -> Result<(), String> {
	let conn = db.lock().map_err(error::lock)?;
	let Some(hash) = load_hash(&conn)? else {
		return Err("No hay contraseña de inicio configurada".into());
	};
	if !verify_password(&hash, &password) {
		return Err("Contraseña incorrecta".into());
	}
	Ok(())
}

#[tauri::command]
pub fn set_startup_password(
	db: State<'_, DbConn>,
	current_password: Option<String>,
	new_password: String,
) -> Result<(), String> {
	validate_new_password(&new_password)?;
	let new_trim = new_password.trim().to_string();

	let conn = db.lock().map_err(error::lock)?;
	let existing = load_hash(&conn)?;

	if let Some(hash) = &existing {
		let cur = current_password.as_deref().unwrap_or("").trim();
		if cur.is_empty() {
			return Err("Indique la contraseña actual".into());
		}
		if !verify_password(hash, cur) {
			return Err("La contraseña actual no es correcta".into());
		}
	}

	let new_hash = hash_password(&new_trim)?;
	conn.execute(
		"UPDATE startup_auth SET password_hash = ?1 WHERE id = 1",
		params![new_hash],
	)
	.map_err(error::db)?;
	Ok(())
}

/// Quita la contraseña de inicio validando la contraseña de **administrador** (no la de inicio).
#[tauri::command]
pub fn clear_startup_password_with_admin(
	db: State<'_, DbConn>,
	admin_password: String,
) -> Result<(), String> {
	let conn = db.lock().map_err(error::lock)?;
	admin_auth::verify_admin_password_with_conn(&conn, admin_password.trim())?;
	let Some(_) = load_hash(&conn)? else {
		return Err("No hay contraseña de inicio para quitar".into());
	};
	conn.execute(
		"UPDATE startup_auth SET password_hash = NULL WHERE id = 1",
		[],
	)
	.map_err(error::db)?;
	Ok(())
}

/// Establece o sustituye la contraseña de inicio validando la contraseña de administrador (sin conocer la de inicio anterior).
#[tauri::command]
pub fn set_startup_password_with_admin(
	db: State<'_, DbConn>,
	admin_password: String,
	new_password: String,
) -> Result<(), String> {
	validate_new_password(&new_password)?;
	let new_trim = new_password.trim().to_string();
	let conn = db.lock().map_err(error::lock)?;
	admin_auth::verify_admin_password_with_conn(&conn, admin_password.trim())?;
	let new_hash = hash_password(&new_trim)?;
	conn.execute(
		"UPDATE startup_auth SET password_hash = ?1 WHERE id = 1",
		params![new_hash],
	)
	.map_err(error::db)?;
	Ok(())
}
