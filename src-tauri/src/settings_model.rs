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

fn default_package_plans() -> Vec<PackagePlanSetting> {
	Vec::new()
}

/// Plan de paquete de sesiones configurable por tipo de servicio (precio total antes de IVA).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackagePlanSetting {
	pub id: String,
	pub label: String,
	pub session_count: i64,
	pub price_before_vat: f64,
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
	#[serde(default = "default_package_plans")]
	pub package_plans: Vec<PackagePlanSetting>,
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

fn default_oxygen_service_type() -> String {
	"camara_hiperbarica".into()
}

fn default_oxygen_per_session() -> f64 {
	1.0
}

/// Parámetros para comparar sesiones de cámara con consumo teórico de oxígeno.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OxygenSettings {
	/// Etiqueta mostrada en informes (p. ej. "m³", "unidades").
	#[serde(default)]
	pub units_label: String,
	/// Consumo teórico por sesión de cámara (misma unidad que medidores / norma interna).
	#[serde(default = "default_oxygen_per_session")]
	pub per_hyperbaric_session: f64,
	/// `service_types.id` usado para contar sesiones (por defecto cámara hiperbárica).
	#[serde(default = "default_oxygen_service_type")]
	pub service_type_id: String,
}

impl Default for OxygenSettings {
	fn default() -> Self {
		Self {
			units_label: "unidad(es)".into(),
			per_hyperbaric_session: default_oxygen_per_session(),
			service_type_id: default_oxygen_service_type(),
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
	/// Permite al administrador eliminar citas pasadas. No persiste entre sesiones: al iniciar la app se fuerza a false en BD.
	#[serde(default)]
	pub admin_mode: bool,
	#[serde(default)]
	pub billing: BillingSettings,
	#[serde(default)]
	pub backup: BackupSettings,
	#[serde(default)]
	pub oxygen: OxygenSettings,
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
					package_plans: Vec::new(),
				},
				ServiceTypeSetting {
					id: "sueroterapia".into(),
					label: "Sueroterapia".into(),
					concurrent_capacity: 2,
					suggested_price: 120_000.0,
					package_plans: Vec::new(),
				},
			],
			admin_mode: false,
			billing: BillingSettings::default(),
			backup: BackupSettings::default(),
			oxygen: OxygenSettings::default(),
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

	pub fn label_for_service(&self, service_id: &str) -> Option<&str> {
		self.service_types
			.iter()
			.find(|s| s.id == service_id)
			.map(|s| s.label.as_str())
	}
}

#[cfg(test)]
mod settings_deser_tests {
	use super::AppSettings;

	#[test]
	fn legacy_json_sin_package_plans_deserializa() {
		let json = r#"{
			"showSundays": false,
			"timeDisplay": "24h",
			"defaultDurationMinutes": 60,
			"documentTypes": ["CC"],
			"defaultDocumentType": "CC",
			"serviceTypes": [
				{
					"id": "s1",
					"label": "Servicio",
					"concurrentCapacity": 1,
					"suggestedPrice": 100000
				}
			],
			"adminMode": false,
			"billing": {},
			"backup": {}
		}"#;
		let s: AppSettings = serde_json::from_str(json).expect("parse");
		assert_eq!(s.service_types.len(), 1);
		assert!(s.service_types[0].package_plans.is_empty());
		assert_eq!(s.oxygen.service_type_id, "camara_hiperbarica");
	}
}
