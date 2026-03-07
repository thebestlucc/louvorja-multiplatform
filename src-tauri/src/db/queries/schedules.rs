use crate::db::models::{
    ScheduleAssignment, ScheduleDay, ScheduleDayDepartment, ScheduleDayInput, ScheduleDepartment,
    ScheduleDepartmentInput, ScheduleDepartmentMember, ScheduleMonth, ScheduleMonthDetail,
};
use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
struct GenerationTarget {
    id: i64,
    department_id: i64,
    people_per_day: i32,
    manual_override: bool,
}

fn map_schedule_department_row(row: &Row) -> Result<ScheduleDepartment, rusqlite::Error> {
    Ok(ScheduleDepartment {
        id: row.get("id")?,
        code: row.get("code")?,
        name_pt: row.get("name_pt")?,
        name_en: row.get("name_en")?,
        name_es: row.get("name_es")?,
        icon: row.get("icon")?,
        color: row.get("color")?,
        people_per_day: row.get("people_per_day")?,
        sort_order: row.get("sort_order")?,
        is_system: row.get("is_system")?,
        is_active: row.get("is_active")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        members: Vec::new(),
    })
}

fn map_schedule_department_member_row(
    row: &Row,
) -> Result<ScheduleDepartmentMember, rusqlite::Error> {
    Ok(ScheduleDepartmentMember {
        id: row.get("id")?,
        department_id: row.get("department_id")?,
        name: row.get("name")?,
        sort_order: row.get("sort_order")?,
        is_active: row.get("is_active")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_schedule_month_row(row: &Row) -> Result<ScheduleMonth, rusqlite::Error> {
    Ok(ScheduleMonth {
        id: row.get("id")?,
        year: row.get("year")?,
        month: row.get("month")?,
        notes: row.get("notes")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_schedule_day_row(row: &Row) -> Result<ScheduleDay, rusqlite::Error> {
    Ok(ScheduleDay {
        id: row.get("id")?,
        schedule_month_id: row.get("schedule_month_id")?,
        service_date: row.get("service_date")?,
        label: row.get("label")?,
        source_kind: row.get("source_kind")?,
        responsible_department_id: row.get("responsible_department_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        responsible_department: None,
        departments: Vec::new(),
    })
}

fn map_schedule_day_department_row(row: &Row) -> Result<ScheduleDayDepartment, rusqlite::Error> {
    Ok(ScheduleDayDepartment {
        id: row.get("id")?,
        schedule_day_id: row.get("schedule_day_id")?,
        department_id: row.get("department_id")?,
        people_per_day: row.get("people_per_day")?,
        manual_override: row.get("manual_override")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        department: None,
        assignments: Vec::new(),
    })
}

fn trim_opt(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn ensure_valid_month(month: i32) -> Result<(), AppError> {
    if (1..=12).contains(&month) {
        Ok(())
    } else {
        Err(AppError::Internal(format!(
            "Invalid month {}. Expected a value between 1 and 12.",
            month
        )))
    }
}

fn get_schedule_department_by_id(
    conn: &Connection,
    id: i64,
) -> Result<ScheduleDepartment, AppError> {
    list_schedule_departments(conn)?
        .into_iter()
        .find(|department| department.id == id)
        .ok_or_else(|| AppError::NotFound(format!("Schedule department with id {} not found", id)))
}

fn get_schedule_month_by_id(conn: &Connection, id: i64) -> Result<ScheduleMonth, AppError> {
    conn.query_row(
        "SELECT id, year, month, notes, created_at, updated_at
         FROM schedule_months
         WHERE id = ?1",
        params![id],
        map_schedule_month_row,
    )
    .map_err(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Schedule month with id {} not found", id))
        }
        other => AppError::Database(other),
    })
}

fn get_department_people_per_day(conn: &Connection, department_id: i64) -> Result<i32, AppError> {
    conn.query_row(
        "SELECT people_per_day FROM schedule_departments WHERE id = ?1",
        params![department_id],
        |row| row.get(0),
    )
    .map_err(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!(
            "Schedule department with id {} not found",
            department_id
        )),
        other => AppError::Database(other),
    })
}

fn next_assignment_member_ids(
    member_ids: &[i64],
    cursor: &mut usize,
    people_per_day: i32,
) -> Vec<i64> {
    if member_ids.is_empty() || people_per_day <= 0 {
        return Vec::new();
    }

    let assignment_count = usize::min(people_per_day as usize, member_ids.len());
    let mut assignments = Vec::with_capacity(assignment_count);
    for offset in 0..assignment_count {
        assignments.push(member_ids[(*cursor + offset) % member_ids.len()]);
    }

    *cursor = (*cursor + assignment_count) % member_ids.len();
    assignments
}

pub fn list_schedule_departments(conn: &Connection) -> Result<Vec<ScheduleDepartment>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, code, name_pt, name_en, name_es, icon, color, people_per_day,
                sort_order, is_system, is_active, created_at, updated_at
         FROM schedule_departments
         ORDER BY sort_order ASC, id ASC",
    )?;
    let mut departments = stmt
        .query_map([], map_schedule_department_row)?
        .collect::<Result<Vec<_>, _>>()?;

    let mut members_stmt = conn.prepare(
        "SELECT id, department_id, name, sort_order, is_active, created_at, updated_at
         FROM schedule_department_members
         ORDER BY department_id ASC, sort_order ASC, id ASC",
    )?;
    let members = members_stmt
        .query_map([], map_schedule_department_member_row)?
        .collect::<Result<Vec<_>, _>>()?;

    let mut members_by_department: HashMap<i64, Vec<ScheduleDepartmentMember>> = HashMap::new();
    for member in members {
        members_by_department
            .entry(member.department_id)
            .or_default()
            .push(member);
    }

    for department in &mut departments {
        department.members = members_by_department.remove(&department.id).unwrap_or_default();
    }

    Ok(departments)
}

pub fn upsert_schedule_department(
    conn: &Connection,
    input: &ScheduleDepartmentInput,
) -> Result<ScheduleDepartment, AppError> {
    if input.people_per_day <= 0 {
        return Err(AppError::Internal(
            "Schedule departments must allow at least one person per day.".into(),
        ));
    }
    if input.icon.trim().is_empty() {
        return Err(AppError::Internal("Schedule department icon is required.".into()));
    }
    if input.color.trim().is_empty() {
        return Err(AppError::Internal("Schedule department color is required.".into()));
    }

    let code = trim_opt(input.code.as_deref());
    let name_pt = trim_opt(input.name_pt.as_deref());
    let name_en = trim_opt(input.name_en.as_deref());
    let name_es = trim_opt(input.name_es.as_deref());

    let id = if let Some(id) = input.id {
        let updated = conn.execute(
            "UPDATE schedule_departments
             SET code = ?1,
                 name_pt = ?2,
                 name_en = ?3,
                 name_es = ?4,
                 icon = ?5,
                 color = ?6,
                 people_per_day = ?7,
                 sort_order = ?8,
                 is_active = ?9,
                 updated_at = datetime('now')
             WHERE id = ?10",
            params![
                code,
                name_pt,
                name_en,
                name_es,
                input.icon.trim(),
                input.color.trim(),
                input.people_per_day,
                input.sort_order,
                input.is_active,
                id,
            ],
        )?;
        if updated == 0 {
            return Err(AppError::NotFound(format!(
                "Schedule department with id {} not found",
                id
            )));
        }
        id
    } else {
        conn.execute(
            "INSERT INTO schedule_departments (
                code, name_pt, name_en, name_es, icon, color, people_per_day,
                sort_order, is_system, is_active
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)",
            params![
                code,
                name_pt,
                name_en,
                name_es,
                input.icon.trim(),
                input.color.trim(),
                input.people_per_day,
                input.sort_order,
                input.is_active,
            ],
        )?;
        conn.last_insert_rowid()
    };

    get_schedule_department_by_id(conn, id)
}

pub fn delete_schedule_department(conn: &Connection, id: i64) -> Result<(), AppError> {
    let is_system: bool = conn
        .query_row(
            "SELECT is_system FROM schedule_departments WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Schedule department with id {} not found", id))
            }
            other => AppError::Database(other),
        })?;

    if is_system {
        return Err(AppError::Internal(
            "System schedule departments cannot be deleted.".into(),
        ));
    }

    conn.execute(
        "DELETE FROM schedule_departments WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn replace_department_members(
    conn: &Connection,
    department_id: i64,
    members: &[String],
) -> Result<(), AppError> {
    get_schedule_department_by_id(conn, department_id)?;

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM schedule_department_members WHERE department_id = ?1",
        params![department_id],
    )?;

    let mut insert_stmt = tx.prepare(
        "INSERT INTO schedule_department_members (
            department_id, name, sort_order, is_active
         ) VALUES (?1, ?2, ?3, 1)",
    )?;
    for (index, member_name) in members
        .iter()
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
        .enumerate()
    {
        insert_stmt.execute(params![department_id, member_name, index as i32])?;
    }
    drop(insert_stmt);

    tx.execute(
        "UPDATE schedule_departments
         SET updated_at = datetime('now')
         WHERE id = ?1",
        params![department_id],
    )?;
    tx.commit()?;
    Ok(())
}

