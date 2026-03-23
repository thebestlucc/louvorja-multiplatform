# Pack Sync CDN Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the remaining missing content-DB dispatch paths (`get_hymn`, `get_albums`, `get_hymns_by_album`), then write unit tests for all the CDN-sync helper functions added in the previous session.

**Architecture:** Almost all spec changes are already coded. This plan targets the three un-wired command handlers in `commands/music.rs` that still read from the main SQLite DB rather than the downloaded content DB, plus the test coverage the spec requires. No new Tauri commands, no new bindings, no frontend changes.

**Tech Stack:** Rust, rusqlite (in-memory DB for tests), Tauri 2, existing r2d2 pool pattern in `AppState`.

---

## Codebase Context (required reading for implementers)

- **Main DB** lives at `state.db` (r2d2 pool). Hymns manually added by users are here.
- **Content DB** lives at `state.content_dbs: Arc<Mutex<HashMap<String,Pool<...>>>>`, keyed by BCP 47 tag (e.g. `"pt-BR"`). Populated from `content-{lang}.db` files downloaded from CDN.
- **`get_content_db_conn(state, conn)`** in `commands/music.rs` — already exists. Returns `Option<(PooledConnection, lang)>`. Use this pattern for every new content-DB dispatch.
- **`resolve_hymn_paths(hymns, app_data_dir)`** — already exists in `commands/music.rs`. Call this on every `Vec<Hymn>` returned from a content DB query.
- **Content DB schema** matches the legacy Delphi DB: `musics`, `albums`, `albums_musics`, `files`, `lyrics` tables. No `run_migrations()` needed — it is a read-only downloaded DB.
- Existing test pattern: `rusqlite::Connection::open_in_memory()` + `run_migrations(&conn)` for main DB tests. Content DB tests create a raw in-memory DB with a hand-rolled schema (see Task 1 for the fixture helper).

---

## File Map

| File | Change |
|---|---|
| `src-tauri/src/db/queries/music.rs` | Add 3 new content-DB query functions: `get_hymn_by_id_from_content_db`, `get_albums_from_content_db`, `get_hymns_by_album_from_content_db` |
| `src-tauri/src/commands/music.rs` | Update `get_hymn`, `get_albums`, `get_hymns_by_album` to dispatch via content DB |
| `src-tauri/src/db/queries/content_sync.rs` | Add tests for `bcp47_to_lang_code`, `save_content_db`, `init_content_db_fts`, `get_selected_languages`, `set_selected_languages` |
| `src-tauri/src/db/queries/music.rs` | Add tests for new content-DB query functions + `get_hymns_from_content_db` (already exists) |

---

## Task 1: Tests for `bcp47_to_lang_code`, `get_selected_languages`, `set_selected_languages`

**Files:**
- Modify: `src-tauri/src/db/queries/content_sync.rs` (append to `#[cfg(test)] mod tests` at line 780)

- [ ] **Step 1: Write failing tests**

Append to the existing `mod tests` block at the bottom of `content_sync.rs`:

```rust
    #[test]
    fn bcp47_to_lang_code_maps_known_tags() {
        assert_eq!(bcp47_to_lang_code("pt-BR"), "pt");
        assert_eq!(bcp47_to_lang_code("en-US"), "en");
        assert_eq!(bcp47_to_lang_code("es"),    "es");
    }

    #[test]
    fn bcp47_to_lang_code_passes_through_unknown() {
        assert_eq!(bcp47_to_lang_code("fr"), "fr");
        assert_eq!(bcp47_to_lang_code("zh-CN"), "zh-CN");
    }

    #[test]
    fn selected_languages_default_empty() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let langs = get_selected_languages(&conn);
        assert!(langs.is_empty(), "should default to empty vec");
    }

    #[test]
    fn set_and_get_selected_languages_roundtrip() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        set_selected_languages(&conn, &["pt-BR".to_string(), "es".to_string()]).unwrap();
        let langs = get_selected_languages(&conn);
        assert_eq!(langs, vec!["pt-BR".to_string(), "es".to_string()]);
    }

    #[test]
    fn set_selected_languages_overwrites_previous() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        set_selected_languages(&conn, &["pt-BR".to_string()]).unwrap();
        set_selected_languages(&conn, &["en-US".to_string()]).unwrap();
        let langs = get_selected_languages(&conn);
        assert_eq!(langs, vec!["en-US".to_string()]);
    }
```

- [ ] **Step 2: Run tests to verify they compile and pass**

```bash
cargo test --manifest-path src-tauri/Cargo.toml content_sync::tests
```

