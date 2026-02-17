use crate::error::AppError;
use crate::migration::{is_cancelled, table_exists, MigrationDomainReport};
use rusqlite::{params, Connection};
use std::sync::atomic::AtomicBool;

pub fn import_hymns_domain(
    source: &Connection,
    target: &mut Connection,
    replace_existing: bool,
    cancel_flag: &AtomicBool,
) -> Result<MigrationDomainReport, AppError> {
    is_cancelled(cancel_flag)?;

    if !table_exists(source, "hymns")? {
        return Err(AppError::Internal(
            "Source database does not contain hymns table.".to_string(),
        ));
    }

    let tx = target.transaction()?;

    if replace_existing {
        tx.execute("DELETE FROM audio_sync_points", [])?;
        tx.execute("DELETE FROM hymns_fts", [])?;
        tx.execute("DELETE FROM hymns", [])?;
    }

    let mut imported = 0u32;
    let mut skipped = 0u32;

    {
        let mut select_hymns = source.prepare(
            "SELECT id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at
             FROM hymns
             ORDER BY id ASC",
        )?;
        let mut rows = select_hymns.query([])?;

        let insert_sql = if replace_existing {
            "INSERT INTO hymns (id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
        } else {
            "INSERT OR IGNORE INTO hymns (id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
        };
        let mut insert_hymn = tx.prepare(insert_sql)?;

        while let Some(row) = rows.next()? {
            is_cancelled(cancel_flag)?;
            let changed = insert_hymn.execute(params![
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?
            ])?;

            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }

    if table_exists(source, "audio_sync_points")? {
        let mut select_sync_points = source.prepare(
            "SELECT id, hymn_id, slide_index, timestamp_ms FROM audio_sync_points ORDER BY id ASC",
        )?;
        let mut rows = select_sync_points.query([])?;

        let insert_sql = if replace_existing {
            "INSERT INTO audio_sync_points (id, hymn_id, slide_index, timestamp_ms) VALUES (?1, ?2, ?3, ?4)"
        } else {
            "INSERT OR IGNORE INTO audio_sync_points (id, hymn_id, slide_index, timestamp_ms) VALUES (?1, ?2, ?3, ?4)"
        };
        let mut insert_sync = tx.prepare(insert_sql)?;

        while let Some(row) = rows.next()? {
            is_cancelled(cancel_flag)?;
            let changed = insert_sync.execute(params![
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?
            ])?;
            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }

    tx.execute_batch(
        "
        DELETE FROM hymns_fts;
        INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
        SELECT id, title, lyrics, author, album FROM hymns;
        ",
    )?;

    tx.commit()?;

    Ok(MigrationDomainReport {
        domain: "hymns".to_string(),
        imported,
        skipped,
    })
}
