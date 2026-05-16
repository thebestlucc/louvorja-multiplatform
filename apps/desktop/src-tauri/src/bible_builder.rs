use rusqlite::{params, Connection, OpenFlags};
use std::path::{Path, PathBuf};

/// Schema shared with `db::init_bible_db()` fallback (db/mod.rs).
pub const BIBLE_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS bible_versions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        abbreviation TEXT   NOT NULL UNIQUE,
        language    TEXT    NOT NULL DEFAULT 'pt',
        is_builtin  INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS bible_verses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        version_id  INTEGER NOT NULL REFERENCES bible_versions(id),
        book        TEXT    NOT NULL,
        chapter     INTEGER NOT NULL,
        verse       INTEGER NOT NULL,
        text        TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bible_verses_lookup
        ON bible_verses(version_id, book, chapter, verse);
";

const BIBLE_FTS_SCHEMA: &str = "
    CREATE VIRTUAL TABLE bible_fts USING fts5(
        text, book, content=bible_verses, content_rowid=id
    );
";

/// Merges `*.sqlite` translation files from `input_dir` into a single
/// `output_path` bible.db with FTS5 search. Returns `Ok(false)` if up to date.
pub fn build_bible_db(input_dir: &Path, output_path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
    let mut source_files: Vec<PathBuf> = std::fs::read_dir(input_dir)?
        .filter_map(|entry| entry.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("sqlite"))
        .collect();
    source_files.sort();

    if source_files.is_empty() {
        return Err(format!("No .sqlite files found in {}", input_dir.display()).into());
    }

    // Skip if bible.db is newer than all source files
    if let Ok(db_meta) = output_path.metadata() {
        if let Ok(db_mtime) = db_meta.modified() {
            let all_older = source_files.iter().all(|f| {
                f.metadata()
                    .and_then(|m| m.modified())
                    .map(|m| m < db_mtime)
                    .unwrap_or(false)
            });
            if all_older {
                eprintln!("[bible_builder] bible.db is up to date, skipping");
                return Ok(false);
            }
        }
    }

    eprintln!(
        "[bible_builder] Building bible.db from {} source files...",
        source_files.len()
    );

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Atomic write: build in temp file, rename on success
    let tmp_path = output_path.with_extension("db.tmp");
    let _ = std::fs::remove_file(&tmp_path); // clean up any stale temp

    let mut db = Connection::open(&tmp_path)?;

    db.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;",
    )?;

    db.execute_batch(BIBLE_SCHEMA)?;
    db.execute_batch(BIBLE_FTS_SCHEMA)?;

    let mut total_verses: u64 = 0;

    for source_path in &source_files {
        let file_name = source_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");

        let src = match Connection::open_with_flags(
            source_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        ) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[bible_builder] Skipping {} — could not open: {}", file_name, e);
                continue;
            }
        };

        let verse_count: i64 = match src.query_row("SELECT COUNT(*) FROM verse", [], |r| r.get(0)) {
            Ok(n) => n,
            Err(e) => {
                eprintln!("[bible_builder] Skipping {} — missing verse table: {}", file_name, e);
                continue;
            }
        };

        if verse_count < 1000 {
            eprintln!(
                "[bible_builder] Skipping {} ({} verses — dummy file)",
                file_name, verse_count
            );
            continue;
        }

        let abbreviation: String = match src.query_row(
            "SELECT value FROM metadata WHERE key='name'",
            [],
            |r| r.get(0),
        ) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("[bible_builder] Skipping {} — missing name metadata: {}", file_name, e);
                continue;
            }
        };

        let copyright: String = match src.query_row(
            "SELECT value FROM metadata WHERE key='copyright'",
            [],
            |r| r.get(0),
        ) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("[bible_builder] Skipping {} — missing copyright metadata: {}", file_name, e);
                continue;
            }
        };

        let full_name = strip_year_suffix(&copyright);

        eprintln!(
            "[bible_builder] Processing {} — {} ({} verses)...",
            abbreviation, full_name, verse_count
        );

        db.execute(
            "INSERT INTO bible_versions (name, abbreviation, language, is_builtin)
             VALUES (?1, ?2, 'pt', 1)",
            params![full_name, abbreviation],
        )?;
        let version_id = db.last_insert_rowid();

        let mut stmt = src.prepare(
            "SELECT b.name AS book_name, v.chapter, v.verse, v.text
             FROM verse v
             JOIN book b ON b.id = v.book_id
             ORDER BY v.id",
        )?;

        let tx = db.transaction()?;
        {
            let mut insert = tx.prepare(
                "INSERT INTO bible_verses (version_id, book, chapter, verse, text)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;

            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i32>(1)?,
                    row.get::<_, i32>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?;

            for row in rows {
                let (book, chapter, verse, text) = row?;
                insert.execute(params![version_id, book, chapter, verse, text])?;
            }
        }
        tx.commit()?;

        total_verses += verse_count as u64;
    }

    if total_verses == 0 {
        drop(db);
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!(
            "No valid Bible translations found in {}",
            input_dir.display()
        )
        .into());
    }

    eprintln!(
        "[bible_builder] Inserted {} total verses. Building FTS index...",
        total_verses
    );

    db.execute_batch("BEGIN IMMEDIATE")?;
    db.execute_batch(
        "INSERT INTO bible_fts(rowid, text, book)
         SELECT id, text, book FROM bible_verses;",
    )?;
    db.execute_batch("COMMIT")?;

    // Optimize query planner stats; checkpoint WAL to main file.
    // Skip VACUUM — the DB is freshly built with zero fragmentation.
    db.execute_batch("PRAGMA optimize;")?;
    db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;

    // Close the connection before renaming
    drop(db);

    // Remove old bible.db if it exists, then atomic rename
    if output_path.exists() {
        std::fs::remove_file(output_path)?;
    }
    std::fs::rename(&tmp_path, output_path)?;

    eprintln!(
        "[bible_builder] Done! bible.db written to {}",
        output_path.display()
    );

    Ok(true)
}

/// "Almeida Revista e Atualizada - 1993" → "Almeida Revista e Atualizada"
fn strip_year_suffix(s: &str) -> String {
    let s = s.trim();
    if let Some(pos) = s.rfind(" - ") {
        let suffix = &s[pos + 3..];
        if suffix.len() == 4 && suffix.chars().all(|c| c.is_ascii_digit()) {
            return s[..pos].trim().to_string();
        }
    }
    s.to_string()
}
