use crate::db::models::{MediaIntegrityReport, MissingFile};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use std::collections::HashSet;
use std::fs;
use tauri::{AppHandle, Manager};

#[tauri::command]
#[specta::specta]
pub async fn scan_media_integrity(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<MediaIntegrityReport, AppError> {
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    let mut referenced_paths = HashSet::new();
    let mut missing_files = Vec::new();

    // 1. Scan Hymns (Audio, Playback, Cover)
    let mut stmt = conn.prepare(
        "SELECT id, title, number, audio_path, playback_path, cover_path FROM hymns",
    )?;
    let hymn_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<i32>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
        ))
    })?;

    for row in hymn_rows {
        let (id, title, number, audio, playback, cover) = row?;
        let name = match number {
            Some(n) => format!("{} - {}", n, title),
            None => title,
        };

        for path_opt in [audio, playback, cover] {
            if let Some(p) = path_opt {
                if !p.trim().is_empty() {
                    referenced_paths.insert(p.clone());
                    let full_path = app_data_dir.join(&p);
                    if !full_path.exists() {
                        missing_files.push(MissingFile {
                            path: p,
                            source_type: "hymn".into(),
                            source_id: id,
                            source_name: name.clone(),
                        });
                    }
                }
            }
        }
    }

    // 2. Scan Slides (background_image, video_path)
    let mut stmt = conn.prepare("SELECT id, presentation_id, background_image, video_path FROM slides")?;
    let slide_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
        ))
    })?;

    for row in slide_rows {
        let (id, pres_id, bg, video) = row?;
        for path_opt in [bg, video] {
            if let Some(p) = path_opt {
                if !p.trim().is_empty() {
                    referenced_paths.insert(p.clone());
                    let full_path = app_data_dir.join(&p);
                    if !full_path.exists() {
                        missing_files.push(MissingFile {
                            path: p,
                            source_type: "slide".into(),
                            source_id: id,
                            source_name: format!("Slide {} (Pres {})", id, pres_id),
                        });
                    }
                }
            }
        }
    }

    // 3. Scan File System for Excess Files
    let mut excess_files = Vec::new();
    let media_root = app_data_dir.join("media");
    if media_root.exists() {
        for entry in walkdir::WalkDir::new(&media_root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let full_path = entry.path();
            if let Ok(rel_path) = full_path.strip_prefix(&app_data_dir) {
                let rel_str = rel_path.to_string_lossy().to_string();
                // Replace backslashes with forward slashes for cross-platform DB consistency
                let normalized_rel = rel_str.replace("\\", "/");
                if !referenced_paths.contains(&normalized_rel) {
                    excess_files.push(normalized_rel);
                }
            }
        }
    }

    Ok(MediaIntegrityReport {
        missing_files,
        excess_files,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn delete_excess_media(
    paths: Vec<String>,
    app: AppHandle,
) -> Result<(), AppError> {
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    for path in paths {
        let full_path = app_data_dir.join(&path);
        // Security: Ensure the path is inside the media directory
        if !full_path.starts_with(app_data_dir.join("media")) {
            return Err(AppError::Internal(format!("Security violation: attempt to delete file outside media directory: {}", path)));
        }
        if full_path.exists() && full_path.is_file() {
            fs::remove_file(full_path)?;
        }
    }

    Ok(())
}
