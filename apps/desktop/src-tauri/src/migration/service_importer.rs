use crate::error::AppError;
use crate::migration::{is_cancelled, table_exists, MigrationDomainReport};
use rusqlite::{params, Connection};
use std::sync::atomic::AtomicBool;

pub fn import_services_domain(
    source: &Connection,
    target: &mut Connection,
    replace_existing: bool,
    cancel_flag: &AtomicBool,
) -> Result<MigrationDomainReport, AppError> {
    is_cancelled(cancel_flag)?;

    // Legacy DB does not have 'services'/'service_items' tables — return empty report gracefully.
    if !table_exists(source, "services")? || !table_exists(source, "service_items")? {
        return Ok(MigrationDomainReport {
            domain: "services".to_string(),
            imported: 0,
            skipped: 0,
        });
    }

    let tx = target.transaction()?;

    if replace_existing {
        tx.execute("DELETE FROM service_items", [])?;
        tx.execute("DELETE FROM services", [])?;
    }

    let mut imported = 0u32;
    let mut skipped = 0u32;

    {
        let mut select_services = source.prepare(
            "SELECT id, title, date, notes, created_at, updated_at FROM services ORDER BY id ASC",
        )?;
        let mut rows = select_services.query([])?;

        let insert_sql = if replace_existing {
            "INSERT INTO services (id, title, date, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        } else {
            "INSERT OR IGNORE INTO services (id, title, date, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        };
        let mut insert_service = tx.prepare(insert_sql)?;

        while let Some(row) = rows.next()? {
            is_cancelled(cancel_flag)?;
            let changed = insert_service.execute(params![
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?
            ])?;
            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }

    {
        let mut select_items = source.prepare(
            "SELECT id, service_id, item_type, item_id, title, item_order, notes FROM service_items ORDER BY id ASC",
        )?;
        let mut rows = select_items.query([])?;
        let insert_sql = if replace_existing {
            "INSERT INTO service_items (id, service_id, item_type, item_id, title, item_order, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        } else {
            "INSERT OR IGNORE INTO service_items (id, service_id, item_type, item_id, title, item_order, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        };
        let mut insert_item = tx.prepare(insert_sql)?;
        let mut processed = 0u32;

        while let Some(row) = rows.next()? {
            if processed % 250 == 0 {
                is_cancelled(cancel_flag)?;
            }
            processed = processed.saturating_add(1);
            let changed = insert_item.execute(params![
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, Option<String>>(6)?
            ])?;
            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }

    tx.commit()?;

    Ok(MigrationDomainReport {
        domain: "services".to_string(),
        imported,
        skipped,
    })
}
