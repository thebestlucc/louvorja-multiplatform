use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDepartmentMember {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub department_id: i64,
    pub name: String,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDepartment {
    #[specta(type = i32)]
    pub id: i64,
    pub code: Option<String>,
    pub name_pt: Option<String>,
    pub name_en: Option<String>,
    pub name_es: Option<String>,
    pub icon: String,
    pub color: String,
    pub people_per_day: i32,
    pub shuffle_on_generate: bool,
    pub group_dates_in_print: bool,
    pub repeat_members_in_grouped_dates: bool,
    pub sort_order: i32,
    pub is_system: bool,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    pub members: Vec<ScheduleDepartmentMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleMonth {
    #[specta(type = i32)]
    pub id: i64,
    pub year: i32,
    pub month: i32,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleAssignment {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub schedule_day_department_id: i64,
    #[specta(type = i32)]
    pub member_id: i64,
    pub sort_order: i32,
    pub created_at: String,
    pub member: Option<ScheduleDepartmentMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDayDepartment {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub schedule_day_id: i64,
    #[specta(type = i32)]
    pub department_id: i64,
    pub people_per_day: i32,
    pub manual_override: bool,
    pub created_at: String,
    pub updated_at: String,
    pub department: Option<ScheduleDepartment>,
    pub assignments: Vec<ScheduleAssignment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDay {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub schedule_month_id: i64,
    pub service_date: String,
    pub label: Option<String>,
    pub source_kind: String,
    pub responsible_department_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub responsible_department: Option<ScheduleDepartment>,
    pub departments: Vec<ScheduleDayDepartment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleMonthDetail {
    pub month: ScheduleMonth,
    pub departments: Vec<ScheduleDepartment>,
    pub days: Vec<ScheduleDay>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDepartmentInput {
    pub id: Option<i64>,
    pub code: Option<String>,
    pub name_pt: Option<String>,
    pub name_en: Option<String>,
    pub name_es: Option<String>,
    pub icon: String,
    pub color: String,
    pub people_per_day: i32,
    pub shuffle_on_generate: bool,
    pub group_dates_in_print: bool,
    pub repeat_members_in_grouped_dates: bool,
    pub sort_order: i32,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDayInput {
    pub service_date: String,
    pub label: Option<String>,
    pub source_kind: Option<String>,
    pub responsible_department_id: Option<i64>,
    #[specta(type = Vec<i32>)]
    pub department_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleGenerationRequest {
    pub year: i32,
    pub month: i32,
    pub overwrite_manual: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleAssignmentInput {
    #[specta(type = i32)]
    pub schedule_day_department_id: i64,
    #[specta(type = Vec<i32>)]
    pub member_ids: Vec<i64>,
}
