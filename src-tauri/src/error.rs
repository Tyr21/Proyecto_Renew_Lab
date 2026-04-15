/// Sanitizes internal errors to prevent leaking implementation details
/// (table names, column names, file paths, etc.) to the frontend WebView.
///
/// Each function logs the full error to stderr for developer debugging and
/// returns a generic, user-safe message to the frontend.

pub(crate) fn db<E: std::fmt::Display>(e: E) -> String {
	eprintln!("[error::db] {e}");
	"Error interno de base de datos".into()
}

pub(crate) fn lock<E: std::fmt::Display>(e: E) -> String {
	eprintln!("[error::lock] {e}");
	"Error de acceso al sistema".into()
}

pub(crate) fn config<E: std::fmt::Display>(e: E) -> String {
	eprintln!("[error::config] {e}");
	"Error al procesar la configuración".into()
}
