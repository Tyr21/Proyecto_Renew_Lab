use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Local, Utc};
use serde::Serialize;

use crate::settings_model::BackupSettings;

pub(crate) const DB_FILE: &str = "consultorio.db";
pub(crate) const BACKUP_PREFIX: &str = "consultorio_";
pub(crate) const BACKUP_EXT: &str = ".db";
pub(crate) const LOCAL_BACKUPS_SUBDIR: &str = "backups";
const RESTORE_TMP_NAME: &str = "consultorio.db.restore.tmp";
const SQLITE_HEADER: &[u8] = b"SQLite format 3\0";

/// Cabecera mínima legítima de un archivo SQLite. Permite descartar archivos no soportados
/// antes de reemplazar la base activa.
const MIN_SQLITE_FILE_BYTES: u64 = 100;

/// Información expuesta al frontend para listar los respaldos disponibles.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFileInfo {
	pub name: String,
	pub full_path: String,
	pub size_bytes: u64,
	pub modified_at_iso: String,
}

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
	fs::create_dir_all(dest_dir)
		.map_err(|e| format!("No se pudo crear carpeta de respaldo: {e}"))?;
	let dest = dest_dir.join(backup_filename());
	fs::copy(db_path, &dest).map_err(|e| format!("Error al copiar respaldo: {e}"))?;
	cleanup_old(dest_dir, retention);
	Ok(dest)
}

fn is_valid_backup_file_name(name: &str) -> bool {
	name.starts_with(BACKUP_PREFIX) && name.ends_with(BACKUP_EXT)
}

fn iso_from_systime(t: std::time::SystemTime) -> String {
	let dt: DateTime<Utc> = t.into();
	dt.to_rfc3339()
}

fn build_backup_info(path: &Path) -> Option<BackupFileInfo> {
	let name = path.file_name()?.to_str()?.to_string();
	let meta = fs::metadata(path).ok()?;
	let size_bytes = meta.len();
	let modified_at_iso = meta
		.modified()
		.ok()
		.map(iso_from_systime)
		.unwrap_or_default();
	Some(BackupFileInfo {
		name,
		full_path: path.to_string_lossy().into_owned(),
		size_bytes,
		modified_at_iso,
	})
}

/// Lista los respaldos en `app_data_dir/backups` (más recientes primero por nombre, ya que el
/// prefijo de timestamp ordena cronológicamente).
pub fn list_local_backups_info(app_data_dir: &Path) -> Vec<BackupFileInfo> {
	let dir = app_data_dir.join(LOCAL_BACKUPS_SUBDIR);
	let mut files = list_backups(&dir);
	files.sort_by(|a, b| b.cmp(a));
	files
		.into_iter()
		.filter_map(|p| build_backup_info(&p))
		.collect()
}

/// Valida que `source_path` exista, sea archivo regular y respete el prefijo `consultorio_*.db`.
fn validate_backup_source(source_path: &Path) -> Result<(), String> {
	let name = source_path
		.file_name()
		.and_then(|n| n.to_str())
		.ok_or_else(|| "El archivo de respaldo no tiene un nombre válido".to_string())?;
	if !is_valid_backup_file_name(name) {
		return Err(format!(
			"El archivo «{name}» no parece un respaldo válido (debe empezar por «{BACKUP_PREFIX}» y terminar en «{BACKUP_EXT}»)"
		));
	}
	let meta = fs::metadata(source_path)
		.map_err(|e| format!("No se puede leer el respaldo seleccionado: {e}"))?;
	if !meta.is_file() {
		return Err("La ruta seleccionada no es un archivo".into());
	}
	if meta.len() < MIN_SQLITE_FILE_BYTES {
		return Err("El respaldo seleccionado parece estar vacío o corrupto".into());
	}

	let mut buf = [0u8; 16];
	use std::io::Read;
	let mut f =
		fs::File::open(source_path).map_err(|e| format!("No se puede abrir el respaldo: {e}"))?;
	f.read_exact(&mut buf)
		.map_err(|e| format!("No se puede leer la cabecera del respaldo: {e}"))?;
	if buf != SQLITE_HEADER {
		return Err("El archivo elegido no es una base de datos SQLite válida".into());
	}
	Ok(())
}

