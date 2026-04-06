use crate::error::AppError;
use crate::state::ContentDbCapabilities;
use rusqlite::params;

/// Returns true if the `lyrics` table exists in the given content DB.
/// Used to build SQL dynamically so that `prepare()` never references a missing table.
pub(crate) fn lyrics_table_exists(conn: &rusqlite::Connection) -> bool {
    conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='lyrics'",
        [],
        |r| r.get::<_, i64>(0),
    )
    .map(|c| c > 0)
    .unwrap_or(false)
}

/// Returns true if both `categories` and `categories_albums` tables exist in the content DB.
pub(crate) fn categories_tables_exist(content_db: &rusqlite::Connection) -> bool {
    let has_categories = content_db
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='categories'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);
    let has_cat_albums = content_db
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='categories_albums'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);
    has_categories && has_cat_albums
}

/// Probe all schema capabilities of a content DB in a single pass.
/// Called once at DB open time; result is cached in `AppState::content_db_capabilities`.
pub fn probe_content_db_capabilities(conn: &rusqlite::Connection) -> ContentDbCapabilities {
    let has_lyrics = lyrics_table_exists(conn);

    let has_time = if has_lyrics {
        conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('lyrics') WHERE name='time'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false)
    } else {
        false
    };

    let has_instrumental_time = if has_lyrics {
        conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('lyrics') WHERE name='instrumental_time'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false)
    } else {
        false
    };

    let has_fts = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='musics_fts'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    let has_categories = categories_tables_exist(conn);

    ContentDbCapabilities {
        has_fts,
        has_lyrics_table: has_lyrics,
        has_categories,
        has_time_column: has_time,
        has_instrumental_time_column: has_instrumental_time,
    }
}

/// Returns the SQL fragment for the lyrics column.
/// When the `lyrics` table exists it returns the correlated GROUP_CONCAT subquery
/// using the given parameter placeholder (e.g. `?1` or `?2`).
/// When the table is absent it returns `NULL`, keeping the rest of the query unchanged.
///
/// Uses cached `caps` when provided; falls back to live sqlite_master probe otherwise.
fn lyrics_subquery(
    conn: &rusqlite::Connection,
    lang_param: &str,
    caps: Option<&ContentDbCapabilities>,
) -> String {
    let has_lyrics = caps
        .map(|c| c.has_lyrics_table)
        .unwrap_or_else(|| lyrics_table_exists(conn));
    if has_lyrics {
        format!(
            "(SELECT GROUP_CONCAT(lyric, char(10) || char(10)) \
             FROM (SELECT lyric FROM lyrics WHERE id_music = m.id_music AND id_language = {lang_param} ORDER BY \"order\"))"
        )
    } else {
        "NULL".to_string()
    }
}

/// Returns the SQL fragment for the `lyrics_sync` column.
///
/// When the `lyrics` table exists and has a `time` column, builds a
/// `json_group_array(json_object(...))` correlated subquery whose output is
/// parseable by `parse_lyrics_sync_points` in `music_sync.rs`.
///
/// The JSON key for the instrumental field is `'instrumentalTime'` (camelCase)
/// to match the `#[serde(rename_all = "camelCase")]` on `SyncLyric`.
///
/// Falls back to `NULL` for older content DBs that lack timing columns.
///
/// Uses cached `caps` when provided; falls back to live pragma probes otherwise.
fn lyrics_sync_subquery(
    conn: &rusqlite::Connection,
    lang_param: &str,
    caps: Option<&ContentDbCapabilities>,
) -> String {
    // TODO(review): None fallback re-probes schema (3 queries). Only used by detail functions which are not hot-path. - business-logic-reviewer, 2026-04-06, Severity: Medium
    let (has_lyrics, has_time, has_instrumental) = match caps {
        Some(c) => (c.has_lyrics_table, c.has_time_column, c.has_instrumental_time_column),
        None => {
            let probe = probe_content_db_capabilities(conn);
            (probe.has_lyrics_table, probe.has_time_column, probe.has_instrumental_time_column)
        }
    };

    if !has_lyrics || !has_time {
        return "NULL".to_string();
    }

    let inst_field = if has_instrumental {
        "'instrumentalTime', instrumental_time"
    } else {
        "'instrumentalTime', NULL"
    };
    let inst_select = if has_instrumental {
        ", instrumental_time"
    } else {
        ""
    };

    format!(
        "(SELECT json_group_array(json_object(\
            'lyric', lyric, \
            'order', \"order\", \
            'time', time, \
            {inst_field}\
        )) FROM (\
            SELECT lyric, \"order\", time{inst_select} \
            FROM lyrics \
            WHERE id_music = m.id_music AND id_language = {lang_param} \
            ORDER BY \"order\"\
        ))",
        inst_field = inst_field,
        inst_select = inst_select,
        lang_param = lang_param,
    )
}

/// Returns SQL fragments `(join_clause, where_extra)` to restrict musics to those whose
/// album is categorised as `'hymnal'`.
///
/// When the categories tables are present it returns:
/// - a JOIN clause that brings in `categories_albums` and `categories` via LEFT JOINs
/// - a WHERE extra clause `AND (cat.slug IS NULL OR cat.slug = 'hymnal')` that keeps
///   albums with no category entry (safe fallback within the same DB)
///
/// When the tables don't exist both strings are empty, leaving the query unchanged.
///
/// Uses cached `caps` when provided; falls back to live sqlite_master probe otherwise.
fn hymnal_category_filter(
    content_db: &rusqlite::Connection,
    caps: Option<&ContentDbCapabilities>,
) -> (String, String) {
    let has_cats = caps
        .map(|c| c.has_categories)
        .unwrap_or_else(|| categories_tables_exist(content_db));
    if has_cats {
        let join = "LEFT JOIN categories_albums ca \
                        ON ca.id_album = a.id_album AND ca.id_language = m.id_language\n\
                    LEFT JOIN categories cat ON cat.id_category = ca.id_category"
            .to_string();
        let extra_where = "AND (cat.slug IS NULL OR cat.slug = 'hymnal')".to_string();
        (join, extra_where)
    } else {
        (String::new(), String::new())
    }
}

