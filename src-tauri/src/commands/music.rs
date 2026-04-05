use crate::db::models::{Album, Hymn, HymnWriteInput};
use crate::error::AppError;
use crate::state::AppState;


/// Gets a PooledConnection from content_dbs for the first selected language.
/// Returns None if no content DB is available.
fn get_content_db_conn(
    state: &AppState,
    conn: &rusqlite::Connection,
) -> Option<(
    r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>,
    String,
)> {
    let langs = crate::db::queries::content_sync::get_selected_languages(conn);
    let lang = langs.into_iter().next()?;
    let map = state.content_dbs.read().ok()?;
    let pool = map.get(&lang)?.clone(); // clone pool before dropping lock
    drop(map); // release lock before .get()
    let pooled = pool.get().ok()?;
    Some((pooled, lang))
}

fn resolve_hymn_paths(
    mut hymns: Vec<Hymn>,
    app_data_dir: &std::path::Path,
) -> Vec<Hymn> {
    use std::sync::atomic::{AtomicBool, Ordering};
    static LOGGED_SAMPLE: AtomicBool = AtomicBool::new(false);

    for h in &mut hymns {
        if let Some(ref p) = h.audio_path {
            let raw = p.clone();
            h.audio_path = Some(
                app_data_dir
                    .join(p.trim_start_matches('/'))
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
            // Log the first resolved path to help diagnose path mismatches
            if !LOGGED_SAMPLE.swap(true, Ordering::Relaxed) {
                let resolved = h.audio_path.as_deref().unwrap_or("");
                let exists = std::path::Path::new(resolved).exists();
                log::info!(
                    "[resolve_hymn_paths] app_data_dir={:?} | raw={} | resolved={} | exists={}",
                    app_data_dir, raw, resolved, exists
                );
            }
        }
        if let Some(ref p) = h.playback_path {
            h.playback_path = Some(
                app_data_dir
                    .join(p.trim_start_matches('/'))
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
        if let Some(ref p) = h.cover_path {
            h.cover_path = Some(
                app_data_dir
                    .join(p.trim_start_matches('/'))
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
    }
    hymns
}

#[tauri::command]
#[specta::specta]
pub fn search_hymns(
    app: tauri::AppHandle,
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    use tauri::Manager;
    let conn = state.db.get()?;

    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        let hymns =
            crate::db::queries::music::search_hymns_content_db(&content_conn, &query, &lang)?;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_hymn_paths(hymns, &app_data));
    }

    // Fallback to main DB
    crate::db::queries::music::search_hymns(&conn, &query)
}

#[tauri::command]
#[specta::specta]
pub fn search_all_hymns(
    app: tauri::AppHandle,
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    use tauri::Manager;
    let conn = state.db.get()?;

    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        let hymns =
            crate::db::queries::music::search_hymns_content_db(&content_conn, &query, &lang)?;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_hymn_paths(hymns, &app_data));
    }

    // Fallback to main DB
    crate::db::queries::music::search_all_hymns(&conn, &query)
}

#[tauri::command]
#[specta::specta]
pub fn search_all_music(
    app: tauri::AppHandle,
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    use tauri::Manager;
    let conn = state.db.get()?;

    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        let hymns =
            crate::db::queries::music::search_all_music_content_db(&content_conn, &query, &lang)?;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_hymn_paths(hymns, &app_data));
    }

    // Fallback to main DB
    crate::db::queries::music::search_all_music(&conn, &query)
}

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

#[tauri::command]
#[specta::specta]
pub fn get_albums(state: tauri::State<'_, AppState>) -> Result<Vec<Album>, AppError> {
    let conn = state.db.get()?;
    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        return crate::db::queries::music::get_albums_from_content_db(&content_conn, &lang);
    }
    crate::db::queries::music::get_albums(&conn)
}

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