Expected: All tests PASS (functions already exist).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/queries/content_sync.rs
git commit -m "test(content_sync): add tests for bcp47_to_lang_code and selected_languages helpers"
```

---

## Task 2: Tests for `save_content_db` and `init_content_db_fts`

**Files:**
- Modify: `src-tauri/src/db/queries/content_sync.rs` (append more tests)

These two functions require a file on disk (`save_content_db`) and a content-DB schema (`init_content_db_fts`). We use `tempfile::tempdir()` for the file rename test and a hand-rolled in-memory DB for FTS init.

- [ ] **Step 1: Check `tempfile` is available in dev-dependencies**

```bash
grep "tempfile" src-tauri/Cargo.toml
```

If not found, add it:

```bash
# In src-tauri/Cargo.toml under [dev-dependencies]:
# tempfile = "3"
```

Or manually add to `src-tauri/Cargo.toml`:
```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: Add a fixture helper and tests**

Append to `mod tests` in `content_sync.rs`:

```rust
    /// Creates a minimal in-memory DB with the legacy content-DB schema.
    /// Mirrors the tables in the downloaded content DB (musics, albums, files, lyrics).
    fn make_content_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE musics (
                id_music INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                id_language TEXT,
                id_file_music INTEGER,
                id_file_instrumental_music INTEGER,
                id_file_image INTEGER,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE albums (
                id_album INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                id_language TEXT,
                id_file_image INTEGER,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE albums_musics (
                id_album INTEGER,
                id_music INTEGER,
                track INTEGER
            );
            CREATE TABLE files (
                id_file INTEGER PRIMARY KEY,
                dir TEXT,
                name TEXT
            );
            CREATE TABLE lyrics (
                id_music INTEGER,
                id_language TEXT,
                lyric TEXT
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn save_content_db_renames_tmp_to_final() {
        let dir = tempfile::tempdir().unwrap();
        let tmp_path = dir.path().join("content-pt-BR.db.tmp");
        std::fs::write(&tmp_path, b"fake db content").unwrap();

        let dest = save_content_db(&tmp_path, "pt-BR", dir.path()).unwrap();

        assert!(!tmp_path.exists(), "tmp file must be gone after rename");
        assert!(dest.exists(), "final file must exist");
        assert_eq!(dest.file_name().unwrap(), "content-pt-BR.db");
    }

    #[test]
    fn init_content_db_fts_populates_on_empty_db() {
        let conn = make_content_db();
        conn.execute(
            "INSERT INTO musics (id_music, name, id_language) VALUES (1, 'Song A', 'pt')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO lyrics (id_music, id_language, lyric) VALUES (1, 'pt', 'letra da musica')",
            [],
        ).unwrap();

        init_content_db_fts(&conn, "pt-BR").unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM musics_fts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "FTS table must have one row after init");
    }

    #[test]
    fn init_content_db_fts_is_idempotent() {
        let conn = make_content_db();
        conn.execute(
            "INSERT INTO musics (id_music, name, id_language) VALUES (1, 'Song A', 'pt')",
            [],
        ).unwrap();

        // Call twice — second call must be a no-op (row count > 0 guard)
        init_content_db_fts(&conn, "pt-BR").unwrap();
        init_content_db_fts(&conn, "pt-BR").unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM musics_fts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "idempotent call must not double-insert rows");
    }

    #[test]
    fn init_content_db_fts_empty_db_no_rows() {
        // Table exists but is empty — FTS init on DB with no musics must succeed
        let conn = make_content_db();
        init_content_db_fts(&conn, "pt-BR").unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM musics_fts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
```

- [ ] **Step 3: Run**

```bash
cargo test --manifest-path src-tauri/Cargo.toml content_sync::tests
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/db/queries/content_sync.rs
git commit -m "test(content_sync): add tests for save_content_db and init_content_db_fts"
```

---

## Task 3: Add content-DB query functions for get_hymn, get_albums, get_hymns_by_album

**Files:**
- Modify: `src-tauri/src/db/queries/music.rs`

These three functions are the query-layer counterparts to the command handlers updated in Task 4.

- [ ] **Step 1: Write failing tests first (TDD)**

Append a new `mod content_db_tests` block at the end of `music.rs` (after the existing `#[cfg(test)]` block if present, otherwise at end of file):