pub fn get_or_create_schedule_month(
    conn: &Connection,
    year: i32,
    month: i32,
) -> Result<ScheduleMonth, AppError> {
    ensure_valid_month(month)?;

    conn.execute(
        "INSERT INTO schedule_months (year, month)
         VALUES (?1, ?2)
         ON CONFLICT(year, month) DO NOTHING",
        params![year, month],
    )?;

    conn.query_row(
        "SELECT id, year, month, notes, created_at, updated_at
         FROM schedule_months
         WHERE year = ?1 AND month = ?2",
        params![year, month],
        map_schedule_month_row,
    )
    .map_err(AppError::Database)
}

pub fn replace_schedule_month_days(
    conn: &Connection,
    month_id: i64,
    days: &[ScheduleDayInput],
) -> Result<(), AppError> {
    get_schedule_month_by_id(conn, month_id)?;

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM schedule_days WHERE schedule_month_id = ?1",
        params![month_id],
    )?;

    let mut insert_day_stmt = tx.prepare(
        "INSERT INTO schedule_days (
            schedule_month_id, service_date, label, source_kind, responsible_department_id
         ) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;
    let mut insert_day_department_stmt = tx.prepare(
        "INSERT INTO schedule_day_departments (
            schedule_day_id, department_id, people_per_day
         ) VALUES (?1, ?2, ?3)",
    )?;

    for day in days {
        let service_date = day.service_date.trim();
        if service_date.is_empty() {
            return Err(AppError::Internal(
                "Schedule day service_date cannot be empty.".into(),
            ));
        }
        let source_kind = day
            .source_kind
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("manual");

        insert_day_stmt.execute(params![
            month_id,
            service_date,
            trim_opt(day.label.as_deref()),
            source_kind,
            day.responsible_department_id,
        ])?;
        let day_id = tx.last_insert_rowid();

        let mut seen_department_ids = HashSet::new();
        for department_id in &day.department_ids {
            if !seen_department_ids.insert(*department_id) {
                continue;
            }
            let people_per_day = get_department_people_per_day(&tx, *department_id)?;
            insert_day_department_stmt.execute(params![day_id, department_id, people_per_day])?;
        }
    }
    drop(insert_day_department_stmt);
    drop(insert_day_stmt);

    tx.execute(
        "UPDATE schedule_months
         SET updated_at = datetime('now')
         WHERE id = ?1",
        params![month_id],
    )?;
    tx.commit()?;
    Ok(())
}

