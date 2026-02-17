use crate::error::AppError;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<Option<UpdateInfo>, AppError> {
    let updater = match app.updater() {
        Ok(instance) => instance,
        Err(_) => return Ok(None),
    };

    let update = match updater.check().await {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };

    Ok(update.map(|item| UpdateInfo {
        version: item.version.clone(),
        current_version: app.package_info().version.to_string(),
        notes: item.body.clone(),
    }))
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), AppError> {
    let updater = app
        .updater()
        .map_err(|e| AppError::Internal(format!("Updater init failed: {}", e)))?;

    let update = updater
        .check()
        .await
        .map_err(|e| AppError::Internal(format!("Update check failed: {}", e)))?;

    let Some(update) = update else {
        return Ok(());
    };

    update
        .download_and_install(
            |_chunk_length, _content_length| {},
            || {},
        )
        .await
        .map_err(|e| AppError::Internal(format!("Install update failed: {}", e)))?;

    Ok(())
}
