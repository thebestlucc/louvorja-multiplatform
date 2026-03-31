use crate::db::models::{Service, ServiceItem};
use crate::error::AppError;
use rusqlite::Connection;

pub fn get_services(conn: &Connection) -> Result<Vec<Service>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.title, s.date, s.notes, s.created_at, s.updated_at,
                (SELECT COUNT(*) FROM service_items si WHERE si.service_id = s.id) AS item_count,
                (SELECT COUNT(*) FROM service_items si WHERE si.service_id = s.id AND si.item_type = 'hymn') AS hymn_count,
                s.week_day
         FROM services s
         ORDER BY s.date DESC, s.created_at DESC",
    )?;

    let services = stmt
        .query_map([], |row| {
            Ok(Service {
                id: row.get(0)?,
                title: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                item_count: row.get(6)?,
                hymn_count: row.get(7)?,
                week_day: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(services)
}

pub fn get_service_by_id(conn: &Connection, id: i64) -> Result<Service, AppError> {
    conn.query_row(
        "SELECT s.id, s.title, s.date, s.notes, s.created_at, s.updated_at,
                (SELECT COUNT(*) FROM service_items si WHERE si.service_id = s.id) AS item_count,
                (SELECT COUNT(*) FROM service_items si WHERE si.service_id = s.id AND si.item_type = 'hymn') AS hymn_count,
                s.week_day
         FROM services s WHERE s.id = ?1",
        [id],
        |row| {
            Ok(Service {
                id: row.get(0)?,
                title: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                item_count: row.get(6)?,
                hymn_count: row.get(7)?,
                week_day: row.get(8)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Service with id {} not found", id))
        }
        _ => AppError::Database(e),
    })
}

pub fn insert_service(
    conn: &Connection,
    title: &str,
    date: Option<&str>,
    notes: Option<&str>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO services (title, date, notes) VALUES (?1, ?2, ?3)",
        rusqlite::params![title, date, notes],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_service(
    conn: &Connection,
    id: i64,
    title: &str,
    date: Option<&str>,
    notes: Option<&str>,
) -> Result<(), AppError> {
    let affected = conn.execute(
        "UPDATE services SET title = ?1, date = ?2, notes = ?3, updated_at = datetime('now') WHERE id = ?4",
        rusqlite::params![title, date, notes, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!(
            "Service with id {} not found",
            id
        )));
    }
    Ok(())
}

pub fn delete_service(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM services WHERE id = ?1", [id])?;
    Ok(())
}

pub fn get_service_items(conn: &Connection, service_id: i64) -> Result<Vec<ServiceItem>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, service_id, item_type, item_id, title, item_order, notes
         FROM service_items
         WHERE service_id = ?1
         ORDER BY item_order",
    )?;

    let items = stmt
        .query_map([service_id], |row| {
            Ok(ServiceItem {
                id: row.get(0)?,
                service_id: row.get(1)?,
                item_type: row.get(2)?,
                item_id: row.get(3)?,
                title: row.get(4)?,
                item_order: row.get(5)?,
                notes: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
}

pub fn insert_service_item(
    conn: &Connection,
    service_id: i64,
    item_type: &str,
    title: &str,
    item_id: Option<i64>,
    notes: Option<&str>,
) -> Result<i64, AppError> {
    let next_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(item_order), 0) + 1 FROM service_items WHERE service_id = ?1",
            [service_id],
            |row| row.get(0),
        )
        .unwrap_or(1);

    conn.execute(
        "INSERT INTO service_items (service_id, item_type, title, item_id, item_order, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![service_id, item_type, title, item_id, next_order, notes],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_service_item_by_id(conn: &Connection, id: i64) -> Result<ServiceItem, AppError> {
    conn.query_row(
        "SELECT id, service_id, item_type, item_id, title, item_order, notes
         FROM service_items WHERE id = ?1",
        [id],
        |row| {
            Ok(ServiceItem {
                id: row.get(0)?,
                service_id: row.get(1)?,
                item_type: row.get(2)?,
                item_id: row.get(3)?,
                title: row.get(4)?,
                item_order: row.get(5)?,
                notes: row.get(6)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("ServiceItem with id {} not found", id))
        }
        _ => AppError::Database(e),
    })
}

pub fn update_service_item(
    conn: &Connection,
    id: i64,
    title: &str,
    notes: Option<&str>,
) -> Result<(), AppError> {
    let affected = conn.execute(
        "UPDATE service_items SET title = ?1, notes = ?2 WHERE id = ?3",
        rusqlite::params![title, notes, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!(
            "ServiceItem with id {} not found",
            id
        )));
    }
    Ok(())
}

pub fn delete_service_item(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM service_items WHERE id = ?1", [id])?;
    Ok(())
}

pub fn reorder_items(
    conn: &Connection,
    _service_id: i64,
    item_ids: &[i64],
) -> Result<(), AppError> {
    let mut stmt = conn.prepare("UPDATE service_items SET item_order = ?1 WHERE id = ?2")?;
    for (i, id) in item_ids.iter().enumerate() {
        stmt.execute(rusqlite::params![i as i64, id])?;
    }
    Ok(())
}

pub fn set_service_week_day(
    conn: &Connection,
    id: i64,
    week_day: Option<i32>,
) -> Result<(), AppError> {
    if let Some(day) = week_day {
        // Clear this day from any other service first (uniqueness by clearing)
        conn.execute(
            "UPDATE services SET week_day = NULL WHERE week_day = ?1 AND id != ?2",
            rusqlite::params![day, id],
        )?;
    }
    let affected = conn.execute(
        "UPDATE services SET week_day = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![week_day, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound(format!(
            "Service with id {} not found",
            id
        )));
    }
    Ok(())
}

pub fn duplicate_service_with_items(conn: &Connection, id: i64) -> Result<i64, AppError> {
    let service = get_service_by_id(conn, id)?;
    let items = get_service_items(conn, id)?;

    let new_title = format!("{} (copy)", service.title);
    let new_id = insert_service(
        conn,
        &new_title,
        service.date.as_deref(),
        service.notes.as_deref(),
    )?;

    for item in items {
        conn.execute(
            "INSERT INTO service_items (service_id, item_type, title, item_id, item_order, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![new_id, item.item_type, item.title, item.item_id, item.item_order, item.notes],
        )?;
    }

    Ok(new_id)
}
