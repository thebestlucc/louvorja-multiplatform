//! build_bible — generates bible.db from the bundled source SQLite files.
//!
//! Usage: cargo run --bin build_bible
//!
//! Reads all `resources/bible/*.sqlite` files, skips files with fewer than
//! 1000 verses (e.g. NVT_dummy), and merges them into a single
//! `resources/bible.db` with FTS5 full-text search support.

use rusqlite::{Connection, OpenFlags, params};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

fn main() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let output_path = std::path::PathBuf::from(manifest_dir)
        .join("resources")
        .join("bible.db");

    if let Err(e) = run() {
        eprintln!("[build_bible] ERROR: {}", e);
        // Clean up partial output so next run rebuilds correctly
        let _ = std::fs::remove_file(&output_path);
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let bible_dir = PathBuf::from(manifest_dir).join("resources").join("bible");
    let output_path = PathBuf::from(manifest_dir).join("resources").join("bible.db");

    // Collect all source .sqlite files
    let mut source_files: Vec<PathBuf> = std::fs::read_dir(&bible_dir)?
        .filter_map(|entry| entry.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("sqlite"))
        .collect();
    source_files.sort();

    if source_files.is_empty() {
        return Err(format!("No .sqlite files found in {}", bible_dir.display()).into());
    }

    // Timestamp optimization: skip if bible.db is newer than all source files
    if output_path.exists() {
        if let Ok(db_mtime) = mtime(&output_path) {
            let all_older = source_files
                .iter()
                .all(|f| mtime(f).map(|m| m < db_mtime).unwrap_or(false));
            if all_older {
                println!("[build_bible] bible.db is up to date, skipping");
                return Ok(());
            }
        }
    }

    println!(
        "[build_bible] Building bible.db from {} source files...",
        source_files.len()
    );

    // Create (or recreate) output database
    if output_path.exists() {
        std::fs::remove_file(&output_path)?;
    }

    let mut db = Connection::open(&output_path)?;

    // Enable WAL mode and foreign keys
    db.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;",
    )?;

    // Create schema
    db.execute_batch(
        "CREATE TABLE bible_versions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            abbreviation TEXT   NOT NULL UNIQUE,
            language    TEXT    NOT NULL DEFAULT 'pt',
            is_builtin  INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE bible_verses (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id  INTEGER NOT NULL REFERENCES bible_versions(id),
            book        TEXT    NOT NULL,
            chapter     INTEGER NOT NULL,
            verse       INTEGER NOT NULL,
            text        TEXT    NOT NULL
        );

        CREATE INDEX idx_bible_verses_lookup
            ON bible_verses(version_id, book, chapter, verse);

        CREATE VIRTUAL TABLE bible_fts USING fts5(
            text, book, content=bible_verses, content_rowid=id
        );",
    )?;

    let mut total_verses: u64 = 0;

    for source_path in &source_files {
        let file_name = source_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");

        // Open source DB read-only
        let src = Connection::open_with_flags(
            source_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;

        // Check verse count — skip dummy files (< 1000 verses)
        let verse_count: i64 =
            src.query_row("SELECT COUNT(*) FROM verse", [], |r| r.get(0))?;

        if verse_count < 1000 {
            println!(
                "[build_bible] Skipping {} ({} verses — dummy file)",
                file_name, verse_count
            );
            continue;
        }

        // Read metadata
        let abbreviation: String = src.query_row(
            "SELECT value FROM metadata WHERE key='name'",
            [],
            |r| r.get(0),
        )?;

        let copyright: String = src.query_row(
            "SELECT value FROM metadata WHERE key='copyright'",
            [],
            |r| r.get(0),
        )?;

        // Strip trailing year part " - YYYY" from copyright to get the clean name
        let full_name = strip_year_suffix(&copyright);

        println!(
            "[build_bible] Processing {} — {} ({} verses)...",
            abbreviation, full_name, verse_count
        );

        // Insert version record
        db.execute(
            "INSERT INTO bible_versions (name, abbreviation, language, is_builtin)
             VALUES (?1, ?2, 'pt', 1)",
            params![full_name, abbreviation],
        )?;
        let version_id = db.last_insert_rowid();

        // Read all verses from source
        let mut stmt = src.prepare(
            "SELECT b.name AS book_name, v.chapter, v.verse, v.text
             FROM verse v
             JOIN book b ON b.id = v.book_id
             ORDER BY v.id",
        )?;

        // Use a transaction for bulk insert performance
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

    println!(
        "[build_bible] Inserted {} total verses. Building FTS index...",
        total_verses
    );

    // Populate FTS table inside a transaction so verses and FTS stay consistent
    db.execute_batch("BEGIN IMMEDIATE")?;
    db.execute_batch(
        "INSERT INTO bible_fts(rowid, text, book)
         SELECT id, text, book FROM bible_verses;",
    )?;
    db.execute_batch("COMMIT")?;

    println!("[build_bible] Running PRAGMA optimize and VACUUM...");
    db.execute_batch("PRAGMA optimize;")?;
    // Close WAL before VACUUM to reclaim space
    db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    db.execute_batch("VACUUM;")?;

    println!(
        "[build_bible] Done! bible.db written to {}",
        output_path.display()
    );

    Ok(())
}

/// Strip trailing year suffix from copyright string.
/// e.g. "Almeida Revista e Atualizada - 1993" → "Almeida Revista e Atualizada"
fn strip_year_suffix(s: &str) -> String {
    // Match " - YYYY" at end of string (4-digit year)
    let s = s.trim();
    if let Some(pos) = s.rfind(" - ") {
        let suffix = &s[pos + 3..];
        if suffix.len() == 4 && suffix.chars().all(|c| c.is_ascii_digit()) {
            return s[..pos].trim().to_string();
        }
    }
    s.to_string()
}

/// Get the modification time of a file as SystemTime.
fn mtime(path: &Path) -> Result<SystemTime, std::io::Error> {
    path.metadata()?.modified()
}
