use crate::error::AppError;
use crate::utils::catcher::catcher;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn check_for_updates(app: AppHandle) -> Result<Option<UpdateInfo>, AppError> {
    let (updater, err) = catcher(app.updater());
    if err.is_some() {
        return Ok(None);
    }
    let updater = updater.unwrap();

    let (update, err) = catcher(updater.check().await);
    if err.is_some() {
        return Ok(None);
    }
    let update = update.unwrap();

    Ok(update.map(|item| UpdateInfo {
        version: item.version.clone(),
        current_version: app.package_info().version.to_string(),
        notes: item.body.clone(),
    }))
}

#[tauri::command]
#[specta::specta]
pub async fn install_update(app: AppHandle) -> Result<(), AppError> {
    let (updater, err) = catcher(app.updater());
    if let Some(e) = err {
        return Err(AppError::Internal(format!("Updater init failed: {}", e)));
    }
    let updater = updater.unwrap();

    let (update, err) = catcher(updater.check().await);
    if let Some(e) = err {
        return Err(AppError::Internal(format!("Update check failed: {}", e)));
    }
    let update = update.unwrap();

    let Some(update) = update else {
        return Ok(());
    };

    let (_, err) = catcher(update.download_and_install(|_chunk_length, _content_length| {}, || {}).await);
    if let Some(e) = err {
        return Err(AppError::Internal(format!("Install update failed: {}", e)));
    }

    Ok(())
}
