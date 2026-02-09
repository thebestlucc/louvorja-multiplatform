use rusqlite::Connection;
use crate::error::AppError;

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );"
    )?;

    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )?;

    if current_version < 1 {
        migrate_v1(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (1)", [])?;
    }

    Ok(())
}

fn migrate_v1(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS hymns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER,
            title TEXT NOT NULL,
            author TEXT,
            album TEXT,
            lyrics TEXT,
            chords TEXT,
            audio_path TEXT,
            category TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bible_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            abbreviation TEXT NOT NULL UNIQUE,
            language TEXT NOT NULL DEFAULT 'pt',
            file_path TEXT
        );

        CREATE TABLE IF NOT EXISTS bible_verses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL REFERENCES bible_versions(id),
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            text TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS presentations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT,
            aspect_ratio TEXT NOT NULL DEFAULT '16:9',
            file_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS slides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            presentation_id INTEGER NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
            slide_index INTEGER NOT NULL,
            slide_type TEXT NOT NULL DEFAULT 'text',
            content TEXT NOT NULL DEFAULT '{}',
            notes TEXT,
            transition TEXT
        );

        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            date TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS service_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            item_type TEXT NOT NULL,
            item_id INTEGER,
            title TEXT NOT NULL,
            item_order INTEGER NOT NULL,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS monitor_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monitor_id TEXT NOT NULL,
            role TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_hymns_number ON hymns(number);
        CREATE INDEX IF NOT EXISTS idx_hymns_title ON hymns(title);
        CREATE INDEX IF NOT EXISTS idx_bible_verses_lookup ON bible_verses(version_id, book, chapter, verse);
        CREATE INDEX IF NOT EXISTS idx_slides_presentation ON slides(presentation_id, slide_index);
        CREATE INDEX IF NOT EXISTS idx_service_items_service ON service_items(service_id, item_order);
        CREATE INDEX IF NOT EXISTS idx_favorites_type ON favorites(item_type, item_id);

        -- FTS5 virtual tables
        CREATE VIRTUAL TABLE IF NOT EXISTS hymns_fts USING fts5(
            title, lyrics, author, album, content=hymns, content_rowid=id
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS bible_fts USING fts5(
            text, book, content=bible_verses, content_rowid=id
        );
        "
    )?;

    Ok(())
}
