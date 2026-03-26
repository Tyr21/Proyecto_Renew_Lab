use chrono::{DateTime, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime, TimeZone};
use chrono::Timelike;

pub const DAY_START_HOUR: u32 = 7;
pub const DAY_END_HOUR: u32 = 20;

/// Antelación mínima para **nuevas** citas o al reprogramar fecha/hora (misma regla en cliente; alineado al slot de 30 min).
pub const MIN_LEAD_MINUTES_FOR_NEW_APPOINTMENT: i64 = 30;

/// Inicio de cita debe ser ≥ `now` + antelación mínima (hora local).
pub fn validate_minimum_lead_time_for_new_booking(
	appointment_date: &str,
	start_time_str: &str,
) -> Result<(), String> {
	validate_minimum_lead_time_for_new_booking_at(
		appointment_date,
		start_time_str,
		Local::now(),
	)
}

pub(crate) fn validate_minimum_lead_time_for_new_booking_at(
	appointment_date: &str,
	start_time_str: &str,
	now: DateTime<Local>,
) -> Result<(), String> {
	let date = NaiveDate::parse_from_str(appointment_date, "%Y-%m-%d")
		.map_err(|_| "Fecha de cita inválida".to_string())?;
	let start = parse_hh_mm(start_time_str)?;
	let naive_start = NaiveDateTime::new(date, start);
	let start_local = Local
		.from_local_datetime(&naive_start)
		.single()
		.ok_or_else(|| "Fecha y hora local inválidas".to_string())?;
	let limit = now + Duration::minutes(MIN_LEAD_MINUTES_FOR_NEW_APPOINTMENT);
	if start_local < limit {
		return Err(
			"La cita debe programarse con al menos 30 minutos de antelación respecto a la hora actual."
				.into(),
		);
	}
	Ok(())
}

pub fn parse_hh_mm(s: &str) -> Result<NaiveTime, String> {
	NaiveTime::parse_from_str(s, "%H:%M").map_err(|_| "Hora inválida (use HH:MM)".into())
}

pub fn minutes_since_midnight(t: NaiveTime) -> i32 {
	t.hour() as i32 * 60 + t.minute() as i32
}

pub fn is_half_hour_aligned(t: NaiveTime) -> bool {
	t.second() == 0 && t.nanosecond() == 0 && (t.minute() == 0 || t.minute() == 30)
}

pub fn is_duration_multiple_30(start: NaiveTime, end: NaiveTime) -> bool {
	let d = minutes_since_midnight(end) - minutes_since_midnight(start);
	d > 0 && d % 30 == 0
}

/// Ventana [07:00, 20:00): fin debe ser <= 20:00 en el mismo día calendario.
pub fn within_business_window(start: NaiveTime, end: NaiveTime) -> bool {
	let start_min = minutes_since_midnight(start);
	let end_min = minutes_since_midnight(end);
	let open = (DAY_START_HOUR * 60) as i32;
	let close = (DAY_END_HOUR * 60) as i32;
	start_min >= open && end_min <= close && end_min > start_min
}

pub fn overlaps_intervals(
	start_a: i32,
	end_a: i32,
	start_b: i32,
	end_b: i32,
) -> bool {
	start_a < end_b && start_b < end_a
}

pub fn now_local_naive() -> NaiveDateTime {
	Local::now().naive_local()
}

pub fn is_appointment_past(
	appointment_date: &str,
	end_time_str: &str,
) -> Result<bool, String> {
	let date = NaiveDate::parse_from_str(appointment_date, "%Y-%m-%d")
		.map_err(|_| "Fecha inválida".to_string())?;
	let end = parse_hh_mm(end_time_str)?;
	let end_dt = NaiveDateTime::new(date, end);
	Ok(now_local_naive() >= end_dt)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn overlaps_intervals_partial() {
		assert!(overlaps_intervals(420, 480, 450, 510));
	}

	#[test]
	fn overlaps_touching_no_overlap() {
		assert!(!overlaps_intervals(420, 450, 450, 480));
	}

	#[test]
	fn within_business_window_ok() {
		let s = parse_hh_mm("09:00").unwrap();
		let e = parse_hh_mm("10:00").unwrap();
		assert!(within_business_window(s, e));
	}

	#[test]
	fn within_business_window_rejects_end_after_close() {
		let s = parse_hh_mm("19:30").unwrap();
		let e = parse_hh_mm("20:30").unwrap();
		assert!(!within_business_window(s, e));
	}

	#[test]
	fn lead_time_rejects_when_start_before_limit() {
		let d = NaiveDate::parse_from_str("2025-06-15", "%Y-%m-%d").unwrap();
		let now = Local
			.from_local_datetime(&NaiveDateTime::new(
				d,
				NaiveTime::from_hms_opt(10, 0, 0).unwrap(),
			))
			.single()
			.unwrap();
		assert!(
			validate_minimum_lead_time_for_new_booking_at("2025-06-15", "10:15", now).is_err()
		);
	}

	#[test]
	fn lead_time_accepts_when_start_after_limit() {
		let d = NaiveDate::parse_from_str("2025-06-15", "%Y-%m-%d").unwrap();
		let now = Local
			.from_local_datetime(&NaiveDateTime::new(
				d,
				NaiveTime::from_hms_opt(10, 0, 0).unwrap(),
			))
			.single()
			.unwrap();
		assert!(
			validate_minimum_lead_time_for_new_booking_at("2025-06-15", "10:30", now).is_ok()
		);
	}
}