```rust
#[cfg(test)]
mod content_db_tests {
    use super::*;

    /// Minimal content DB schema matching the downloaded legacy DB.
    fn make_content_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE musics (
                id_music INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                id_language TEXT,
                id_file_music INTEGER,
                id_file_instrumental_music INTEGER,
                id_file_image INTEGER,
                created_at TEXT DEFAULT '',
                updated_at TEXT DEFAULT ''
            );
            CREATE TABLE albums (
                id_album INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                id_language TEXT,
                id_file_image INTEGER,
                created_at TEXT DEFAULT '',
                updated_at TEXT DEFAULT ''
            );
            CREATE TABLE albums_musics (
                id_album INTEGER,
                id_music INTEGER,
                track INTEGER
            );
            CREATE TABLE files (
                id_file INTEGER PRIMARY KEY,
                dir TEXT,
                name TEXT
            );",
        ).unwrap();
        conn
    }

    fn seed_basic(conn: &rusqlite::Connection) {
        conn.execute_batch(
            "INSERT INTO files VALUES (10, '/musics/pt/BrilhaJesus', 'song01.mp3');
             INSERT INTO files VALUES (11, '/musics/pt/BrilhaJesus', 'song01_instrumental.mp3');
             INSERT INTO files VALUES (12, '/covers', 'brj.jpg');
             INSERT INTO albums VALUES (1, '1992 - Brilha Jesus', 'pt', 12, '', '');
             INSERT INTO musics VALUES (1, 'Santo', 'pt', 10, 11, 12, '', '');
             INSERT INTO albums_musics VALUES (1, 1, 1);",
        ).unwrap();
    }

    #[test]
    fn get_hymn_by_id_from_content_db_returns_hymn() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymn = get_hymn_by_id_from_content_db(&conn, 1, "pt-BR").unwrap();
        assert_eq!(hymn.id, 1);
        assert_eq!(hymn.title, "Santo");
        assert_eq!(hymn.audio_path.as_deref(), Some("/musics/pt/BrilhaJesus/song01.mp3"));
        assert_eq!(hymn.cover_path.as_deref(), Some("/covers/brj.jpg"));
    }

    #[test]
    fn get_hymn_by_id_from_content_db_not_found() {
        let conn = make_content_db();
        seed_basic(&conn);
        let result = get_hymn_by_id_from_content_db(&conn, 999, "pt-BR");
        assert!(result.is_err(), "must return Err for unknown id");
    }

    #[test]
    fn get_albums_from_content_db_lists_album() {
        let conn = make_content_db();
        seed_basic(&conn);
        let albums = get_albums_from_content_db(&conn, "pt-BR").unwrap();
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].name, "1992 - Brilha Jesus");
        assert_eq!(albums[0].hymn_count, 1);
    }

    #[test]
    fn get_hymns_by_album_from_content_db_returns_hymns() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_by_album_from_content_db(&conn, "1992 - Brilha Jesus", "pt-BR").unwrap();
        assert_eq!(hymns.len(), 1);
        assert_eq!(hymns[0].title, "Santo");
        assert_eq!(hymns[0].number, Some(1));
    }

    #[test]
    fn get_hymns_by_album_from_content_db_empty_for_unknown_album() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_by_album_from_content_db(&conn, "Unknown Album", "pt-BR").unwrap();
        assert!(hymns.is_empty());
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure** (functions don't exist yet)

```bash
cargo test --manifest-path src-tauri/Cargo.toml db::queries::music::content_db_tests 2>&1 | head -30
```

Expected: compile error `cannot find function ...`

- [ ] **Step 3: Implement the three query functions**

Add before the `#[cfg(test)]` block in `music.rs`:

