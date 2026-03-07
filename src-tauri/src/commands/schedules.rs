use crate::db::models::{
    ScheduleAssignmentInput, ScheduleDayInput, ScheduleDepartment, ScheduleDepartmentInput,
    ScheduleMonthDetail, ScheduleGenerationRequest,
};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn list_schedule_departments(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ScheduleDepartment>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::list_schedule_departments(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn save_schedule_department(
    input: ScheduleDepartmentInput,
    state: tauri::State<'_, AppState>,
) -> Result<ScheduleDepartment, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::upsert_schedule_department(&conn, &input)
}

#[tauri::command]
#[specta::specta]
pub fn delete_schedule_department(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::delete_schedule_department(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn replace_schedule_department_members(
    department_id: i64,
    members: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::replace_department_members(&conn, department_id, &members)
}

#[tauri::command]
#[specta::specta]
pub fn get_schedule_month(
    year: i32,
    month: i32,
    state: tauri::State<'_, AppState>,
) -> Result<ScheduleMonthDetail, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::get_schedule_month_detail(&conn, year, month)
}

#[tauri::command]
#[specta::specta]
pub fn save_schedule_month_days(
    year: i32,
    month: i32,
    days: Vec<ScheduleDayInput>,
    state: tauri::State<'_, AppState>,
) -> Result<ScheduleMonthDetail, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let schedule_month = crate::db::queries::schedules::get_or_create_schedule_month(&conn, year, month)?;
    crate::db::queries::schedules::replace_schedule_month_days(&conn, schedule_month.id, &days)?;
    crate::db::queries::schedules::get_schedule_month_detail(&conn, year, month)
}

#[tauri::command]
#[specta::specta]
pub fn generate_schedule_month(
    input: ScheduleGenerationRequest,
    state: tauri::State<'_, AppState>,
) -> Result<ScheduleMonthDetail, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::generate_schedule_month(
        &conn,
        input.year,
        input.month,
        input.overwrite_manual,
    )
}

#[tauri::command]
#[specta::specta]
pub fn set_schedule_day_responsible_department(
    schedule_day_id: i64,
    responsible_department_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::set_schedule_day_responsible_department(
        &conn,
        schedule_day_id,
        responsible_department_id,
    )
}

#[tauri::command]
#[specta::specta]
pub fn save_schedule_day_assignments(
    input: ScheduleAssignmentInput,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::save_day_assignments(
        &conn,
        input.schedule_day_department_id,
        &input.member_ids,
    )
}

#[tauri::command]
#[specta::specta]
pub fn update_schedule_day_department_people_per_day(
    schedule_day_department_id: i64,
    people_per_day: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::update_schedule_day_department_people_per_day(
        &conn,
        schedule_day_department_id,
        people_per_day,
    )
}

#[tauri::command]
#[specta::specta]
pub fn reset_schedule_day_department_manual_override(
    schedule_day_department_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::schedules::reset_schedule_day_department_manual_override(
        &conn,
        schedule_day_department_id,
    )
}
