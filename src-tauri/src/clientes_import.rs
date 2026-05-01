//! Importación masiva de clientes desde `.xlsx` (primera hoja). Requiere modo administrador activo en BD y contraseña de administrador.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use calamine::{open_workbook_auto, Data, Reader};
use serde::Serialize;
use tauri::State;

use crate::admin_auth::verify_admin_password_with_conn;
use crate::clientes::{crear_cliente_en_conn, CrearClienteInput};
use crate::commands::{load_settings_json, DbConn};
use crate::error;

/// Límite de filas de datos a procesar (sin contar cabecera) para evitar abusos y picos de memoria.
const MAX_DATA_ROWS: usize = 5_000;
/// Máximo de errores detallados devueltos al frontend (el resto se resume en contadores).
const MAX_ERRORS_RETURNED: usize = 80;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientesImportRowError {
	pub row_number: u32,
	pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientesImportResult {
	pub imported: u32,
	pub skipped_duplicate_in_file: u32,
	pub skipped_existing_in_db: u32,
	pub skipped_invalid: u32,
	pub errors: Vec<ClientesImportRowError>,
}

fn normalize_header_cell(raw: &str) -> String {
	let lower = raw.trim().to_lowercase();
	let folded: String = lower
		.chars()
		.map(|c| match c {
			'á' | 'à' | 'ä' | 'â' | 'ã' | 'å' => 'a',
			'é' | 'è' | 'ë' | 'ê' => 'e',
			'í' | 'ì' | 'ï' | 'î' => 'i',
			'ó' | 'ò' | 'ö' | 'ô' | 'õ' => 'o',
			'ú' | 'ù' | 'ü' | 'û' => 'u',
			'ñ' => 'n',
			c if c.is_whitespace() => '_',
			c if c.is_alphanumeric() || c == '_' => c,
			_ => '_',
		})
		.collect();
	folded
		.split('_')
		.filter(|s| !s.is_empty())
		.collect::<Vec<_>>()
		.join("_")
}

fn cell_to_string(cell: &Data) -> String {
	match cell {
		Data::Empty => String::new(),
		Data::String(s) => s.trim().to_string(),
		Data::Float(f) => {
			if f.is_finite() && (*f - f.round()).abs() < f64::EPSILON {
				format!("{}", *f as i64)
			} else {
				format!("{f}")
			}
		}
		Data::Int(i) => i.to_string(),
		Data::Bool(b) => {
			if *b {
				"true".into()
			} else {
				"false".into()
			}
		}
		Data::Error(_) => String::new(),
		Data::DateTime(_) | Data::DateTimeIso(_) | Data::DurationIso(_) => String::new(),
	}
}

fn find_columnindices(header_map: &HashMap<String, usize>, aliases: &[&str]) -> Option<usize> {
	for a in aliases {
		let n = normalize_header_cell(a);
		if let Some(&ix) = header_map.get(&n) {
			return Some(ix);
		}
	}
	None
}

struct ResolvedColumns {
	nombres: usize,
	apellidos: usize,
	document_type: usize,
	document_number: usize,
	phone_dial_code: Option<usize>,
	phone_national: Option<usize>,
	email: Option<usize>,
	birthday_month: Option<usize>,
	notas: Option<usize>,
}

fn resolve_columns(header_row: &[Data]) -> Result<ResolvedColumns, String> {
	let mut header_map: HashMap<String, usize> = HashMap::new();
	for (ix, cell) in header_row.iter().enumerate() {
		let key = normalize_header_cell(&cell_to_string(cell));
		if key.is_empty() {
			continue;
		}
		header_map.entry(key).or_insert(ix);
	}

	let nombres = find_columnindices(
		&header_map,
		&["nombres", "nombre", "first_name", "nombres_cliente"],
	)
	.ok_or_else(|| {
		"No se encontró la columna de nombres. Use una cabecera como: nombres, nombre.".to_string()
	})?;
	let apellidos = find_columnindices(
		&header_map,
		&["apellidos", "apellido", "last_name", "apellidos_cliente"],
	)
	.ok_or_else(|| {
		"No se encontró la columna de apellidos. Use una cabecera como: apellidos, apellido.".to_string()
	})?;
	let document_type = find_columnindices(
		&header_map,
		&[
			"tipo_documento",
			"document_type",
			"tipo_doc",
			"tipodocumento",
			"tipo",
		],
	)
	.ok_or_else(|| {
		"No se encontró la columna de tipo de documento. Use: tipo_documento o document_type.".to_string()
	})?;
	let document_number = find_columnindices(
		&header_map,
		&[
			"numero_documento",
			"document_number",
			"documento",
			"numerodocumento",
			"cedula",
			"nit",
			"no_documento",
			"n_documento",
		],
	)
	.ok_or_else(|| {
		"No se encontró la columna de número de documento. Use: numero_documento o document_number.".to_string()
	})?;

	Ok(ResolvedColumns {
		nombres,
		apellidos,
		document_type,
		document_number,
		phone_dial_code: find_columnindices(
			&header_map,
			&[
				"codigo_telefono",
				"phone_dial_code",
				"indicativo",
				"dial_code",
				"prefijo_telefono",
			],
		),
		phone_national: find_columnindices(
			&header_map,
			&[
				"telefono",
				"celular",
				"phone",
				"phone_national_number",
				"numero_telefono",
				"telefono_movil",
			],
		),
		email: find_columnindices(&header_map, &["email", "correo", "correo_electronico"]),
		birthday_month: find_columnindices(
			&header_map,
			&[
				"mes_cumpleanos",
				"mes_cumpleaños",
				"birthday_month",
				"mes_nacimiento",
				"cumple_mes",
			],
		),
		notas: find_columnindices(&header_map, &["notas", "observaciones", "comentarios"]),
	})
}

fn parse_birthday_month(raw: &str) -> Result<Option<i64>, String> {
	let t = raw.trim();
	if t.is_empty() {
		return Ok(None);
	}
	let n: i64 = t
		.parse()
		.map_err(|_| format!("Mes de cumpleaños no numérico: \"{t}\""))?;
	if (1..=12).contains(&n) {
		Ok(Some(n))
	} else {
		Err(format!("El mes de cumpleaños debe estar entre 1 y 12 (recibido: {n})"))
	}
}

fn get_cell(row: &[Data], ix: usize) -> String {
	row.get(ix).map(cell_to_string).unwrap_or_default()
}

fn row_is_empty(row: &[Data], cols: &ResolvedColumns) -> bool {
	let n = get_cell(row, cols.nombres);
	let a = get_cell(row, cols.apellidos);
	let dt = get_cell(row, cols.document_type);
	let dn = get_cell(row, cols.document_number);
	n.trim().is_empty()
		&& a.trim().is_empty()
		&& dt.trim().is_empty()
		&& dn.trim().is_empty()
}

#[tauri::command]
pub fn importar_clientes_desde_xlsx(
	db: State<'_, DbConn>,
	file_path: String,
	admin_password: String,
) -> Result<ClientesImportResult, String> {
	let path_str = file_path.trim();
	if path_str.is_empty() {
		return Err("Indique la ruta del archivo Excel".into());
	}
	let pwd = admin_password.trim();
	if pwd.is_empty() {
		return Err("Indique la contraseña de administrador".into());
	}

	let path = Path::new(path_str);
	let ext = path
		.extension()
		.and_then(|s| s.to_str())
		.map(|s| s.to_lowercase())
		.unwrap_or_default();
	if ext != "xlsx" {
		return Err("Solo se admiten archivos .xlsx (Libro de Excel). Guarde como .xlsx en Excel.".into());
	}

	let guard = db.lock().map_err(error::lock)?;
	verify_admin_password_with_conn(&guard, pwd)?;

	let settings = load_settings_json(&guard)?;
	if !settings.admin_mode {
		return Err(
			"Active primero el modo administrador en Configuración → Administración y guarde la configuración."
				.into(),
		);
	}

	let mut workbook = open_workbook_auto(path).map_err(|e| format!("No se pudo leer el Excel: {e}"))?;
	let sheet_name = workbook
		.sheet_names()
		.first()
		.cloned()
		.ok_or_else(|| "El archivo no contiene hojas".to_string())?;
	let range = workbook
		.worksheet_range(&sheet_name)
		.map_err(|e| format!("No se pudo leer la primera hoja: {e}"))?;

	let mut rows_iter = range.rows();
	let header_row: Vec<Data> = rows_iter
		.next()
		.ok_or_else(|| "El archivo está vacío (falta fila de cabeceras)".to_string())?
		.to_vec();

	let cols = resolve_columns(&header_row)?;

	let mut result = ClientesImportResult {
		imported: 0,
		skipped_duplicate_in_file: 0,
		skipped_existing_in_db: 0,
		skipped_invalid: 0,
		errors: Vec::new(),
	};

	let mut seen_docs: HashSet<String> = HashSet::new();
	let mut row_index: u32 = 1; // cabecera

	for row in rows_iter {
		row_index += 1;

		if row_index as usize > MAX_DATA_ROWS + 1 {
			return Err(format!(
				"Se superó el máximo de {MAX_DATA_ROWS} filas de datos. Divida el archivo en varias importaciones."
			));
		}

		if row_is_empty(row, &cols) {
			continue;
		}

		let nombres = get_cell(row, cols.nombres);
		let apellidos = get_cell(row, cols.apellidos);
		let document_type = get_cell(row, cols.document_type);
		let document_number = get_cell(row, cols.document_number);

		let doc_key = document_number.trim().to_lowercase();
		if !doc_key.is_empty() && seen_docs.contains(&doc_key) {
			result.skipped_duplicate_in_file += 1;
			if result.errors.len() < MAX_ERRORS_RETURNED {
				result.errors.push(ClientesImportRowError {
					row_number: row_index,
					message: format!(
						"Documento duplicado en el mismo archivo: {}",
						document_number.trim()
					),
				});
			}
			continue;
		}
		if !doc_key.is_empty() {
			seen_docs.insert(doc_key);
		}

		let phone_dial_code = cols
			.phone_dial_code
			.map(|i| get_cell(row, i))
			.unwrap_or_default();
		let phone_national_number = cols
			.phone_national
			.map(|i| get_cell(row, i))
			.unwrap_or_default();
		let email = cols.email.map(|i| get_cell(row, i)).unwrap_or_default();
		let notas = cols.notas.map(|i| get_cell(row, i)).unwrap_or_default();

		let birthday_month_raw = cols.birthday_month.map(|i| get_cell(row, i)).unwrap_or_default();
		let birthday_month = match parse_birthday_month(&birthday_month_raw) {
			Ok(v) => v,
			Err(msg) => {
				result.skipped_invalid += 1;
				if result.errors.len() < MAX_ERRORS_RETURNED {
					result.errors.push(ClientesImportRowError {
						row_number: row_index,
						message: msg,
					});
				}
				continue;
			}
		};

		let input = CrearClienteInput {
			nombres,
			apellidos,
			document_type,
			document_number,
			phone_dial_code,
			phone_national_number,
			email,
			birthday_month,
			notas,
			confirm_duplicate_full_name: true,
		};

		match crear_cliente_en_conn(&guard, input) {
			Ok(_) => {
				result.imported += 1;
			}
			Err(e) => {
				let msg = e.clone();
				if msg.contains("Ya existe un cliente con el número de documento") {
					result.skipped_existing_in_db += 1;
				} else {
					result.skipped_invalid += 1;
				}
				if result.errors.len() < MAX_ERRORS_RETURNED {
					result.errors.push(ClientesImportRowError {
						row_number: row_index,
						message: msg,
					});
				}
			}
		}
	}

	Ok(result)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn normaliza_cabeceras() {
		assert_eq!(normalize_header_cell("  Número documento  "), "numero_documento");
		assert_eq!(normalize_header_cell("Tipo Doc"), "tipo_doc");
	}

	#[test]
	fn parse_mes() {
		assert_eq!(parse_birthday_month("").unwrap(), None);
		assert_eq!(parse_birthday_month("3").unwrap(), Some(3));
		assert!(parse_birthday_month("0").is_err());
	}
}
