use crate::db::models::ScheduleMonthDetail;
use crate::error::AppError;

#[derive(Debug, Clone)]
struct GenerationTarget {
    id: i64,
    department_id: i64,
    service_date: String,
    people_per_day: i32,
    manual_override: bool,
    shuffle_on_generate: bool,
    group_dates_in_print: bool,
    repeat_members_in_grouped_dates: bool,
}

#[derive(Debug, Clone)]
struct DepartmentGenerationState {
    service_date: String,
    people_per_day: i32,
    assignments: Vec<i64>,
}
use chrono::{Duration, NaiveDate};
use rand::seq::SliceRandom;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};

pub fn generate_schedule_month(
    conn: &Connection,
    year: i32,
    month: i32,
    overwrite_manual: bool,
) -> Result<ScheduleMonthDetail, AppError> {
    let month_record = super::get_or_create_schedule_month(conn, year, month)?;
    let tx = conn.unchecked_transaction()?;

    let targets = {
        let mut stmt = tx.prepare(
            "SELECT sdd.id,
                    sdd.department_id,
                    sd.service_date,
                    sdd.people_per_day,
                    sdd.manual_override,
                    department.shuffle_on_generate,
                    department.group_dates_in_print,
                    department.repeat_members_in_grouped_dates
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
                service_date: row.get(2)?,
                people_per_day: row.get(3)?,
                manual_override: row.get(4)?,
                shuffle_on_generate: row.get(5)?,
                group_dates_in_print: row.get(6)?,
                repeat_members_in_grouped_dates: row.get(7)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let target_department_ids: HashSet<i64> =
        targets.iter().map(|target| target.department_id).collect();
    let shuffle_on_generate_by_department: HashMap<i64, bool> = targets
        .iter()
        .map(|target| (target.department_id, target.shuffle_on_generate))
        .collect();
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

    let mut rng = rand::thread_rng();
    for (department_id, member_ids) in &mut member_ids_by_department {
        maybe_shuffle_member_ids(
            member_ids,
            shuffle_on_generate_by_department
                .get(department_id)
                .copied()
                .unwrap_or(false),
            &mut rng,
        );
    }

    let mut cursor_by_department: HashMap<i64, usize> = HashMap::new();
    let mut generation_state_by_department: HashMap<i64, DepartmentGenerationState> =
        HashMap::new();
    let mut insert_stmt = tx.prepare(
        "INSERT INTO schedule_assignments (
            schedule_day_department_id, member_id, sort_order
         ) VALUES (?1, ?2, ?3)",
    )?;

    for target in &targets {
        if target.manual_override && !overwrite_manual {
            generation_state_by_department.remove(&target.department_id);
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
            generation_state_by_department.remove(&target.department_id);
            continue;
        };

        let should_repeat_group_assignments = target.group_dates_in_print
            && target.repeat_members_in_grouped_dates
            && generation_state_by_department
                .get(&target.department_id)
                .map(|state| {
                    state.people_per_day == target.people_per_day
                        && are_consecutive_service_dates(&state.service_date, &target.service_date)
                })
                .unwrap_or(false);

        let assignments = if should_repeat_group_assignments {
            generation_state_by_department
                .get(&target.department_id)
                .map(|state| state.assignments.clone())
                .unwrap_or_default()
        } else {
            let cursor = cursor_by_department
                .entry(target.department_id)
                .or_insert(0);
            next_assignment_member_ids(member_ids, cursor, target.people_per_day)
        };

        let generated_assignments = assignments.clone();

        for (sort_order, member_id) in assignments.into_iter().enumerate() {
            insert_stmt.execute(params![target.id, member_id, sort_order as i32])?;
        }

        if target.group_dates_in_print && target.repeat_members_in_grouped_dates {
            generation_state_by_department.insert(
                target.department_id,
                DepartmentGenerationState {
                    service_date: target.service_date.clone(),
                    people_per_day: target.people_per_day,
                    assignments: generated_assignments,
                },
            );
        } else {
            generation_state_by_department.remove(&target.department_id);
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

    super::get_schedule_month_detail(conn, year, month)
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

fn maybe_shuffle_member_ids<R: rand::Rng + ?Sized>(
    member_ids: &mut [i64],
    shuffle_on_generate: bool,
    rng: &mut R,
) {
    if shuffle_on_generate && member_ids.len() > 1 {
        member_ids.shuffle(rng);
    }
}

fn are_consecutive_service_dates(left: &str, right: &str) -> bool {
    let Ok(left_date) = NaiveDate::parse_from_str(left, "%Y-%m-%d") else {
        return false;
    };
    let Ok(right_date) = NaiveDate::parse_from_str(right, "%Y-%m-%d") else {
        return false;
    };

    right_date == left_date + Duration::days(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{rngs::StdRng, SeedableRng};

    #[test]
    fn maybe_shuffle_member_ids_respects_department_setting() {
        let mut rng = StdRng::seed_from_u64(42);
        let mut deterministic_ids = vec![1, 2, 3, 4];
        maybe_shuffle_member_ids(&mut deterministic_ids, false, &mut rng);
        assert_eq!(deterministic_ids, vec![1, 2, 3, 4]);

        let mut shuffled_ids = vec![1, 2, 3, 4];
        maybe_shuffle_member_ids(&mut shuffled_ids, true, &mut rng);
        assert_ne!(shuffled_ids, vec![1, 2, 3, 4]);

        let mut normalized_ids = shuffled_ids.clone();
        normalized_ids.sort_unstable();
        assert_eq!(normalized_ids, vec![1, 2, 3, 4]);
    }
}
