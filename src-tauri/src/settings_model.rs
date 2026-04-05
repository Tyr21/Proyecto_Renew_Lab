use serde::{Deserialize, Serialize};

fn default_suggested_price() -> f64 {
	150_000.0
}

fn default_backup_retention() -> u32 {
	7
}

fn default_serie() -> String {
	"FV".into()
}

fn default_iva_pct() -> f64 {
	19.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceTypeSetting {
	pub id: String,
	pub label: String,
	pub concurrent_capacity: u32,
	/// Precio sugerido (misma moneda local que `ingresos.monto`). Ausente en JSON antiguo → default.
	#[serde(default = "default_suggested_price")]
	pub suggested_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingSettings {
	#[serde(default)]
	pub razon_social: String,
	#[serde(default)]
	pub nit: String,
	#[serde(default)]
	pub direccion: String,
	#[serde(default)]
	pub telefono: String,
	#[serde(default = "default_serie")]
	pub serie_default: String,
	#[serde(default = "default_iva_pct")]
	pub iva_default_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSettings {
	#[serde(default)]
	pub enabled: bool,
	#[serde(default = "default_backup_retention")]
	pub retention_count: u32,
	/// Ruta absoluta a una carpeta externa (puede ser cloud-synced). Vacía = solo local.
	#[serde(default)]
	pub external_path: String,
}

impl Default for BackupSettings {
	fn default() -> Self {
		Self {
			enabled: true,
			retention_count: default_backup_retention(),
			external_path: String::new(),
		}
	}
}

impl Default for BillingSettings {
	fn default() -> Self {
		Self {
			razon_social: String::new(),
			nit: String::new(),
			direccion: String::new(),
			telefono: String::new(),
			serie_default: default_serie(),
			iva_default_pct: default_iva_pct(),
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
	pub show_sundays: bool,
	/// "12h" | "24h"
	pub time_display: String,
	pub default_duration_minutes: u32,
	pub document_types: Vec<String>,
	pub default_document_type: String,
	pub service_types: Vec<ServiceTypeSetting>,
	/// Permite al administrador eliminar citas pasadas. Desactivado por defecto.
	#[serde(default)]
	pub admin_mode: bool,
	#[serde(default)]
	pub billing: BillingSettings,
	#[serde(default)]
	pub backup: BackupSettings,
}

impl Default for AppSettings {
	fn default() -> Self {
		Self {
			show_sundays: false,
			time_display: "12h".into(),
			default_duration_minutes: 60,
			document_types: vec![
				"CC".into(),
				"CE".into(),
				"TI".into(),
				"PA".into(),
				"RC".into(),
				"NIT".into(),
			],
			default_document_type: "CC".into(),
			service_types: vec![
				ServiceTypeSetting {
					id: "camara_hiperbarica".into(),
					label: "Cámara Hiperbárica".into(),
					concurrent_capacity: 2,
					suggested_price: 180_000.0,
				},
				ServiceTypeSetting {
					id: "sueroterapia".into(),
					label: "Sueroterapia".into(),
					concurrent_capacity: 2,
					suggested_price: 120_000.0,
				},
			],
			admin_mode: false,
			billing: BillingSettings::default(),
			backup: BackupSettings::default(),
		}
	}
}

impl AppSettings {
	pub fn capacity_for_service(&self, service_id: &str) -> Option<u32> {
		self.service_types
			.iter()
			.find(|s| s.id == service_id)
			.map(|s| s.concurrent_capacity)
	}
}
