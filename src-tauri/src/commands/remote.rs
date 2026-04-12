use crate::error::AppError;
use crate::remote::server::RemoteServer;
use crate::state::AppState;
use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Serialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatus {
    pub running: bool,
    pub ip: Option<String>,
    pub port: u16,
}

fn emit_status(app: &AppHandle, status: &RemoteStatus) {
    let _ = app.emit("remote-server-status", status.clone());
}

#[tauri::command]
#[specta::specta]
pub fn start_remote_server(
    app: AppHandle,
    state: State<'_, AppState>,
    port: Option<u16>,
) -> Result<RemoteStatus, AppError> {
    let preferred = port.unwrap_or(7456);
    let mut handle = state.remote.server_handle.lock()?;

    // If already running, return current status
    if let Some(ref server) = *handle {
        if server.is_running() {
            let status = RemoteStatus {
                running: true,
                ip: crate::net::get_lan_ip(),
                port: server.port,
            };
            return Ok(status);
        }
    }

    let mut server = RemoteServer::new();
    let actual_port = server.start(preferred)?;
    let status = RemoteStatus {
        running: true,
        ip: crate::net::get_lan_ip(),
        port: actual_port,
    };
    *handle = Some(server);
    emit_status(&app, &status);
    Ok(status)
}

#[tauri::command]
#[specta::specta]
pub fn stop_remote_server(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<RemoteStatus, AppError> {
    let mut handle = state.remote.server_handle.lock()?;
    if let Some(ref mut server) = *handle {
        server.stop();
    }
    *handle = None;
    let status = RemoteStatus {
        running: false,
        ip: crate::net::get_lan_ip(),
        port: 0,
    };
    emit_status(&app, &status);
    Ok(status)
}

#[tauri::command]
#[specta::specta]
pub fn get_remote_status(state: State<'_, AppState>) -> Result<RemoteStatus, AppError> {
    let handle = state.remote.server_handle.lock()?;
    match handle.as_ref() {
        Some(server) if server.is_running() => Ok(RemoteStatus {
            running: true,
            ip: crate::net::get_lan_ip(),
            port: server.port,
        }),
        _ => Ok(RemoteStatus {
            running: false,
            ip: crate::net::get_lan_ip(),
            port: 0,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_status_serializes() {
        let s = RemoteStatus {
            running: false,
            ip: Some("192.168.1.10".into()),
            port: 7456,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"running\":false"));
        assert!(json.contains("\"port\":7456"));
        assert!(json.contains("\"ip\":\"192.168.1.10\""));
    }
}