#[tauri::command]
#[specta::specta]
pub fn create_hymn(
    input: HymnWriteInput,
    state: tauri::State<'_, AppState>,
) -> Result<Hymn, AppError> {
    validate_hymn_input(&input)?;
    let conn = state.db.get()?;
    let tx = conn.unchecked_transaction()?;
    let hymn_id = crate::db::queries::music::insert_hymn(&tx, &input)?;
    let hymn = crate::db::queries::music::get_hymn_by_id(&tx, hymn_id)?;
    tx.commit()?;
    Ok(hymn)
}

#[tauri::command]
#[specta::specta]
pub fn update_hymn(
    id: i64,
    input: HymnWriteInput,
    state: tauri::State<'_, AppState>,
) -> Result<Hymn, AppError> {
    validate_hymn_input(&input)?;
    let conn = state.db.get()?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::music::update_hymn(&tx, id, &input)?;
    let hymn = crate::db::queries::music::get_hymn_by_id(&tx, id)?;
    tx.commit()?;
    Ok(hymn)
}

#[tauri::command]
#[specta::specta]
pub fn delete_hymn(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state.db.get()?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::music::delete_hymn(&tx, id)?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use crate::db::models::Hymn;

    fn make_hymn(audio: Option<&str>, cover: Option<&str>, playback: Option<&str>) -> Hymn {
        Hymn {
            id: 1,
            number: Some(1),
            title: "Test".to_string(),
            author: None,
            album: None,
            lyrics: None,
            chords: None,
            audio_path: audio.map(str::to_string),
            playback_path: playback.map(str::to_string),
            category: Some("hymnal".to_string()),
            notes: None,
            cover_path: cover.map(str::to_string),
            lyrics_sync: None,
            api_music_id: None,
            created_at: "".to_string(),
            updated_at: "".to_string(),
        }
    }

    #[test]
    fn resolve_hymn_paths_strips_leading_slash_and_resolves() {
        let app_dir = PathBuf::from("/app/data");
        let hymns = vec![make_hymn(
            Some("/musics/pt/BrilhaJesus/song01.mp3"),
            Some("/covers/brj.jpg"),
            Some("/musics/pt/BrilhaJesus/song01_inst.mp3"),
        )];
        let resolved = super::resolve_hymn_paths(hymns, &app_dir);
        assert_eq!(
            resolved[0].audio_path.as_deref(),
            Some("/app/data/musics/pt/BrilhaJesus/song01.mp3")
        );
        assert_eq!(
            resolved[0].cover_path.as_deref(),
            Some("/app/data/covers/brj.jpg")
        );
        assert_eq!(
            resolved[0].playback_path.as_deref(),
            Some("/app/data/musics/pt/BrilhaJesus/song01_inst.mp3")
        );
    }

    #[test]
    fn resolve_hymn_paths_none_paths_remain_none() {
        let app_dir = PathBuf::from("/app/data");
        let hymns = vec![make_hymn(None, None, None)];
        let resolved = super::resolve_hymn_paths(hymns, &app_dir);
        assert_eq!(resolved[0].audio_path, None);
        assert_eq!(resolved[0].cover_path, None);
        assert_eq!(resolved[0].playback_path, None);
    }
}

fn validate_hymn_input(input: &HymnWriteInput) -> Result<(), AppError> {
    if input.title.trim().is_empty() {
        return Err(AppError::Internal("Hymn title is required.".into()));
    }
    if let Some(number) = input.number {
        if number < 0 {
            return Err(AppError::Internal(
                "Hymn number must be greater than or equal to zero.".into(),
            ));
        }
    }
    if let Some(path) = &input.cover_path {
        validate_cover_path(path)?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_hymn_audio_path(
    hymn_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::music::resolve_hymn_audio_path(&conn, hymn_id)
}

fn validate_cover_path(path: &str) -> Result<(), AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::Internal("Cover path cannot be empty.".into()));
    }
    if trimmed.contains("..") {
        return Err(AppError::Internal(
            "Cover path cannot contain parent path traversal segments.".into(),
        ));
    }
    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("data:")
        || trimmed.starts_with("blob:")
    {
        return Err(AppError::Internal(
            "Cover path must reference managed/local media, not remote URLs.".into(),
        ));
    }
    Ok(())
}
