use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

use crate::settings_model::BackupSettings;

const DB_FILE: &str = "consultorio.db";
const BACKUP_PREFIX: &str = "consultorio_";
const BACKUP_EXT: &str = ".db";

fn backup_filename() -> String {
	let ts = Local::now().format("%Y-%m-%d_%H-%M-%S_%3f");
	format!("{BACKUP_PREFIX}{ts}{BACKUP_EXT}")
}

fn list_backups(dir: &Path) -> Vec<PathBuf> {
	let Ok(entries) = fs::read_dir(dir) else {
		return vec![];
	};
	let mut files: Vec<PathBuf> = entries
		.filter_map(|e| e.ok())
		.map(|e| e.path())
		.filter(|p| {
			p.file_name()
				.and_then(|n| n.to_str())
				.map(|n| n.starts_with(BACKUP_PREFIX) && n.ends_with(BACKUP_EXT))
				.unwrap_or(false)
		})
		.collect();
	files.sort();
	files
}

fn cleanup_old(dir: &Path, keep: usize) {
	let files = list_backups(dir);
	if files.len() <= keep {
		return;
	}
	let to_remove = files.len() - keep;
	for path in files.into_iter().take(to_remove) {
		let _ = fs::remove_file(path);
	}
}

fn copy_db(db_path: &Path, dest_dir: &Path, retention: usize) -> Result<PathBuf, String> {
	fs::create_dir_all(dest_dir).map_err(|e| format!("No se pudo crear carpeta de respaldo: {e}"))?;
	let dest = dest_dir.join(backup_filename());
	fs::copy(db_path, &dest).map_err(|e| format!("Error al copiar respaldo: {e}"))?;
	cleanup_old(dest_dir, retention);
	Ok(dest)
}

/// Ejecuta el respaldo automático al iniciar la app.
/// Retorna la cantidad de respaldos creados (0, 1 o 2).
pub fn run_startup_backup(
	app_data_dir: &Path,
	settings: &BackupSettings,
) -> Result<u32, String> {
	if !settings.enabled {
		return Ok(0);
	}

	let db_path = app_data_dir.join(DB_FILE);
	if !db_path.exists() {
		return Ok(0);
	}

	let retention = settings.retention_count.max(1) as usize;
	let mut count = 0u32;

	let local_dir = app_data_dir.join("backups");
	copy_db(&db_path, &local_dir, retention)?;
	count += 1;

	let ext = settings.external_path.trim();
	if !ext.is_empty() {
		let ext_dir = Path::new(ext);
		if ext_dir.is_dir() {
			match copy_db(&db_path, ext_dir, retention) {
				Ok(_) => count += 1,
				Err(e) => log::error!(target: "backup", "respaldo externo falló: {e}"),
			}
		} else {
			log::warn!(target: "backup", "ruta externa no existe o no es carpeta: {ext}");
		}
	}

	Ok(count)
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::fs;

	#[test]
	fn backup_creates_file_and_cleans_old() {
		let tmp = std::env::temp_dir().join("renew_backup_test");
		let _ = fs::remove_dir_all(&tmp);
		fs::create_dir_all(&tmp).unwrap();

		let fake_db = tmp.join(DB_FILE);
		fs::write(&fake_db, b"SQLite test data").unwrap();

		let settings = BackupSettings {
			enabled: true,
			retention_count: 2,
			external_path: String::new(),
		};

		let backup_dir = tmp.join("backups");

		for _ in 0..4 {
			copy_db(&fake_db, &backup_dir, settings.retention_count as usize).unwrap();
			std::thread::sleep(std::time::Duration::from_millis(50));
		}

		let files = list_backups(&backup_dir);
		assert_eq!(files.len(), 2, "debe conservar solo 2 respaldos");

		for f in &files {
			let content = fs::read(f).unwrap();
			assert_eq!(content, b"SQLite test data");
		}

		let _ = fs::remove_dir_all(&tmp);
	}

	#[test]
	fn disabled_backup_does_nothing() {
		let tmp = std::env::temp_dir().join("renew_backup_disabled");
		let _ = fs::remove_dir_all(&tmp);
		fs::create_dir_all(&tmp).unwrap();
		fs::write(tmp.join(DB_FILE), b"data").unwrap();

		let settings = BackupSettings {
			enabled: false,
			retention_count: 3,
			external_path: String::new(),
		};

		let count = run_startup_backup(&tmp, &settings).unwrap();
		assert_eq!(count, 0);

		let backup_dir = tmp.join("backups");
		assert!(!backup_dir.exists());

		let _ = fs::remove_dir_all(&tmp);
	}

	#[test]
	fn external_path_gets_backup_too() {
		let tmp = std::env::temp_dir().join("renew_backup_ext");
		let _ = fs::remove_dir_all(&tmp);
		fs::create_dir_all(&tmp).unwrap();
		fs::write(tmp.join(DB_FILE), b"db content").unwrap();

		let ext_dir = tmp.join("external");
		fs::create_dir_all(&ext_dir).unwrap();

		let settings = BackupSettings {
			enabled: true,
			retention_count: 5,
			external_path: ext_dir.to_string_lossy().into_owned(),
		};

		let count = run_startup_backup(&tmp, &settings).unwrap();
		assert_eq!(count, 2);

		let local_files = list_backups(&tmp.join("backups"));
		let ext_files = list_backups(&ext_dir);
		assert_eq!(local_files.len(), 1);
		assert_eq!(ext_files.len(), 1);

		let _ = fs::remove_dir_all(&tmp);
	}
}
