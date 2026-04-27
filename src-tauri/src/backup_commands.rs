//! Comandos Tauri para listar y restaurar respaldos `consultorio_*.db`.
//!
//! La restauración es destructiva: requiere modo administrador activo en `app_config` y la
//! contraseña de administrador. El frontend nunca recibe rutas absolutas crudas: solo elige
//! una entrada del listado o un archivo a través del diálogo nativo (capability `dialog:allow-open`).

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, State};

use crate::admin_auth::verify_admin_password_with_conn;
use crate::backup::{self, BackupFileInfo};
use crate::commands::{load_settings_json, DbConn};
use crate::db;
use crate::error;

fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
	let dir = app
		.path()
		.app_data_dir()
		.map_err(|e| {
			log::error!(target: "backup_commands", "app_data_dir: {e}");
			"No se pudo localizar la carpeta de datos de la aplicación".to_string()
		})?;
	std::fs::create_dir_all(&dir)
		.map_err(|e| format!("No se pudo crear la carpeta de datos: {e}"))?;
	Ok(dir)
}

#[tauri::command]
pub fn listar_respaldos_locales(app: AppHandle) -> Result<Vec<BackupFileInfo>, String> {
	let dir = resolve_app_data_dir(&app)?;
	Ok(backup::list_local_backups_info(&dir))
}

/// Restaura la base de datos activa con el respaldo en `source_path`.
///
/// Pasos:
/// 1. Valida que haya modo administrador activo y verifica la contraseña.
/// 2. Sustituye la `Connection` activa por una in-memory dummy para liberar el archivo
///    (fundamental en Windows: no se puede renombrar mientras hay handles abiertos).
/// 3. Reemplaza el archivo `consultorio.db` (copia temporal + rename).
/// 4. Abre una nueva conexión real (con migraciones) y la restaura en el `Mutex`.
///
/// Si algo falla durante (3), la `Connection` queda como dummy in-memory hasta el final del
/// flujo de error, momento en el que se intenta reabrir contra la BD original. En el peor caso
/// se devuelve un error y la app debería reiniciarse.
#[tauri::command]
pub fn restaurar_respaldo(
	app: AppHandle,
	db: State<'_, DbConn>,
	source_path: String,
	admin_password: String,
) -> Result<(), String> {
	let trimmed_path = source_path.trim();
	if trimmed_path.is_empty() {
		return Err("Indique un archivo de respaldo a restaurar".into());
	}
	let pwd = admin_password.trim();
	if pwd.is_empty() {
		return Err("Indique la contraseña de administrador".into());
	}

	let app_data_dir = resolve_app_data_dir(&app)?;
	let source = Path::new(trimmed_path).to_path_buf();

	let mut guard = db.lock().map_err(error::lock)?;
	verify_admin_password_with_conn(&guard, pwd)?;

	let settings = load_settings_json(&guard)?;
	if !settings.admin_mode {
		return Err(
			"Active primero el modo administrador en Configuración → Administración para restaurar un respaldo."
				.into(),
		);
	}

	let _ = guard.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

	let dummy = rusqlite::Connection::open_in_memory().map_err(error::db)?;
	let old_conn = std::mem::replace(&mut *guard, dummy);
	drop(old_conn);

	if let Err(restore_err) = backup::restore_from_backup(&app_data_dir, &source) {
		match db::open_connection(&app) {
			Ok(c) => {
				*guard = c;
			}
			Err(open_err) => {
				log::error!(
					target: "backup_commands",
					"restore failed and could not reopen original DB: {open_err}"
				);
			}
		}
		return Err(restore_err);
	}

	let new_conn = db::open_connection(&app).map_err(|e| {
		log::error!(target: "backup_commands", "no se pudo abrir la BD restaurada: {e}");
		"La base de datos se reemplazó pero no se pudo abrir la nueva. Reinicie la aplicación.".to_string()
	})?;
	*guard = new_conn;
	Ok(())
}
