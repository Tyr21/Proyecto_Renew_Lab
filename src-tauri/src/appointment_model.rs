use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppointmentRow {
	pub id: String,
	pub patient_full_name: String,
	pub document_type: String,
	pub document_number: String,
	pub phone_dial_code: String,
	pub phone_national_number: String,
	pub birthday_month: Option<i32>,
	pub appointment_date: String,
	pub start_time: String,
	pub end_time: String,
	pub service_type: String,
	pub status: String,
	pub created_at: String,
	pub updated_at: String,
	#[serde(default)]
	pub paquete_id: Option<String>,
	/// `true` si existe al menos un registro en `ingresos` con este `cita_id`.
	#[serde(default)]
	pub is_paid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppointmentInput {
	pub patient_full_name: String,
	pub document_type: String,
	pub document_number: String,
	pub phone_dial_code: String,
	pub phone_national_number: String,
	pub birthday_month: Option<i32>,
	pub appointment_date: String,
	pub start_time: String,
	pub end_time: String,
	pub service_type: String,
	pub status: Option<String>,
	#[serde(default)]
	pub paquete_id: Option<String>,
}
