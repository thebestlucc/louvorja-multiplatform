//! `presence.list` op — returns the array of currently connected WS sessions.

use crate::error::AppError;
use tauri::Manager;

/// `presence.list` → `{ connections: [{ deviceId, name, connectedAt }] }`
pub async fn list(app: &tauri::AppHandle) -> Result<serde_json::Value, AppError> {
    use crate::remote::state::RemoteServerState;
    let state = app.state::<RemoteServerState>();
    let conns = state
        .connections
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let arr: Vec<serde_json::Value> = conns
        .values()
        .map(|info| {
            serde_json::json!({
                "deviceId":    info.device_id,
                "name":        info.name,
                "connectedAt": info.connected_at,
            })
        })
        .collect();
    Ok(serde_json::json!({ "connections": arr }))
}