```rust
/// Fetch a single hymn from the content DB by its id_music.
pub fn get_hymn_by_id_from_content_db(
    content_db: &rusqlite::Connection,
    id: i64,
    lang_bcp47: &str,
) -> Result<crate::db::models::Hymn, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    content_db
        .query_row(
            "SELECT
                m.id_music                    AS id,
                am.track                      AS number,
                m.name                        AS title,
                NULL                          AS author,
                a.name                        AS album,
                NULL                          AS lyrics,
                NULL                          AS chords,
                fa.dir || '/' || fa.name      AS audio_path,
                fp.dir || '/' || fp.name      AS playback_path,
                'hymnal'                      AS category,
                NULL                          AS notes,
                fi.dir || '/' || fi.name      AS cover_path,
                NULL                          AS lyrics_sync,
                m.id_music                    AS api_music_id,
                COALESCE(m.created_at, '')    AS created_at,
                COALESCE(m.updated_at, '')    AS updated_at
             FROM musics m
             LEFT JOIN albums_musics am ON am.id_music = m.id_music
             LEFT JOIN albums        a  ON a.id_album  = am.id_album
             LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
             LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
             LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
             WHERE m.id_music = ?1 AND m.id_language = ?2",
            rusqlite::params![id, lang_short],
            map_hymn_row,
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Hymn {} not found in content DB", id))
            }
            other => AppError::Database(other),
        })
}

/// Returns album names + hymn counts from the content DB.
pub fn get_albums_from_content_db(
    content_db: &rusqlite::Connection,
    lang_bcp47: &str,
) -> Result<Vec<crate::db::models::Album>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let mut stmt = content_db.prepare(
        "SELECT a.name AS album, COUNT(am.id_music) AS hymn_count
         FROM albums a
         LEFT JOIN albums_musics am ON am.id_album = a.id_album
         WHERE a.id_language = ?1
         GROUP BY a.id_album
         ORDER BY a.name",
    )?;
    let albums = stmt
        .query_map([lang_short], |row| {
            Ok(crate::db::models::Album {
                name: row.get("album")?,
                hymn_count: row.get::<_, i64>("hymn_count")? as i32,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(albums)
}

/// Returns hymns belonging to the named album from the content DB.
pub fn get_hymns_by_album_from_content_db(
    content_db: &rusqlite::Connection,
    album: &str,
    lang_bcp47: &str,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let mut stmt = content_db.prepare(
        "SELECT
            m.id_music                    AS id,
            am.track                      AS number,
            m.name                        AS title,
            NULL                          AS author,
            a.name                        AS album,
            NULL                          AS lyrics,
            NULL                          AS chords,
            fa.dir || '/' || fa.name      AS audio_path,
            fp.dir || '/' || fp.name      AS playback_path,
            'hymnal'                      AS category,
            NULL                          AS notes,
            fi.dir || '/' || fi.name      AS cover_path,
            NULL                          AS lyrics_sync,
            m.id_music                    AS api_music_id,
            COALESCE(m.created_at, '')    AS created_at,
            COALESCE(m.updated_at, '')    AS updated_at
         FROM musics m
         JOIN albums_musics am ON am.id_music = m.id_music
         JOIN albums        a  ON a.id_album  = am.id_album
         LEFT JOIN files    fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files    fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files    fi ON fi.id_file  = m.id_file_image
         WHERE a.name = ?1 AND m.id_language = ?2
         ORDER BY am.track, m.name",
    )?;
    let hymns = stmt
        .query_map(rusqlite::params![album, lang_short], map_hymn_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}
```

- [ ] **Step 4: Run tests again — expect PASS**

```bash
cargo test --manifest-path src-tauri/Cargo.toml db::queries::music::content_db_tests
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries/music.rs
git commit -m "feat(music): add content-DB query functions for get_hymn, get_albums, get_hymns_by_album"
```

---

## Task 4: Wire content-DB dispatch into the three command handlers

**Files:**
- Modify: `src-tauri/src/commands/music.rs`

Update `get_hymn`, `get_albums`, and `get_hymns_by_album` to try the content DB first, fall back to main DB.

- [ ] **Step 1: Update `get_hymn`** (lines ~107–110 in `commands/music.rs`)

Replace:
```rust
#[tauri::command]
#[specta::specta]
pub fn get_hymn(id: i64, state: tauri::State<'_, AppState>) -> Result<Hymn, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::music::get_hymn_by_id(&conn, id)
}
```

With:
```rust
#[tauri::command]
#[specta::specta]
pub fn get_hymn(
    app: tauri::AppHandle,
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Hymn, AppError> {
    use tauri::Manager;
    let conn = state.db.get()?;
    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        let hymns = vec![
            crate::db::queries::music::get_hymn_by_id_from_content_db(&content_conn, id, &lang)?
        ];
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_hymn_paths(hymns, &app_data).remove(0));
    }
    crate::db::queries::music::get_hymn_by_id(&conn, id)
}
```

- [ ] **Step 2: Update `get_albums`** (lines ~112–117)

Replace:
```rust
#[tauri::command]
#[specta::specta]
pub fn get_albums(state: tauri::State<'_, AppState>) -> Result<Vec<Album>, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::music::get_albums(&conn)
}
```

With:
```rust
#[tauri::command]
#[specta::specta]
pub fn get_albums(state: tauri::State<'_, AppState>) -> Result<Vec<Album>, AppError> {
    let conn = state.db.get()?;
    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        return crate::db::queries::music::get_albums_from_content_db(&content_conn, &lang);
    }
    crate::db::queries::music::get_albums(&conn)
}
```

- [ ] **Step 3: Update `get_hymns_by_album`** (lines ~119–127)