pub fn generate_schedule_month(
    conn: &Connection,
    year: i32,
    month: i32,
    overwrite_manual: bool,
) -> Result<ScheduleMonthDetail, AppError> {
    let month_record = get_or_create_schedule_month(conn, year, month)?;
    let tx = conn.unchecked_transaction()?;

    let targets = {
        let mut stmt = tx.prepare(
            "SELECT sdd.id,
                    sdd.department_id,
                    sdd.people_per_day,
                    sdd.manual_override
             FROM schedule_day_departments sdd
             JOIN schedule_days sd ON sd.id = sdd.schedule_day_id
             JOIN schedule_departments department ON department.id = sdd.department_id
             WHERE sd.schedule_month_id = ?1
             ORDER BY sd.service_date ASC, department.sort_order ASC, sdd.id ASC",
        )?;
        let rows = stmt.query_map(params![month_record.id], |row| {
            Ok(GenerationTarget {
                id: row.get(0)?,
                department_id: row.get(1)?,
                people_per_day: row.get(2)?,
                manual_override: row.get(3)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let target_department_ids: HashSet<i64> =
        targets.iter().map(|target| target.department_id).collect();
    let mut member_ids_by_department: HashMap<i64, Vec<i64>> = HashMap::new();
    if !target_department_ids.is_empty() {
        let mut stmt = tx.prepare(
            "SELECT id, department_id
             FROM schedule_department_members
             WHERE is_active = 1
             ORDER BY department_id ASC, sort_order ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))?;
        let member_rows = rows.collect::<Result<Vec<_>, _>>()?;

        for (member_id, department_id) in member_rows {
            if target_department_ids.contains(&department_id) {
                member_ids_by_department
                    .entry(department_id)
                    .or_default()
                    .push(member_id);
            }
        }
    }

    let mut cursor_by_department: HashMap<i64, usize> = HashMap::new();
    let mut insert_stmt = tx.prepare(
        "INSERT INTO schedule_assignments (
            schedule_day_department_id, member_id, sort_order
         ) VALUES (?1, ?2, ?3)",
    )?;

    for target in &targets {
        if target.manual_override && !overwrite_manual {
            continue;
        }

        tx.execute(
            "DELETE FROM schedule_assignments WHERE schedule_day_department_id = ?1",
            params![target.id],
        )?;
        tx.execute(
            "UPDATE schedule_day_departments
             SET manual_override = 0,
                 updated_at = datetime('now')
             WHERE id = ?1",
            params![target.id],
        )?;

        let Some(member_ids) = member_ids_by_department.get(&target.department_id) else {
            continue;
        };

        let cursor = cursor_by_department
            .entry(target.department_id)
            .or_insert(0);
        let assignments = next_assignment_member_ids(member_ids, cursor, target.people_per_day);
        for (sort_order, member_id) in assignments.into_iter().enumerate() {
            insert_stmt.execute(params![target.id, member_id, sort_order as i32])?;
        }
    }
    drop(insert_stmt);

    tx.execute(
        "UPDATE schedule_months
         SET updated_at = datetime('now')
         WHERE id = ?1",
        params![month_record.id],
    )?;
    tx.commit()?;

    get_schedule_month_detail(conn, year, month)
}

pub fn get_schedule_month_detail(
    conn: &Connection,
    year: i32,
    month: i32,
) -> Result<ScheduleMonthDetail, AppError> {
    let month_record = get_or_create_schedule_month(conn, year, month)?;
    let departments = list_schedule_departments(conn)?;

    let departments_by_id: HashMap<i64, ScheduleDepartment> = departments
        .iter()
        .cloned()
        .map(|department| (department.id, department))
        .collect();

    let mut days_stmt = conn.prepare(
        "SELECT id, schedule_month_id, service_date, label, source_kind,
                responsible_department_id, created_at, updated_at
         FROM schedule_days
         WHERE schedule_month_id = ?1
         ORDER BY service_date ASC, id ASC",
    )?;
    let mut days = days_stmt
        .query_map(params![month_record.id], map_schedule_day_row)?
        .collect::<Result<Vec<_>, _>>()?;

    let mut day_departments_stmt = conn.prepare(
        "SELECT sdd.id, sdd.schedule_day_id, sdd.department_id, sdd.people_per_day,
                sdd.manual_override, sdd.created_at, sdd.updated_at
         FROM schedule_day_departments sdd
         JOIN schedule_days sd ON sd.id = sdd.schedule_day_id
         WHERE sd.schedule_month_id = ?1
         ORDER BY sd.service_date ASC, sdd.id ASC",
    )?;
    let day_departments = day_departments_stmt
        .query_map(params![month_record.id], map_schedule_day_department_row)?
        .collect::<Result<Vec<_>, _>>()?;

    let mut day_departments_by_day: HashMap<i64, Vec<ScheduleDayDepartment>> = HashMap::new();
    for mut day_department in day_departments {
        day_department.department = departments_by_id.get(&day_department.department_id).cloned();
        day_departments_by_day
            .entry(day_department.schedule_day_id)
            .or_default()
            .push(day_department);
    }

    let mut assignments_stmt = conn.prepare(
        "SELECT sa.id,
                sa.schedule_day_department_id,
                sa.member_id,
                sa.sort_order,
                sa.created_at,
                sdm.id,
                sdm.department_id,
                sdm.name,
                sdm.sort_order,
                sdm.is_active,
                sdm.created_at,
                sdm.updated_at
         FROM schedule_assignments sa
         JOIN schedule_day_departments sdd ON sdd.id = sa.schedule_day_department_id
         JOIN schedule_days sd ON sd.id = sdd.schedule_day_id
         JOIN schedule_department_members sdm ON sdm.id = sa.member_id
         WHERE sd.schedule_month_id = ?1
         ORDER BY sdd.schedule_day_id ASC, sa.sort_order ASC, sa.id ASC",
    )?;
    let assignments = assignments_stmt
        .query_map(params![month_record.id], |row| {
            Ok(ScheduleAssignment {
                id: row.get(0)?,
                schedule_day_department_id: row.get(1)?,
                member_id: row.get(2)?,
                sort_order: row.get(3)?,
                created_at: row.get(4)?,
                member: Some(ScheduleDepartmentMember {
                    id: row.get(5)?,
                    department_id: row.get(6)?,
                    name: row.get(7)?,
                    sort_order: row.get(8)?,
                    is_active: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                }),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut assignments_by_day_department: HashMap<i64, Vec<ScheduleAssignment>> = HashMap::new();
    for assignment in assignments {
        assignments_by_day_department
            .entry(assignment.schedule_day_department_id)
            .or_default()
            .push(assignment);
    }

    for day_departments in day_departments_by_day.values_mut() {
        for day_department in day_departments {
            day_department.assignments = assignments_by_day_department
                .remove(&day_department.id)
                .unwrap_or_default();
        }
    }

    for day in &mut days {
        day.responsible_department = day
            .responsible_department_id
            .and_then(|department_id| departments_by_id.get(&department_id).cloned());
        day.departments = day_departments_by_day.remove(&day.id).unwrap_or_default();
    }

    Ok(ScheduleMonthDetail {
        month: month_record,
        departments,
        days,
    })
}

pub fn save_day_assignments(
    conn: &Connection,
    day_department_id: i64,
    member_ids: &[i64],
) -> Result<(), AppError> {
    let department_id: i64 = conn
        .query_row(
            "SELECT department_id
             FROM schedule_day_departments
             WHERE id = ?1",
            params![day_department_id],
            |row| row.get(0),
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!(
                "Schedule day department with id {} not found",
                day_department_id
            )),
            other => AppError::Database(other),
        })?;

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE schedule_day_departments
         SET manual_override = 1,
             updated_at = datetime('now')
         WHERE id = ?1",
        params![day_department_id],
    )?;
    tx.execute(
        "DELETE FROM schedule_assignments WHERE schedule_day_department_id = ?1",
        params![day_department_id],
    )?;

    let mut insert_stmt = tx.prepare(
        "INSERT INTO schedule_assignments (
            schedule_day_department_id, member_id, sort_order
         ) VALUES (?1, ?2, ?3)",
    )?;
    let mut seen_member_ids = HashSet::new();
    for (index, member_id) in member_ids.iter().enumerate() {
        if !seen_member_ids.insert(*member_id) {
            continue;
        }

        let exists: Option<i64> = tx
            .query_row(
                "SELECT id
                 FROM schedule_department_members
                 WHERE id = ?1 AND department_id = ?2",
                params![member_id, department_id],
                |row| row.get(0),
            )
            .optional()?;

        if exists.is_none() {
            return Err(AppError::Internal(format!(
                "Member {} does not belong to schedule department {}.",
                member_id, department_id
            )));
        }

        insert_stmt.execute(params![day_department_id, member_id, index as i32])?;
    }
    drop(insert_stmt);

    tx.commit()?;
    Ok(())
}

pub fn set_schedule_day_responsible_department(
    conn: &Connection,
    schedule_day_id: i64,
    responsible_department_id: Option<i64>,
) -> Result<(), AppError> {
    if let Some(department_id) = responsible_department_id {
        get_schedule_department_by_id(conn, department_id)?;
    }

    let updated = conn.execute(
        "UPDATE schedule_days
         SET responsible_department_id = ?1,
             updated_at = datetime('now')
         WHERE id = ?2",
        params![responsible_department_id, schedule_day_id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound(format!(
            "Schedule day with id {} not found",
            schedule_day_id
        )));
    }

    conn.execute(
        "UPDATE schedule_months
         SET updated_at = datetime('now')
         WHERE id = (
             SELECT schedule_month_id
             FROM schedule_days
             WHERE id = ?1
         )",
        params![schedule_day_id],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::ScheduleDepartmentInput;

    fn setup_schedule_department(
        conn: &Connection,
        code: &str,
        people_per_day: i32,
        members: &[&str],
    ) -> ScheduleDepartment {
        let department = upsert_schedule_department(
            conn,
            &ScheduleDepartmentInput {
                id: None,
                code: Some(code.to_owned()),
                name_pt: Some(format!("Departamento {code}")),
                name_en: Some(format!("Department {code}")),
                name_es: Some(format!("Departamento {code}")),
                icon: "users".into(),
                color: "#225577".into(),
                people_per_day,
                sort_order: 100,
                is_active: true,
            },
        )
        .expect("create schedule department");

        replace_department_members(
            conn,
            department.id,
            &members.iter().map(|member| (*member).to_owned()).collect::<Vec<_>>(),
        )
        .expect("replace department members");

        list_schedule_departments(conn)
            .expect("list departments")
            .into_iter()
            .find(|item| item.id == department.id)
            .expect("department after member replace")
    }

    fn assignment_names_for_department(
        detail: &ScheduleMonthDetail,
        department_id: i64,
    ) -> Vec<Vec<String>> {
        detail
            .days
            .iter()
            .map(|day| {
                day.departments
                    .iter()
                    .find(|item| item.department_id == department_id)
                    .expect("department attached to day")
                    .assignments
                    .iter()
                    .map(|assignment| {
                        assignment
                            .member
                            .as_ref()
                            .expect("assignment member")
                            .name
                            .clone()
                    })
                    .collect::<Vec<_>>()
            })
            .collect()
    }

    #[test]
    fn creates_and_reads_empty_schedule_month() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        crate::db::migrations::run_migrations(&conn).expect("run migrations");

        let month = get_or_create_schedule_month(&conn, 2026, 3).expect("create schedule month");
        assert_eq!(month.year, 2026);
        assert_eq!(month.month, 3);

        let detail = get_schedule_month_detail(&conn, 2026, 3).expect("load schedule month detail");
        assert_eq!(detail.month.id, month.id);
        assert_eq!(detail.month.year, 2026);
        assert_eq!(detail.month.month, 3);
        assert!(!detail.departments.is_empty(), "seeded departments missing");
        assert!(detail.days.is_empty(), "new schedule month should not have days");
    }

    #[test]
    fn generation_does_not_repeat_before_pool_exhaustion() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        crate::db::migrations::run_migrations(&conn).expect("run migrations");

        let department = setup_schedule_department(&conn, "gen_rotation", 1, &["Ana", "Bia", "Carol"]);
        let month = get_or_create_schedule_month(&conn, 2026, 3).expect("create month");
        replace_schedule_month_days(
            &conn,
            month.id,
            &[
                ScheduleDayInput {
                    service_date: "2026-03-01".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
                ScheduleDayInput {
                    service_date: "2026-03-08".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
                ScheduleDayInput {
                    service_date: "2026-03-15".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
            ],
        )
        .expect("attach days");

        let detail =
            generate_schedule_month(&conn, 2026, 3, false).expect("generate schedule month");

        assert_eq!(
            assignment_names_for_department(&detail, department.id),
            vec![
                vec!["Ana".to_owned()],
                vec!["Bia".to_owned()],
                vec!["Carol".to_owned()],
            ]
        );
    }

    #[test]
    fn generation_wraps_when_member_pool_is_smaller_than_required_slots() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        crate::db::migrations::run_migrations(&conn).expect("run migrations");

        let department = setup_schedule_department(&conn, "gen_wrap", 2, &["Ana", "Bia", "Carol"]);
        let month = get_or_create_schedule_month(&conn, 2026, 3).expect("create month");
        replace_schedule_month_days(
            &conn,
            month.id,
            &[
                ScheduleDayInput {
                    service_date: "2026-03-01".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
                ScheduleDayInput {
                    service_date: "2026-03-08".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
            ],
        )
        .expect("attach days");

        let detail =
            generate_schedule_month(&conn, 2026, 3, false).expect("generate schedule month");

        assert_eq!(
            assignment_names_for_department(&detail, department.id),
            vec![
                vec!["Ana".to_owned(), "Bia".to_owned()],
                vec!["Carol".to_owned(), "Ana".to_owned()],
            ]
        );
    }

    #[test]
    fn generation_skips_manual_overrides_by_default() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        crate::db::migrations::run_migrations(&conn).expect("run migrations");

        let department = setup_schedule_department(&conn, "gen_skip_manual", 1, &["Ana", "Bia", "Carol"]);
        let month = get_or_create_schedule_month(&conn, 2026, 3).expect("create month");
        replace_schedule_month_days(
            &conn,
            month.id,
            &[
                ScheduleDayInput {
                    service_date: "2026-03-01".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
                ScheduleDayInput {
                    service_date: "2026-03-08".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
            ],
        )
        .expect("attach days");

        let initial_detail = get_schedule_month_detail(&conn, 2026, 3).expect("initial detail");
        let first_day_department = &initial_detail.days[0].departments[0];
        let carol_member_id = department
            .members
            .iter()
            .find(|member| member.name == "Carol")
            .expect("carol member")
            .id;
        save_day_assignments(&conn, first_day_department.id, &[carol_member_id])
            .expect("save manual assignments");

        let detail =
            generate_schedule_month(&conn, 2026, 3, false).expect("generate schedule month");

        assert_eq!(
            assignment_names_for_department(&detail, department.id),
            vec![vec!["Carol".to_owned()], vec!["Ana".to_owned()]]
        );
        assert!(detail.days[0].departments[0].manual_override);
        assert!(!detail.days[1].departments[0].manual_override);
    }

    #[test]
    fn generation_overwrites_manual_overrides_when_requested() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        crate::db::migrations::run_migrations(&conn).expect("run migrations");

        let department =
            setup_schedule_department(&conn, "gen_overwrite_manual", 1, &["Ana", "Bia", "Carol"]);
        let month = get_or_create_schedule_month(&conn, 2026, 3).expect("create month");
        replace_schedule_month_days(
            &conn,
            month.id,
            &[
                ScheduleDayInput {
                    service_date: "2026-03-01".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
                ScheduleDayInput {
                    service_date: "2026-03-08".into(),
                    label: None,
                    source_kind: Some("pattern".into()),
                    responsible_department_id: None,
                    department_ids: vec![department.id],
                },
            ],
        )
        .expect("attach days");

        let initial_detail = get_schedule_month_detail(&conn, 2026, 3).expect("initial detail");
        let first_day_department = &initial_detail.days[0].departments[0];
        let carol_member_id = department
            .members
            .iter()
            .find(|member| member.name == "Carol")
            .expect("carol member")
            .id;
        save_day_assignments(&conn, first_day_department.id, &[carol_member_id])
            .expect("save manual assignments");

        let detail =
            generate_schedule_month(&conn, 2026, 3, true).expect("generate schedule month");

        assert_eq!(
            assignment_names_for_department(&detail, department.id),
            vec![vec!["Ana".to_owned()], vec!["Bia".to_owned()]]
        );
        assert!(!detail.days[0].departments[0].manual_override);
        assert!(!detail.days[1].departments[0].manual_override);
    }
}
