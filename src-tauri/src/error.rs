//! Sanitizes internal errors to prevent leaking implementation details
//! (table names, column names, file paths, etc.) to the frontend WebView.
//!
//! Each function logs the full error vía `log::error!` (persistido por
//! `tauri-plugin-log`) y devuelve un mensaje genérico para la UI.

pub(crate) fn db<E: std::fmt::Display>(e: E) -> String {
	log::error!(target: "error::db", "{e}");
	"Error interno de base de datos".into()
}

pub(crate) fn lock<E: std::fmt::Display>(e: E) -> String {
	log::error!(target: "error::lock", "{e}");
	"Error de acceso al sistema".into()
}

pub(crate) fn config<E: std::fmt::Display>(e: E) -> String {
	log::error!(target: "error::config", "{e}");
	"Error al procesar la configuración".into()
}