Replace:
```rust
#[tauri::command]
#[specta::specta]
pub fn get_hymns_by_album(
    album: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::music::get_hymns_by_album(&conn, &album)
}
```

With:
```rust
#[tauri::command]
#[specta::specta]
pub fn get_hymns_by_album(
    app: tauri::AppHandle,
    album: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    use tauri::Manager;
    let conn = state.db.get()?;
    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        let hymns = crate::db::queries::music::get_hymns_by_album_from_content_db(
            &content_conn,
            &album,
            &lang,
        )?;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_hymn_paths(hymns, &app_data));
    }
    crate::db::queries::music::get_hymns_by_album(&conn, &album)
}
```

- [ ] **Step 4: Build to verify no compile errors**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error"
```

Expected: no errors (warnings for dead code on old functions are OK).

- [ ] **Step 5: Run all music-related tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20
```

Expected: test suite passes.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/music.rs
git commit -m "feat(music): dispatch get_hymn, get_albums, get_hymns_by_album via content DB"
```

---

## Task 5: Tests for `get_hymns_from_content_db` and `get_collection_hymns_from_content_db`

**Files:**
- Modify: `src-tauri/src/db/queries/music.rs` (add more tests to `content_db_tests`)

These functions already exist but have no tests.

- [ ] **Step 1: Append tests to `content_db_tests` in `music.rs`**

```rust
    #[test]
    fn get_hymns_from_content_db_returns_list() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_from_content_db(&conn, "pt-BR").unwrap();
        assert_eq!(hymns.len(), 1);
        assert_eq!(hymns[0].title, "Santo");
        assert_eq!(hymns[0].album.as_deref(), Some("1992 - Brilha Jesus"));
    }

    #[test]
    fn get_hymns_from_content_db_empty_db() {
        let conn = make_content_db();
        let hymns = get_hymns_from_content_db(&conn, "pt-BR").unwrap();
        assert!(hymns.is_empty());
    }
```

Also update `seed_basic` to accept a `rusqlite::Connection` reference so it can be reused by both tasks. (It already does since we defined it with `&rusqlite::Connection`.)

For `get_collection_hymns_from_content_db` (lives in `music.rs` around line 946):

```rust
    #[test]
    fn get_collection_hymns_from_content_db_returns_hymns_in_album() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_collection_hymns_from_content_db(&conn, 1, "pt-BR").unwrap();
        assert_eq!(hymns.len(), 1);
        assert_eq!(hymns[0].title, "Santo");
    }

    #[test]
    fn get_collection_hymns_from_content_db_empty_for_unknown_album() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_collection_hymns_from_content_db(&conn, 999, "pt-BR").unwrap();
        assert!(hymns.is_empty());
    }
```

- [ ] **Step 2: Run**

```bash
cargo test --manifest-path src-tauri/Cargo.toml db::queries::music::content_db_tests
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/queries/music.rs
git commit -m "test(music): add tests for get_hymns_from_content_db and get_collection_hymns_from_content_db"
```

---

## Task 6: Operational — Re-publish CDN packs

> This is a manual operational step, not a code change. Document it here so nothing is forgotten.

**Why this is required:**
- Packs published before the admin panel fixes still contain `config/` prefix paths from the old `canonicalPackPath()`. Those packs extract into a stray `config/` tree in addition to the correct `musics/`/`covers/`/`images/` tree.
- Packs published before `isSystemFile()` was added may contain `.DS_Store` or `__MACOSX` entries.

**Steps:**
1. Open the admin panel at its deployed URL.
2. For each published pack: go to the pack management page, select the pack, click Re-publish / Update.
3. Verify the new pack ZIP does NOT contain entries starting with `config/` or `media/`.
4. Verify the manifest JSON no longer contains `dbUrl` or `dbVersion` at the top level.
5. Verify each pack entry in the manifest has a `language` field set to `pt-BR`, `es`, or `en-US`.

**Verification (spot check):**
```bash
# Download a pack ZIP and inspect entries (replace URL with actual CDN URL)
curl -L "https://<cdn>/packs/hymnal-pt-BR-audio-001.zip" -o /tmp/pack.zip
unzip -l /tmp/pack.zip | head -30
# Should show: musics/pt/AlbumName/file.mp3
# Must NOT show: config/... or media/...
```

---

## Completion Checklist

- [ ] All Rust tests pass: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] CDN packs re-published with correct paths
- [ ] Manual smoke test: launch app, open hymnal, verify albums list shows CDN albums with cover images
- [ ] Manual smoke test: click an album, verify hymns list with audio paths
- [ ] Manual smoke test: start playing a hymn, verify audio plays and cover image shows