/// Reemplaza atómicamente `app_data_dir/consultorio.db` por el contenido de `source_path`.
///
/// Pre-condición: el llamador debe haber cerrado todas las conexiones a la BD activa antes de
/// invocar esta función (ver `commands::restore` / swap del `Mutex<Connection>`), ya que en
/// Windows el archivo no puede reemplazarse mientras el handle está abierto.
pub fn restore_from_backup(app_data_dir: &Path, source_path: &Path) -> Result<(), String> {
	validate_backup_source(source_path)?;

	let canonical_source =
		fs::canonicalize(source_path).map_err(|e| format!("Ruta de respaldo inválida: {e}"))?;
	let canonical_data = fs::canonicalize(app_data_dir)
		.map_err(|e| format!("No se pudo localizar la carpeta de datos: {e}"))?;
	let active_db = canonical_data.join(DB_FILE);
	if let Ok(active_canonical) = fs::canonicalize(&active_db) {
		if active_canonical == canonical_source {
			return Err(
				"No se puede restaurar el archivo activo sobre sí mismo. Elija otro respaldo."
					.into(),
			);
		}
	}

	let tmp_path = canonical_data.join(RESTORE_TMP_NAME);
	if tmp_path.exists() {
		let _ = fs::remove_file(&tmp_path);
	}
	fs::copy(&canonical_source, &tmp_path)
		.map_err(|e| format!("No se pudo copiar el respaldo a un archivo temporal: {e}"))?;

	if let Err(e) =
		rusqlite::Connection::open_with_flags(&tmp_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
			.and_then(|c| c.query_row("PRAGMA schema_version", [], |row| row.get::<_, i64>(0)))
	{
		let _ = fs::remove_file(&tmp_path);
		return Err(format!(
			"El archivo seleccionado no es una base de datos SQLite válida: {e}"
		));
	}

	for stale in [
		canonical_data.join(format!("{DB_FILE}-wal")),
		canonical_data.join(format!("{DB_FILE}-shm")),
	] {
		if stale.exists() {
			let _ = fs::remove_file(&stale);
		}
	}

	fs::rename(&tmp_path, &active_db).map_err(|e| {
		let _ = fs::remove_file(&tmp_path);
		format!("No se pudo reemplazar la base de datos activa: {e}")
	})?;
	Ok(())
}

/// Ejecuta el respaldo automático al iniciar la app.
/// Retorna la cantidad de respaldos creados (0, 1 o 2).
pub fn run_startup_backup(app_data_dir: &Path, settings: &BackupSettings) -> Result<u32, String> {
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

	fn write_minimal_sqlite_file(path: &Path) {
		let conn = rusqlite::Connection::open(path).unwrap();
		conn.execute_batch(
			"CREATE TABLE marker (k TEXT PRIMARY KEY); INSERT INTO marker VALUES ('ok');",
		)
		.unwrap();
		drop(conn);
	}

	#[test]
	fn restore_rejects_non_sqlite_payload() {
		let tmp = std::env::temp_dir().join("renew_restore_invalid_payload");
		let _ = fs::remove_dir_all(&tmp);
		fs::create_dir_all(&tmp).unwrap();
		let active = tmp.join(DB_FILE);
		write_minimal_sqlite_file(&active);
		let bogus = tmp.join("consultorio_bogus.db");
		let bogus_payload = vec![b'X'; 256];
		fs::write(&bogus, &bogus_payload).unwrap();

		let err = restore_from_backup(&tmp, &bogus).unwrap_err();
		assert!(
			err.contains("SQLite"),
			"mensaje debe indicar archivo no válido SQLite: {err}"
		);

		let _ = fs::remove_dir_all(&tmp);
	}

	#[test]
	fn restore_rejects_invalid_prefix() {
		let tmp = std::env::temp_dir().join("renew_restore_prefix");
		let _ = fs::remove_dir_all(&tmp);
		fs::create_dir_all(&tmp).unwrap();
		let active = tmp.join(DB_FILE);
		write_minimal_sqlite_file(&active);

		let foreign = tmp.join("otro_archivo.db");
		write_minimal_sqlite_file(&foreign);

		let err = restore_from_backup(&tmp, &foreign).unwrap_err();
		assert!(
			err.contains("respaldo válido"),
			"debe rechazar prefijo inválido: {err}"
		);

		let _ = fs::remove_dir_all(&tmp);
	}

	#[test]
	fn restore_replaces_active_database_atomically() {
		let tmp = std::env::temp_dir().join("renew_restore_ok");
		let _ = fs::remove_dir_all(&tmp);
		fs::create_dir_all(&tmp).unwrap();

		let active = tmp.join(DB_FILE);
		write_minimal_sqlite_file(&active);

		let backup_dir = tmp.join(LOCAL_BACKUPS_SUBDIR);
		fs::create_dir_all(&backup_dir).unwrap();
		let backup_path = backup_dir.join("consultorio_2026-01-01_00-00-00_000.db");

		let backup_conn = rusqlite::Connection::open(&backup_path).unwrap();
		backup_conn
			.execute_batch(
				"CREATE TABLE marker (k TEXT PRIMARY KEY); INSERT INTO marker VALUES ('restaurado');",
			)
			.unwrap();
		drop(backup_conn);

		fs::write(tmp.join(format!("{DB_FILE}-wal")), b"old wal").unwrap();
		fs::write(tmp.join(format!("{DB_FILE}-shm")), b"old shm").unwrap();

		restore_from_backup(&tmp, &backup_path).unwrap();

		let conn = rusqlite::Connection::open(&active).unwrap();
		let val: String = conn
			.query_row("SELECT k FROM marker LIMIT 1", [], |row| row.get(0))
			.unwrap();
		assert_eq!(val, "restaurado");

		assert!(!tmp.join(format!("{DB_FILE}-wal")).exists());
		assert!(!tmp.join(format!("{DB_FILE}-shm")).exists());
		assert!(!tmp.join(RESTORE_TMP_NAME).exists());

		let _ = fs::remove_dir_all(&tmp);
	}

	#[test]
	fn list_local_backups_info_orders_recent_first() {
		let tmp = std::env::temp_dir().join("renew_restore_list");
		let _ = fs::remove_dir_all(&tmp);
		fs::create_dir_all(&tmp).unwrap();

		let backup_dir = tmp.join(LOCAL_BACKUPS_SUBDIR);
		fs::create_dir_all(&backup_dir).unwrap();
		let older = backup_dir.join("consultorio_2026-01-01_00-00-00_000.db");
		let newer = backup_dir.join("consultorio_2026-12-31_23-59-59_999.db");
		write_minimal_sqlite_file(&older);
		write_minimal_sqlite_file(&newer);
		fs::write(backup_dir.join("noise.txt"), b"ignored").unwrap();

		let infos = list_local_backups_info(&tmp);
		assert_eq!(infos.len(), 2);
		assert_eq!(infos[0].name, "consultorio_2026-12-31_23-59-59_999.db");
		assert_eq!(infos[1].name, "consultorio_2026-01-01_00-00-00_000.db");
		assert!(infos[0].size_bytes > 0);

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
