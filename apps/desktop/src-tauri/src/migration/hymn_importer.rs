use crate::error::AppError;
use crate::migration::{is_cancelled, table_exists, MigrationDomainReport};
use rusqlite::{params, Connection, ErrorCode};
use std::sync::atomic::AtomicBool;

// Legacy DB schema (source): musics + lyrics + albums_musics + albums + categories_albums + categories
// Target DB schema: hymns (id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at)
pub fn import_hymns_domain(
    source: &Connection,
    target: &mut Connection,
    replace_existing: bool,
    cancel_flag: &AtomicBool,
) -> Result<MigrationDomainReport, AppError> {
    is_cancelled(cancel_flag)?;

    // Legacy DB uses 'musics' + 'lyrics' tables, not 'hymns'
    if !table_exists(source, "musics")? {
        return Err(AppError::Internal(
            "Source database does not contain a 'musics' table. This does not appear to be a compatible LouvorJA legacy database.".to_string(),
        ));
    }
    if !table_exists(source, "lyrics")? {
        return Err(AppError::Internal(
            "Source database does not contain a 'lyrics' table. This does not appear to be a compatible LouvorJA legacy database.".to_string(),
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
        // Join musics with their primary album name and concatenated lyrics.
        // hymn_number: track from the hymnal-category album (slug IN ('hymnal', 'hymnal_1996')), NULL otherwise.
        // lyrics: stanzas joined with double newlines, ordered by lyric.order.
        // category: slug from the first associated category, NULL if none.
        let mut select_hymns = match source.prepare(
            "SELECT
                m.id_music,
                (SELECT am2.track
                 FROM albums_musics am2
                 INNER JOIN categories_albums ca2 ON ca2.id_album = am2.id_album
                 INNER JOIN categories c2 ON c2.id_category = ca2.id_category
                 WHERE am2.id_music = m.id_music
                   AND c2.slug IN ('hymnal', 'hymnal_1996')
                 LIMIT 1) AS number,
                m.name AS title,
                (SELECT a2.name
                 FROM albums_musics am2
                 INNER JOIN albums a2 ON a2.id_album = am2.id_album
                 WHERE am2.id_music = m.id_music
                 LIMIT 1) AS album,
                (SELECT GROUP_CONCAT(l2.lyric, char(10) || char(10))
                 FROM lyrics l2
                 WHERE l2.id_music = m.id_music
                 ORDER BY l2.`order`) AS lyrics,
                (SELECT c2.slug
                 FROM albums_musics am2
                 INNER JOIN categories_albums ca2 ON ca2.id_album = am2.id_album
                 INNER JOIN categories c2 ON c2.id_category = ca2.id_category
                 WHERE am2.id_music = m.id_music
                 LIMIT 1) AS category,
                COALESCE(m.created_at, datetime('now')) AS created_at,
                COALESCE(m.updated_at, datetime('now')) AS updated_at
             FROM musics m
             WHERE m.id_language = 'pt'
             ORDER BY m.id_music ASC",
        ) {
            Ok(stmt) => stmt,
            Err(rusqlite::Error::SqliteFailure(ref err, _))
                if err.code == ErrorCode::DatabaseCorrupt =>
            {
                eprintln!("[hymn_importer] SQLITE_CORRUPT preparing SELECT; source DB has bad pages — committing empty result");
                tx.commit()?;
                return Ok(MigrationDomainReport {
                    domain: "hymns".to_string(),
                    imported: 0,
                    skipped: 0,
                });
            }
            Err(e) => return Err(AppError::Database(e)),
        };
        let mut rows = match select_hymns.query([]) {
            Ok(r) => r,
            Err(rusqlite::Error::SqliteFailure(ref err, _))
                if err.code == ErrorCode::DatabaseCorrupt =>
            {
                eprintln!(
                    "[hymn_importer] SQLITE_CORRUPT executing SELECT; committing empty result"
                );
                tx.commit()?;
                return Ok(MigrationDomainReport {
                    domain: "hymns".to_string(),
                    imported: 0,
                    skipped: 0,
                });
            }
            Err(e) => return Err(AppError::Database(e)),
        };

        let insert_sql = if replace_existing {
            "INSERT INTO hymns (id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, NULL, ?4, ?5, NULL, NULL, ?6, NULL, ?7, ?8)"
        } else {
            "INSERT OR IGNORE INTO hymns (id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, NULL, ?4, ?5, NULL, NULL, ?6, NULL, ?7, ?8)"
        };
        let mut insert_hymn = tx.prepare(insert_sql)?;

        loop {
            // rows.next() can return SQLITE_CORRUPT if the source DB has bad pages.
            // Catch it and stop iteration early rather than aborting the whole domain.
            let row = match rows.next() {
                Ok(Some(r)) => r,
                Ok(None) => break,
                Err(rusqlite::Error::SqliteFailure(err, _))
                    if err.code == ErrorCode::DatabaseCorrupt =>
                {
                    eprintln!("[hymn_importer] SQLITE_CORRUPT while reading source; stopping row iteration with {} imported so far", imported);
                    break;
                }
                Err(e) => return Err(AppError::Database(e)),
            };

            is_cancelled(cancel_flag)?;
            let changed = insert_hymn.execute(params![
                row.get::<_, i64>(0)?,            // id_music → id
                row.get::<_, Option<i64>>(1)?,    // number (track in hymnal album, or NULL)
                row.get::<_, String>(2)?,         // name → title
                row.get::<_, Option<String>>(3)?, // album name
                row.get::<_, Option<String>>(4)?, // concatenated lyrics
                row.get::<_, Option<String>>(5)?, // category slug
                row.get::<_, String>(6)?,         // created_at
                row.get::<_, String>(7)?          // updated_at
            ])?;

            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }

    // audio_sync_points: no equivalent in legacy DB, skip gracefully.

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