/// Query hymnal from the content DB (downloaded legacy DB).
/// Returns Hymn structs with file paths ready for app_data_dir resolution.
/// Pass `caps` from `AppState::content_db_capabilities` to skip sqlite_master probes.
pub fn get_hymns_from_content_db(
    content_db: &rusqlite::Connection,
    lang_bcp47: &str,
    caps: Option<&ContentDbCapabilities>,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let lyrics_col = lyrics_subquery(content_db, "?1", caps);
    let lyrics_sync_col = lyrics_sync_subquery(content_db, "?1", caps);
    let (cat_join, cat_where) = hymnal_category_filter(content_db, caps);

    let sql = format!(
        "SELECT
            m.id_music                    AS id,
            am.track                      AS number,
            m.name                        AS title,
            NULL                          AS author,
            a.name                        AS album,
            {lyrics_col}                  AS lyrics,
            NULL                          AS chords,
            fa.dir || '/' || fa.name      AS audio_path,
            fp.dir || '/' || fp.name      AS playback_path,
            'hymnal'                      AS category,
            NULL                          AS notes,
            fi.dir || '/' || fi.name      AS cover_path,
            {lyrics_sync_col}             AS lyrics_sync,
            m.id_music                    AS api_music_id,
            m.created_at                  AS created_at,
            m.updated_at                  AS updated_at
         FROM musics m
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         {cat_join}
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE m.id_language = ?1
           {cat_where}
         ORDER BY a.name, am.track"
    );

    let mut stmt = content_db.prepare(&sql).map_err(AppError::Database)?;

    let hymns = stmt
        .query_map([lang_short], |row| {
            Ok(crate::db::models::Hymn {
                id: row.get("id")?,
                number: row.get("number")?,
                title: row.get("title")?,
                author: row.get("author")?,
                album: row.get("album")?,
                lyrics: row.get("lyrics")?,
                chords: row.get("chords")?,
                audio_path: row.get("audio_path")?,
                playback_path: row.get("playback_path")?,
                category: row.get("category")?,
                notes: row.get("notes")?,
                cover_path: row.get("cover_path")?,
                lyrics_sync: row.get("lyrics_sync")?,
                api_music_id: row.get("api_music_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

/// Search hymnal in the content DB using FTS5 (musics_fts table).
/// Falls back to `get_hymns_from_content_db` when query is empty or FTS table is missing.
/// Pass `caps` from `AppState::content_db_capabilities` to skip sqlite_master probes.
pub fn search_hymns_content_db(
    content_db: &rusqlite::Connection,
    query: &str,
    lang_bcp47: &str,
    caps: Option<&ContentDbCapabilities>,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return get_hymns_from_content_db(content_db, lang_bcp47, caps);
    }

    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    // If query is a pure number prefix, search by track number using LIKE (FTS5 doesn't index integers).
    if !trimmed.is_empty() && trimmed.chars().all(|c| c.is_ascii_digit()) {
        let number_prefix = format!("{}%", trimmed);
        let lyrics_col = lyrics_subquery(content_db, "?2", caps);
        let lyrics_sync_col = lyrics_sync_subquery(content_db, "?2", caps);
        let (cat_join, cat_where) = hymnal_category_filter(content_db, caps);
        let sql = format!(
            "SELECT
                m.id_music AS id, am.track AS number, m.name AS title,
                NULL AS author, a.name AS album,
                {lyrics_col} AS lyrics,
                NULL AS chords,
                fa.dir || '/' || fa.name AS audio_path,
                fp.dir || '/' || fp.name AS playback_path,
                'hymnal' AS category, NULL AS notes,
                fi.dir || '/' || fi.name AS cover_path,
                {lyrics_sync_col} AS lyrics_sync, m.id_music AS api_music_id,
                m.created_at, m.updated_at
             FROM musics m
             LEFT JOIN albums_musics am ON am.id_music = m.id_music
             LEFT JOIN albums        a  ON a.id_album  = am.id_album
             {cat_join}
             LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
             LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
             LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
             WHERE CAST(am.track AS TEXT) LIKE ?1
               AND m.id_language = ?2
               {cat_where}
             ORDER BY am.track"
        );
        let mut stmt = content_db.prepare(&sql).map_err(AppError::Database)?;
        let hymns = stmt
            .query_map(params![number_prefix, lang_short], |row| {
                Ok(crate::db::models::Hymn {
                    id: row.get("id")?,
                    number: row.get("number")?,
                    title: row.get("title")?,
                    author: row.get("author")?,
                    album: row.get("album")?,
                    lyrics: row.get("lyrics")?,
                    chords: row.get("chords")?,
                    audio_path: row.get("audio_path")?,
                    playback_path: row.get("playback_path")?,
                    category: row.get("category")?,
                    notes: row.get("notes")?,
                    cover_path: row.get("cover_path")?,
                    lyrics_sync: row.get("lyrics_sync")?,
                    api_music_id: row.get("api_music_id")?,
                    created_at: row
                        .get::<_, Option<String>>("created_at")?
                        .unwrap_or_default(),
                    updated_at: row
                        .get::<_, Option<String>>("updated_at")?
                        .unwrap_or_default(),
                })
            })
            .map_err(AppError::Database)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        return Ok(hymns);
    }

    // Sanitize query: keep alphanumeric + whitespace, then build FTS5 prefix query.
    let sanitized: String = trimmed
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>();
    let fts_query: String = sanitized
        .split_whitespace()
        .map(|t| format!("{}*", t))
        .collect::<Vec<_>>()
        .join(" ");
    if fts_query.is_empty() {
        return get_hymns_from_content_db(content_db, lang_bcp47, caps);
    }

    // Check if FTS table exists — use cache when available.
    let fts_exists = caps
        .map(|c| c.has_fts)
        .unwrap_or_else(|| {
            content_db
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='musics_fts'",
                    [],
                    |r| r.get::<_, i64>(0),
                )
                .map(|c| c > 0)
                .unwrap_or(false)
        });

    if !fts_exists {
        return get_hymns_from_content_db(content_db, lang_bcp47, caps);
    }

    let lyrics_col = lyrics_subquery(content_db, "?2", caps);
    let lyrics_sync_col = lyrics_sync_subquery(content_db, "?2", caps);
    let (cat_join, cat_where) = hymnal_category_filter(content_db, caps);

    let sql = format!(
        "SELECT
            m.id_music AS id, am.track AS number, m.name AS title,
            NULL AS author, a.name AS album,
            {lyrics_col} AS lyrics,
            NULL AS chords,
            fa.dir || '/' || fa.name AS audio_path,
            fp.dir || '/' || fp.name AS playback_path,
            'hymnal' AS category, NULL AS notes,
            fi.dir || '/' || fi.name AS cover_path,
            {lyrics_sync_col} AS lyrics_sync, m.id_music AS api_music_id,
            m.created_at, m.updated_at
         FROM musics_fts
         JOIN musics m ON musics_fts.rowid = m.id_music
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         {cat_join}
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE musics_fts MATCH ?1
           AND m.id_language = ?2
           {cat_where}
         ORDER BY rank
         LIMIT 50"
    );

    let mut stmt = content_db.prepare(&sql).map_err(AppError::Database)?;

    let hymns = stmt
        .query_map(params![fts_query, lang_short], |row| {
            Ok(crate::db::models::Hymn {
                id: row.get("id")?,
                number: row.get("number")?,
                title: row.get("title")?,
                author: row.get("author")?,
                album: row.get("album")?,
                lyrics: row.get("lyrics")?,
                chords: row.get("chords")?,
                audio_path: row.get("audio_path")?,
                playback_path: row.get("playback_path")?,
                category: row.get("category")?,
                notes: row.get("notes")?,
                cover_path: row.get("cover_path")?,
                lyrics_sync: row.get("lyrics_sync")?,
                api_music_id: row.get("api_music_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

/// Return ALL music from the content DB (no hymnal category filter).
/// Used by `search_all_music` which spans all categories.
/// Pass `caps` from `AppState::content_db_capabilities` to skip sqlite_master probes.
pub fn get_all_music_from_content_db(
    content_db: &rusqlite::Connection,
    lang_bcp47: &str,
    caps: Option<&ContentDbCapabilities>,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let lyrics_col = lyrics_subquery(content_db, "?1", caps);
    let lyrics_sync_col = lyrics_sync_subquery(content_db, "?1", caps);

    let sql = format!(
        "SELECT
            m.id_music                    AS id,
            am.track                      AS number,
            m.name                        AS title,
            NULL                          AS author,
            a.name                        AS album,
            {lyrics_col}                  AS lyrics,
            NULL                          AS chords,
            fa.dir || '/' || fa.name      AS audio_path,
            fp.dir || '/' || fp.name      AS playback_path,
            'hymnal'                      AS category,
            NULL                          AS notes,
            fi.dir || '/' || fi.name      AS cover_path,
            {lyrics_sync_col}             AS lyrics_sync,
            m.id_music                    AS api_music_id,
            m.created_at                  AS created_at,
            m.updated_at                  AS updated_at
         FROM musics m
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE m.id_language = ?1
         ORDER BY a.name, am.track"
    );

    let mut stmt = content_db.prepare(&sql).map_err(AppError::Database)?;

    let hymns = stmt
        .query_map([lang_short], |row| {
            Ok(crate::db::models::Hymn {
                id: row.get("id")?,
                number: row.get("number")?,
                title: row.get("title")?,
                author: row.get("author")?,
                album: row.get("album")?,
                lyrics: row.get("lyrics")?,
                chords: row.get("chords")?,
                audio_path: row.get("audio_path")?,
                playback_path: row.get("playback_path")?,
                category: row.get("category")?,
                notes: row.get("notes")?,
                cover_path: row.get("cover_path")?,
                lyrics_sync: row.get("lyrics_sync")?,
                api_music_id: row.get("api_music_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

/// Search ALL music in the content DB (no hymnal category filter).
/// Falls back to `get_all_music_from_content_db` when query is empty or FTS table is missing.
/// Pass `caps` from `AppState::content_db_capabilities` to skip sqlite_master probes.
pub fn search_all_music_content_db(
    content_db: &rusqlite::Connection,
    query: &str,
    lang_bcp47: &str,
    caps: Option<&ContentDbCapabilities>,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return get_all_music_from_content_db(content_db, lang_bcp47, caps);
    }

    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    // Numeric prefix → search by track number
    if trimmed.chars().all(|c| c.is_ascii_digit()) {
        let number_prefix = format!("{}%", trimmed);
        let lyrics_col = lyrics_subquery(content_db, "?2", caps);
        let lyrics_sync_col = lyrics_sync_subquery(content_db, "?2", caps);
        let sql = format!(
            "SELECT
                m.id_music AS id, am.track AS number, m.name AS title,
                NULL AS author, a.name AS album,
                {lyrics_col} AS lyrics,
                NULL AS chords,
                fa.dir || '/' || fa.name AS audio_path,
                fp.dir || '/' || fp.name AS playback_path,
                'hymnal' AS category, NULL AS notes,
                fi.dir || '/' || fi.name AS cover_path,
                {lyrics_sync_col} AS lyrics_sync, m.id_music AS api_music_id,
                m.created_at, m.updated_at
             FROM musics m
             LEFT JOIN albums_musics am ON am.id_music = m.id_music
             LEFT JOIN albums        a  ON a.id_album  = am.id_album
             LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
             LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
             LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
             WHERE CAST(am.track AS TEXT) LIKE ?1
               AND m.id_language = ?2
             ORDER BY am.track"
        );
        let mut stmt = content_db.prepare(&sql).map_err(AppError::Database)?;
        let hymns = stmt
            .query_map(params![number_prefix, lang_short], |row| {
                Ok(crate::db::models::Hymn {
                    id: row.get("id")?,
                    number: row.get("number")?,
                    title: row.get("title")?,
                    author: row.get("author")?,
                    album: row.get("album")?,
                    lyrics: row.get("lyrics")?,
                    chords: row.get("chords")?,
                    audio_path: row.get("audio_path")?,
                    playback_path: row.get("playback_path")?,
                    category: row.get("category")?,
                    notes: row.get("notes")?,
                    cover_path: row.get("cover_path")?,
                    lyrics_sync: row.get("lyrics_sync")?,
                    api_music_id: row.get("api_music_id")?,
                    created_at: row
                        .get::<_, Option<String>>("created_at")?
                        .unwrap_or_default(),
                    updated_at: row
                        .get::<_, Option<String>>("updated_at")?
                        .unwrap_or_default(),
                })
            })
            .map_err(AppError::Database)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        return Ok(hymns);
    }

    // FTS5 prefix search
    let sanitized: String = trimmed
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>();
    let fts_query: String = sanitized
        .split_whitespace()
        .map(|t| format!("{}*", t))
        .collect::<Vec<_>>()
        .join(" ");
    if fts_query.is_empty() {
        return get_all_music_from_content_db(content_db, lang_bcp47, caps);
    }

    // Use cached FTS capability when available.
    let fts_exists = caps
        .map(|c| c.has_fts)
        .unwrap_or_else(|| {
            content_db
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='musics_fts'",
                    [],
                    |r| r.get::<_, i64>(0),
                )
                .map(|c| c > 0)
                .unwrap_or(false)
        });

    if !fts_exists {
        return get_all_music_from_content_db(content_db, lang_bcp47, caps);
    }

    let lyrics_col = lyrics_subquery(content_db, "?2", caps);
    let lyrics_sync_col = lyrics_sync_subquery(content_db, "?2", caps);

    let sql = format!(
        "SELECT
            m.id_music AS id, am.track AS number, m.name AS title,
            NULL AS author, a.name AS album,
            {lyrics_col} AS lyrics,
            NULL AS chords,
            fa.dir || '/' || fa.name AS audio_path,
            fp.dir || '/' || fp.name AS playback_path,
            'hymnal' AS category, NULL AS notes,
            fi.dir || '/' || fi.name AS cover_path,
            {lyrics_sync_col} AS lyrics_sync, m.id_music AS api_music_id,
            m.created_at, m.updated_at
         FROM musics_fts
         JOIN musics m ON musics_fts.rowid = m.id_music
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE musics_fts MATCH ?1
           AND m.id_language = ?2
         ORDER BY rank
         LIMIT 50"
    );

    let mut stmt = content_db.prepare(&sql).map_err(AppError::Database)?;

    let hymns = stmt
        .query_map(params![fts_query, lang_short], |row| {
            Ok(crate::db::models::Hymn {
                id: row.get("id")?,
                number: row.get("number")?,
                title: row.get("title")?,
                author: row.get("author")?,
                album: row.get("album")?,
                lyrics: row.get("lyrics")?,
                chords: row.get("chords")?,
                audio_path: row.get("audio_path")?,
                playback_path: row.get("playback_path")?,
                category: row.get("category")?,
                notes: row.get("notes")?,
                cover_path: row.get("cover_path")?,
                lyrics_sync: row.get("lyrics_sync")?,
                api_music_id: row.get("api_music_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

/// Query album/collection list from the content DB (downloaded legacy DB).
pub fn get_collections_from_content_db(
    content_db: &rusqlite::Connection,
    lang_bcp47: &str,
) -> Result<Vec<crate::db::models::Collection>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    let mut stmt = content_db
        .prepare_cached(
            "SELECT
                a.id_album                                   AS id,
                a.name                                       AS name,
                NULL                                         AS description,
                CAST(SUBSTR(a.name, 1, 4) AS INTEGER)        AS year,
                f.dir || '/' || f.name                       AS cover_path,
                NULL                                         AS auto_cover_path,
                COUNT(am.id_music)                           AS song_count,
                'api'                                        AS source_type,
                a.id_album                                   AS api_album_id,
                a.created_at,
                a.updated_at
             FROM albums a
             LEFT JOIN files f ON f.id_file = a.id_file_image
             LEFT JOIN albums_musics am ON am.id_album = a.id_album
             WHERE a.id_language = ?1
             GROUP BY a.id_album
             ORDER BY a.name",
        )
        .map_err(AppError::Database)?;

    let collections = stmt
        .query_map([lang_short], |row| {
            let year_raw: Option<i64> = row.get("year")?;
            let year =
                year_raw.and_then(|y| if (1900..=2100).contains(&y) { Some(y as i32) } else { None });
            Ok(crate::db::models::Collection {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                year,
                cover_path: row.get("cover_path")?,
                auto_cover_path: row.get("auto_cover_path")?,
                song_count: row.get::<_, i64>("song_count")? as i32,
                source_type: row.get("source_type")?,
                api_album_id: row.get("api_album_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(collections)
}

/// Fetch a single collection/album from the content DB by its album ID.
/// Returns `None` when no matching album is found.
pub fn get_collection_by_id_from_content_db(
    content_db: &rusqlite::Connection,
    album_id: i64,
) -> Result<Option<crate::db::models::Collection>, AppError> {
    let mut stmt = content_db
        .prepare_cached(
            "SELECT
                a.id_album                                   AS id,
                a.name                                       AS name,
                NULL                                         AS description,
                CAST(SUBSTR(a.name, 1, 4) AS INTEGER)        AS year,
                f.dir || '/' || f.name                       AS cover_path,
                NULL                                         AS auto_cover_path,
                COUNT(am.id_music)                           AS song_count,
                'api'                                        AS source_type,
                a.id_album                                   AS api_album_id,
                a.created_at,
                a.updated_at
             FROM albums a
             LEFT JOIN files f ON f.id_file = a.id_file_image
             LEFT JOIN albums_musics am ON am.id_album = a.id_album
             WHERE a.id_album = ?1
             GROUP BY a.id_album",
        )
        .map_err(AppError::Database)?;

    let mut rows = stmt
        .query_map([album_id], |row| {
            let year_raw: Option<i64> = row.get("year")?;
            let year = year_raw
                .and_then(|y| if (1900..=2100).contains(&y) { Some(y as i32) } else { None });
            Ok(crate::db::models::Collection {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                year,
                cover_path: row.get("cover_path")?,
                auto_cover_path: row.get("auto_cover_path")?,
                song_count: row.get::<_, i64>("song_count")? as i32,
                source_type: row.get("source_type")?,
                api_album_id: row.get("api_album_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?;

    match rows.next() {
        Some(Ok(collection)) => Ok(Some(collection)),
        Some(Err(e)) => Err(AppError::Database(e)),
        None => Ok(None),
    }
}

/// Query hymns belonging to a specific album in the content DB.
pub fn get_collection_hymns_from_content_db(
    content_db: &rusqlite::Connection,
    album_id: i64,
    lang_bcp47: &str,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let lyrics_col = lyrics_subquery(content_db, "?2", None);
    let lyrics_sync_col = lyrics_sync_subquery(content_db, "?2", None);

    let sql = format!(
        "SELECT
            m.id_music AS id, am.track AS number, m.name AS title,
            NULL AS author, a.name AS album,
            {lyrics_col} AS lyrics,
            NULL AS chords,
            fa.dir || '/' || fa.name AS audio_path,
            fp.dir || '/' || fp.name AS playback_path,
            'hymnal' AS category, NULL AS notes,
            fi.dir || '/' || fi.name AS cover_path,
            {lyrics_sync_col} AS lyrics_sync, m.id_music AS api_music_id,
            m.created_at, m.updated_at
         FROM musics m
         JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums    a  ON a.id_album  = am.id_album
         LEFT JOIN files     fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files     fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files     fi ON fi.id_file  = m.id_file_image
         WHERE am.id_album = ?1
           AND m.id_language = ?2
         ORDER BY am.track"
    );

    let mut stmt = content_db.prepare(&sql).map_err(AppError::Database)?;

    let hymns = stmt
        .query_map(params![album_id, lang_short], |row| {
            Ok(crate::db::models::Hymn {
                id: row.get("id")?,
                number: row.get("number")?,
                title: row.get("title")?,
                author: row.get("author")?,
                album: row.get("album")?,
                lyrics: row.get("lyrics")?,
                chords: row.get("chords")?,
                audio_path: row.get("audio_path")?,
                playback_path: row.get("playback_path")?,
                category: row.get("category")?,
                notes: row.get("notes")?,
                cover_path: row.get("cover_path")?,
                lyrics_sync: row.get("lyrics_sync")?,
                api_music_id: row.get("api_music_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

/// Fetch a single hymn from the content DB by its id_music.
pub fn get_hymn_by_id_from_content_db(
    content_db: &rusqlite::Connection,
    id: i64,
    lang_bcp47: &str,
) -> Result<crate::db::models::Hymn, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let lyrics_col = lyrics_subquery(content_db, "?2", None);
    let lyrics_sync_col = lyrics_sync_subquery(content_db, "?2", None);

    let sql = format!(
        "SELECT
            m.id_music                    AS id,
            am.track                      AS number,
            m.name                        AS title,
            NULL                          AS author,
            a.name                        AS album,
            {lyrics_col}                  AS lyrics,
            NULL                          AS chords,
            fa.dir || '/' || fa.name      AS audio_path,
            fp.dir || '/' || fp.name      AS playback_path,
            'hymnal'                      AS category,
            NULL                          AS notes,
            fi.dir || '/' || fi.name      AS cover_path,
            {lyrics_sync_col}             AS lyrics_sync,
            m.id_music                    AS api_music_id,
            COALESCE(m.created_at, '')    AS created_at,
            COALESCE(m.updated_at, '')    AS updated_at
         FROM musics m
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE m.id_music = ?1 AND m.id_language = ?2"
    );

    content_db
        .query_row(
            &sql,
            rusqlite::params![id, lang_short],
            super::music_app::map_hymn_row,
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
    let mut stmt = content_db.prepare_cached(
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
/// Pass `caps` from `AppState::content_db_capabilities` to skip sqlite_master probes.
pub fn get_hymns_by_album_from_content_db(
    content_db: &rusqlite::Connection,
    album: &str,
    lang_bcp47: &str,
    caps: Option<&ContentDbCapabilities>,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let lyrics_col = lyrics_subquery(content_db, "?2", caps);
    let lyrics_sync_col = lyrics_sync_subquery(content_db, "?2", caps);

    let sql = format!(
        "SELECT
            m.id_music                    AS id,
            am.track                      AS number,
            m.name                        AS title,
            NULL                          AS author,
            a.name                        AS album,
            {lyrics_col}                  AS lyrics,
            NULL                          AS chords,
            fa.dir || '/' || fa.name      AS audio_path,
            fp.dir || '/' || fp.name      AS playback_path,
            'hymnal'                      AS category,
            NULL                          AS notes,
            fi.dir || '/' || fi.name      AS cover_path,
            {lyrics_sync_col}             AS lyrics_sync,
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
         ORDER BY am.track, m.name"
    );

    let mut stmt = content_db.prepare(&sql)?;
    let hymns = stmt
        .query_map(rusqlite::params![album, lang_short], super::music_app::map_hymn_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}

/// Search content DB albums and their hymns/lyrics, returning `CollectionSearchResult`s.
///
/// Two search strategies:
/// 1. Album name LIKE match → kind = "collection"
/// 2. musics_fts match (song name / lyrics) → kind = "song", with album info
pub fn search_collections_content_db(
    content_db: &rusqlite::Connection,
    query: &str,
    lang_bcp47: &str,
    limit: usize,
) -> Result<Vec<crate::db::models::CollectionSearchResult>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let safe_limit = limit.max(1) as i64;
    let mut results: Vec<crate::db::models::CollectionSearchResult> = Vec::new();

    // Check if albums table exists in this content DB
    let albums_exist: bool = content_db
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='albums'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !albums_exist {
        return Ok(vec![]);
    }

    // 1) Album name LIKE search
    let like_pattern = format!("%{}%", trimmed);
    {
        let mut stmt = content_db
            .prepare(
                "SELECT
                    a.id_album       AS id,
                    a.name           AS album_name,
                    f.dir || '/' || f.name AS cover_path
                 FROM albums a
                 LEFT JOIN files f ON f.id_file = a.id_file_image
                 WHERE a.id_language = ?1
                   AND a.name LIKE ?2
                 ORDER BY a.name
                 LIMIT ?3",
            )
            .map_err(AppError::Database)?;

        let rows = stmt
            .query_map(rusqlite::params![lang_short, like_pattern, safe_limit], |row| {
                let album_name: String = row.get("album_name")?;
                Ok(crate::db::models::CollectionSearchResult {
                    kind: "collection".to_string(),
                    collection_id: row.get("id")?,
                    song_id: None,
                    collection_name: album_name.clone(),
                    title: album_name,
                    cover_path: row.get("cover_path")?,
                    snippet: String::new(),
                })
            })
            .map_err(AppError::Database)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;

        results.extend(rows);
    }

    // 2) FTS search on musics_fts for song matches
    let fts_exists: bool = content_db
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='musics_fts'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if fts_exists {
        let sanitized: String = trimmed
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>();
        let fts_query: String = sanitized
            .split_whitespace()
            .map(|t| format!("{}*", t))
            .collect::<Vec<_>>()
            .join(" ");

        if !fts_query.is_empty() {
            let remaining = (safe_limit - results.len() as i64).max(0);
            if remaining > 0 {
                let mut stmt = content_db
                    .prepare(
                        "SELECT
                            a.id_album                    AS collection_id,
                            m.id_music                    AS song_id,
                            a.name                        AS album_name,
                            m.name                        AS song_name,
                            fi.dir || '/' || fi.name      AS cover_path,
                            snippet(musics_fts, 1, '<mark>', '</mark>', ' ... ', 24) AS snippet
                         FROM musics_fts
                         JOIN musics m ON musics_fts.rowid = m.id_music
                         LEFT JOIN albums_musics am ON am.id_music = m.id_music
                         LEFT JOIN albums        a  ON a.id_album  = am.id_album
                         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
                         WHERE musics_fts MATCH ?1
                           AND m.id_language = ?2
                         ORDER BY rank
                         LIMIT ?3",
                    )
                    .map_err(AppError::Database)?;

                let song_rows = stmt
                    .query_map(rusqlite::params![fts_query, lang_short, remaining], |row| {
                        Ok(crate::db::models::CollectionSearchResult {
                            kind: "song".to_string(),
                            collection_id: row.get::<_, Option<i64>>("collection_id")?.unwrap_or(0),
                            song_id: row.get("song_id")?,
                            collection_name: row
                                .get::<_, Option<String>>("album_name")?
                                .unwrap_or_default(),
                            title: row.get("song_name")?,
                            cover_path: row.get("cover_path")?,
                            snippet: row
                                .get::<_, Option<String>>("snippet")?
                                .unwrap_or_default(),
                        })
                    })
                    .map_err(AppError::Database)?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(AppError::Database)?;

                results.extend(song_rows);
            }
        }
    }

    Ok(results)
}

#[cfg(test)]
mod content_db_tests {
    use super::*;

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
            );
            CREATE TABLE lyrics (
                id_lyric INTEGER PRIMARY KEY,
                id_music INTEGER,
                lyric TEXT,
                \"order\" INTEGER,
                show_slide INTEGER,
                id_language TEXT
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
             INSERT INTO albums_musics VALUES (1, 1, 1);
             INSERT INTO lyrics VALUES (1, 1, 'Santo, Santo, Santo', 1, 1, 'pt');
             INSERT INTO lyrics VALUES (2, 1, 'Senhor Deus Todo-Poderoso', 2, 1, 'pt');",
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
        let hymns = get_hymns_by_album_from_content_db(&conn, "1992 - Brilha Jesus", "pt-BR", None).unwrap();
        assert_eq!(hymns.len(), 1);
        assert_eq!(hymns[0].title, "Santo");
        assert_eq!(hymns[0].number, Some(1));
    }

    #[test]
    fn get_hymns_by_album_from_content_db_empty_for_unknown_album() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_by_album_from_content_db(&conn, "Unknown Album", "pt-BR", None).unwrap();
        assert!(hymns.is_empty());
    }

    #[test]
    fn get_hymns_from_content_db_returns_list() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        assert_eq!(hymns.len(), 1);
        assert_eq!(hymns[0].title, "Santo");
        assert_eq!(hymns[0].album.as_deref(), Some("1992 - Brilha Jesus"));
    }

    #[test]
    fn get_hymns_from_content_db_empty_db() {
        let conn = make_content_db();
        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        assert!(hymns.is_empty());
    }

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

    #[test]
    fn get_hymn_by_id_returns_lyrics_from_lyrics_table() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymn = get_hymn_by_id_from_content_db(&conn, 1, "pt-BR").unwrap();
        let lyrics = hymn.lyrics.expect("lyrics should be Some");
        assert!(
            lyrics.contains("Santo, Santo, Santo"),
            "lyrics should contain first stanza"
        );
        assert!(
            lyrics.contains("Senhor Deus Todo-Poderoso"),
            "lyrics should contain second stanza"
        );
    }

    #[test]
    fn get_hymns_from_content_db_returns_lyrics() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        assert_eq!(hymns.len(), 1);
        let lyrics = hymns[0].lyrics.as_deref().expect("lyrics should be Some");
        assert!(
            lyrics.contains("Santo, Santo, Santo"),
            "lyrics should contain first stanza"
        );
        assert!(
            lyrics.contains("Senhor Deus Todo-Poderoso"),
            "lyrics should contain second stanza"
        );
    }

    #[test]
    fn get_hymn_with_no_lyrics_returns_none() {
        let conn = make_content_db();
        seed_basic(&conn);
        // Insert a second hymn with no lyrics
        conn.execute_batch(
            "INSERT INTO musics VALUES (2, 'Aleluia', 'pt', NULL, NULL, NULL, '', '');
             INSERT INTO albums_musics VALUES (1, 2, 2);"
        ).unwrap();
        let hymn = get_hymn_by_id_from_content_db(&conn, 2, "pt-BR").unwrap();
        assert_eq!(hymn.lyrics, None, "hymn with no lyrics rows should return None");
    }

    #[test]
    fn get_hymn_with_no_lyrics_table_returns_none() {
        // Content DB without a lyrics table - should not crash, should return None
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE musics (id_music INTEGER PRIMARY KEY, name TEXT NOT NULL, id_language TEXT, id_file_music INTEGER, id_file_instrumental_music INTEGER, id_file_image INTEGER, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
             CREATE TABLE albums (id_album INTEGER PRIMARY KEY, name TEXT NOT NULL, id_language TEXT, id_file_image INTEGER, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
             CREATE TABLE albums_musics (id_album INTEGER, id_music INTEGER, track INTEGER);
             CREATE TABLE files (id_file INTEGER PRIMARY KEY, dir TEXT, name TEXT);
             INSERT INTO musics VALUES (1, 'Hino', 'pt', NULL, NULL, NULL, '', '');
             INSERT INTO albums VALUES (1, 'Album', 'pt', NULL, '', '');
             INSERT INTO albums_musics VALUES (1, 1, 1);"
        ).unwrap();
        // No lyrics table!
        let hymn = get_hymn_by_id_from_content_db(&conn, 1, "pt-BR").unwrap();
        assert_eq!(hymn.lyrics, None, "when lyrics table absent, should return None not error");
    }

    #[test]
    fn get_hymns_from_content_db_filters_by_hymnal_category() {
        let conn = make_content_db();
        // Create categories tables
        conn.execute_batch(
            "CREATE TABLE categories (id_category INTEGER PRIMARY KEY, slug TEXT);
             CREATE TABLE categories_albums (id_category INTEGER, id_album INTEGER, id_language TEXT);",
        ).unwrap();
        seed_basic(&conn);

        // Album 1 (from seed_basic: '1992 - Brilha Jesus') → hymnal category
        // Album 2 → music category (should be excluded)
        conn.execute_batch(
            "INSERT INTO categories VALUES (1, 'hymnal');
             INSERT INTO categories VALUES (2, 'music');
             INSERT INTO categories_albums VALUES (1, 1, 'pt');
             INSERT INTO albums VALUES (2, 'Musicas Contemporaneas', 'pt', NULL, '', '');
             INSERT INTO musics VALUES (2, 'Musica Pop', 'pt', NULL, NULL, NULL, '', '');
             INSERT INTO albums_musics VALUES (2, 2, 1);
             INSERT INTO categories_albums VALUES (2, 2, 'pt');",
        ).unwrap();

        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        // Only the hymnal item (id=1, 'Santo') should be returned; 'Musica Pop' is excluded
        assert_eq!(hymns.len(), 1, "expected 1 hymnal item, got {}: {:?}", hymns.len(), hymns.iter().map(|h| &h.title).collect::<Vec<_>>());
        assert_eq!(hymns[0].title, "Santo");
    }

    #[test]
    fn get_hymns_from_content_db_returns_all_when_no_categories_tables() {
        let conn = make_content_db();
        seed_basic(&conn);
        // Add a second song in a second album — no categories tables present
        conn.execute_batch(
            "INSERT INTO albums VALUES (2, 'Album 2', 'pt', NULL, '', '');
             INSERT INTO musics VALUES (2, 'Aleluia', 'pt', NULL, NULL, NULL, '', '');
             INSERT INTO albums_musics VALUES (2, 2, 1);",
        ).unwrap();

        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        // No category filter → both songs returned
        assert_eq!(hymns.len(), 2, "expected 2 hymns when categories tables absent, got {}", hymns.len());
    }

    #[test]
    fn get_hymns_from_content_db_paths_are_correctly_concatenated() {
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        assert_eq!(hymns.len(), 1);
        // Raw paths (before resolve) should be concatenated dir + '/' + name
        assert_eq!(hymns[0].audio_path.as_deref(), Some("/musics/pt/BrilhaJesus/song01.mp3"));
        assert_eq!(hymns[0].cover_path.as_deref(), Some("/covers/brj.jpg"));
        assert_eq!(hymns[0].playback_path.as_deref(), Some("/musics/pt/BrilhaJesus/song01_instrumental.mp3"));
        // Category is always 'hymnal' from content DB
        assert_eq!(hymns[0].category.as_deref(), Some("hymnal"));
        // api_music_id is set to the music's id
        assert_eq!(hymns[0].api_music_id, Some(1));
    }

    #[test]
    fn get_collections_from_content_db_returns_cover_path() {
        let conn = make_content_db();
        seed_basic(&conn);
        let collections = get_collections_from_content_db(&conn, "pt-BR").unwrap();
        assert_eq!(collections.len(), 1);
        assert_eq!(collections[0].name, "1992 - Brilha Jesus");
        assert_eq!(collections[0].cover_path.as_deref(), Some("/covers/brj.jpg"));
        assert_eq!(collections[0].source_type, "api");
        assert!(collections[0].song_count > 0);
    }

    #[test]
    fn get_collections_from_content_db_returns_none_cover_when_no_image() {
        // Album with no cover image (id_file_image = NULL)
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch("
            CREATE TABLE musics (id_music INTEGER PRIMARY KEY, name TEXT NOT NULL, id_language TEXT, id_file_music INTEGER, id_file_instrumental_music INTEGER, id_file_image INTEGER, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
            CREATE TABLE albums (id_album INTEGER PRIMARY KEY, name TEXT NOT NULL, id_language TEXT, id_file_image INTEGER, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
            CREATE TABLE albums_musics (id_album INTEGER, id_music INTEGER, track INTEGER);
            CREATE TABLE files (id_file INTEGER PRIMARY KEY, dir TEXT, name TEXT);
            CREATE TABLE lyrics (id_lyric INTEGER PRIMARY KEY, id_music INTEGER, lyric TEXT, \"order\" INTEGER, show_slide INTEGER, id_language TEXT);
            INSERT INTO albums VALUES (1, 'No Cover Album', 'pt', NULL, '', '');
            INSERT INTO musics VALUES (1, 'Test', 'pt', NULL, NULL, NULL, '', '');
            INSERT INTO albums_musics VALUES (1, 1, 1);
        ").unwrap();
        let collections = get_collections_from_content_db(&conn, "pt-BR").unwrap();
        assert_eq!(collections.len(), 1);
        assert_eq!(collections[0].cover_path, None, "album with no image file should have None cover_path");
    }

    /// Helper: content DB with time + instrumental_time columns in lyrics table.
    fn make_content_db_with_sync() -> rusqlite::Connection {
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
            CREATE TABLE albums_musics (id_album INTEGER, id_music INTEGER, track INTEGER);
            CREATE TABLE files (id_file INTEGER PRIMARY KEY, dir TEXT, name TEXT);
            CREATE TABLE lyrics (
                id_lyric INTEGER PRIMARY KEY,
                id_music INTEGER,
                lyric TEXT,
                \"order\" INTEGER,
                show_slide INTEGER,
                id_language TEXT,
                time TEXT,
                instrumental_time TEXT
            );",
        ).unwrap();
        conn
    }

    fn seed_with_sync(conn: &rusqlite::Connection) {
        conn.execute_batch(
            "INSERT INTO albums VALUES (1, '1992 - Brilha Jesus', 'pt', NULL, '', '');
             INSERT INTO musics VALUES (1, 'Santo', 'pt', NULL, NULL, NULL, '', '');
             INSERT INTO albums_musics VALUES (1, 1, 1);
             INSERT INTO lyrics VALUES (1, 1, 'Santo, Santo, Santo',     1, 1, 'pt', '00:00:03', '00:00:05');
             INSERT INTO lyrics VALUES (2, 1, 'Senhor Deus Todo-Poderoso', 2, 1, 'pt', '00:00:07', '00:00:09');",
        ).unwrap();
    }

    #[test]
    fn get_hymn_by_id_returns_lyrics_sync_json_with_time() {
        let conn = make_content_db_with_sync();
        seed_with_sync(&conn);
        let hymn = get_hymn_by_id_from_content_db(&conn, 1, "pt-BR").unwrap();
        let sync_json = hymn.lyrics_sync.expect("lyrics_sync should be Some when time columns exist");
        // Verify the JSON shape expected by parse_lyrics_sync_points (music_sync.rs)
        assert!(sync_json.contains("\"time\""), "lyrics_sync JSON must contain 'time' key: {sync_json}");
        assert!(sync_json.contains("\"instrumentalTime\""), "lyrics_sync JSON must contain 'instrumentalTime' key: {sync_json}");
        // Stanza 1: time=00:00:03, instrumental_time=00:00:05
        assert!(sync_json.contains("00:00:03"), "must contain timing for stanza 1: {sync_json}");
        assert!(sync_json.contains("00:00:05"), "must contain instrumental timing for stanza 1: {sync_json}");
        // Stanza 2: time=00:00:07, instrumental_time=00:00:09
        assert!(sync_json.contains("00:00:07"), "must contain timing for stanza 2: {sync_json}");
        assert!(sync_json.contains("00:00:09"), "must contain instrumental timing for stanza 2: {sync_json}");
    }

    #[test]
    fn get_hymns_from_content_db_returns_lyrics_sync_when_time_columns_exist() {
        let conn = make_content_db_with_sync();
        seed_with_sync(&conn);
        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        assert_eq!(hymns.len(), 1);
        assert!(hymns[0].lyrics_sync.is_some(), "lyrics_sync must be populated when time columns exist");
    }

    #[test]
    fn get_hymns_from_content_db_lyrics_sync_null_when_no_time_column() {
        // make_content_db() creates lyrics without time columns → lyrics_sync stays NULL
        let conn = make_content_db();
        seed_basic(&conn);
        let hymns = get_hymns_from_content_db(&conn, "pt-BR", None).unwrap();
        assert_eq!(hymns.len(), 1);
        assert_eq!(hymns[0].lyrics_sync, None, "lyrics_sync must be None when lyrics table has no time column");
    }

    #[test]
    fn get_collection_hymns_returns_lyrics_sync_when_time_columns_exist() {
        let conn = make_content_db_with_sync();
        seed_with_sync(&conn);
        let hymns = get_collection_hymns_from_content_db(&conn, 1, "pt-BR").unwrap();
        assert_eq!(hymns.len(), 1);
        assert!(hymns[0].lyrics_sync.is_some(), "collection hymns must carry lyrics_sync");
    }

    // ── probe_content_db_capabilities tests ─────────────────────────────────

    #[test]
    fn probe_capabilities_bare_db() {
        // In-memory DB with no tables at all → all fields false
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let caps = probe_content_db_capabilities(&conn);
        assert!(!caps.has_fts, "bare DB must not have FTS");
        assert!(!caps.has_lyrics_table, "bare DB must not have lyrics table");
        assert!(!caps.has_categories, "bare DB must not have categories");
        assert!(!caps.has_time_column, "bare DB must not have time column");
        assert!(!caps.has_instrumental_time_column, "bare DB must not have instrumental_time column");
    }

    #[test]
    fn probe_capabilities_full_schema() {
        // DB with all optional tables and columns → all fields true
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE VIRTUAL TABLE musics_fts USING fts5(name);
             CREATE TABLE lyrics (
                id_lyric INTEGER PRIMARY KEY,
                id_music INTEGER,
                lyric TEXT,
                \"order\" INTEGER,
                show_slide INTEGER,
                id_language TEXT,
                time TEXT,
                instrumental_time TEXT
             );
             CREATE TABLE categories (id_category INTEGER PRIMARY KEY, slug TEXT);
             CREATE TABLE categories_albums (id_category INTEGER, id_album INTEGER, id_language TEXT);",
        ).unwrap();
        let caps = probe_content_db_capabilities(&conn);
        assert!(caps.has_fts, "full schema must have FTS");
        assert!(caps.has_lyrics_table, "full schema must have lyrics table");
        assert!(caps.has_categories, "full schema must have categories");
        assert!(caps.has_time_column, "full schema must have time column");
        assert!(caps.has_instrumental_time_column, "full schema must have instrumental_time column");
    }

    #[test]
    fn probe_capabilities_partial_schema() {
        // DB with only the lyrics table (no time columns, no FTS, no categories) → partial
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE lyrics (
                id_lyric INTEGER PRIMARY KEY,
                id_music INTEGER,
                lyric TEXT,
                \"order\" INTEGER,
                show_slide INTEGER,
                id_language TEXT
             );",
        ).unwrap();
        let caps = probe_content_db_capabilities(&conn);
        assert!(!caps.has_fts, "partial schema must not have FTS");
        assert!(caps.has_lyrics_table, "partial schema must have lyrics table");
        assert!(!caps.has_categories, "partial schema must not have categories");
        assert!(!caps.has_time_column, "partial schema must not have time column (no time column in lyrics)");
        assert!(!caps.has_instrumental_time_column, "partial schema must not have instrumental_time column");
    }
}
