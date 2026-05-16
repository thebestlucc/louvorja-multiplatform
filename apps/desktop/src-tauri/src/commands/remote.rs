use crate::error::AppError;
use crate::remote::pairing::PairingSession;
use crate::remote::routes::pair::PairRouteState;
use crate::remote::server::RemoteServer;
use crate::state::AppState;
use serde::Serialize;
use specta::Type;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Listener, State};

#[derive(Serialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatus {
    pub running: bool,
    pub ip: Option<String>,
    pub port: u16,
    pub connections: usize,
}

pub fn emit_status(app: &AppHandle, status: &RemoteStatus) {
    let _ = app.emit("remote-server-status", status.clone());
}

/// Internal helper for starting the remote server. Used by both the Tauri command
/// and the auto-start logic in `lib.rs`.
pub fn do_start_remote_server(app: &AppHandle, state: &AppState, port: Option<u16>) -> Result<RemoteStatus, AppError> {
    let preferred = port.unwrap_or(7456);
    let mut handle = state.remote.server_handle.lock()?;

    // If already running, return current status
    if let Some(ref server) = *handle {
        if server.is_running() {
            let connections = state.remote.connections.lock().map(|c| c.len()).unwrap_or(0);
            let status = RemoteStatus {
                running: true,
                ip: crate::net::get_lan_ip(),
                port: server.port,
                connections,
            };
            return Ok(status);
        }
    }

    // Wire Tauri event listeners → broadcast channel.
    let handles = crate::remote::events::listen_and_broadcast(
        app,
        (*state.remote.broadcast_tx).clone(),
        state.remote.connections.clone(),
    );
    *state.remote.listener_handles.lock()? = handles;

    let pair_state = PairRouteState {
        db: state.db.clone(),
        pairing: state.remote.pairing.clone(),
        nonce_cache: state.remote.nonce_cache.clone(),
        server_name: "LouvorJA".to_string(),
        app_handle: Some(app.clone()),
        broadcast_tx: state.remote.broadcast_tx.clone(),
        connections: state.remote.connections.clone(),
        pin_limiter: state.remote.pin_limiter.clone(),
        pair_rate_limiter: state.remote.pair_rate_limiter.clone(),
        suspicious_tracker: state.remote.suspicious_tracker.clone(),
    };

    let mut server = RemoteServer::new();
    let actual_port = server.start_with_state(preferred, Some(pair_state))?;
    let status = RemoteStatus {
        running: true,
        ip: crate::net::get_lan_ip(),
        port: actual_port,
        connections: 0,
    };
    *handle = Some(server);
    crate::commands::remote::emit_status(app, &status);
    Ok(status)
}

#[tauri::command]
#[specta::specta]
pub fn start_remote_server(
    app: AppHandle,
    state: State<'_, AppState>,
    port: Option<u16>,
) -> Result<RemoteStatus, AppError> {
    do_start_remote_server(&app, &state, port)
}

#[tauri::command]
#[specta::specta]
pub fn stop_remote_server(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<RemoteStatus, AppError> {
    // Unregister all event listeners.
    {
        let mut handles = state.remote.listener_handles.lock()?;
        for id in handles.drain(..) {
            app.unlisten(id);
        }
    }
    let mut handle = state.remote.server_handle.lock()?;
    if let Some(ref mut server) = *handle {
        server.stop();
    }
    *handle = None;
    let status = RemoteStatus {
        running: false,
        ip: crate::net::get_lan_ip(),
        port: 0,
        connections: 0,
    };
    emit_status(&app, &status);
    Ok(status)
}

#[tauri::command]
#[specta::specta]
pub fn get_remote_status(state: State<'_, AppState>) -> Result<RemoteStatus, AppError> {
    let connections = state.remote.connections.lock().map(|c| c.len()).unwrap_or(0);
    let handle = state.remote.server_handle.lock()?;
    match handle.as_ref() {
        Some(server) if server.is_running() => Ok(RemoteStatus {
            running: true,
            ip: crate::net::get_lan_ip(),
            port: server.port,
            connections,
        }),
        _ => Ok(RemoteStatus {
            running: false,
            ip: crate::net::get_lan_ip(),
            port: 0,
            connections: 0,
        }),
    }
}

// Re-export so frontend bindings include the type.
pub use crate::db::models::RemoteDevice;

/// Info returned by `begin_pairing` — includes a one-time token, 6-digit PIN,
/// expiry timestamp (unix seconds), QR SVG string, and the pairing URL.
#[derive(Serialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PairingInfo {
    pub token: String,
    pub pin: String,
    pub expires_at: i64,
    pub qr_svg: String,
    pub url: String,
}

/// Open a 120-second pairing window. A second call replaces any existing session.
#[tauri::command]
#[specta::specta]
pub fn begin_pairing(state: State<'_, AppState>) -> Result<PairingInfo, AppError> {
    // Require the server to be running (we need ip + port for the URL).
    let (ip, port) = {
        let handle = state.remote.server_handle.lock()?;
        match handle.as_ref() {
            Some(s) if s.is_running() => (
                crate::net::get_lan_ip().unwrap_or_else(|| "127.0.0.1".to_string()),
                s.port,
            ),
            _ => {
                return Err(AppError::Internal(
                    "Remote server is not running".into(),
                ))
            }
        }
    };

    let ttl = Duration::from_secs(120);
    let session = PairingSession::new(ttl);
    let url = format!("http://{}:{}/pair?token={}", ip, port, session.token);
    let qr_svg = crate::remote::qr::render_svg(&url);

    // expires_at in unix seconds
    let expires_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
        + 120;

    let info = PairingInfo {
        token: session.token.clone(),
        pin: session.pin.clone(),
        expires_at,
        qr_svg,
        url,
    };

    *state.remote.pairing.lock()? = Some(session);
    Ok(info)
}

/// Cancel an in-progress pairing window early.
#[tauri::command]
#[specta::specta]
pub fn cancel_pairing(state: State<'_, AppState>) -> Result<(), AppError> {
    *state.remote.pairing.lock()? = None;
    Ok(())
}

/// List all non-revoked paired devices.
#[tauri::command]
#[specta::specta]
pub fn list_paired_devices(state: State<'_, AppState>) -> Result<Vec<RemoteDevice>, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::remote::list_devices(&conn)
}

/// Revoke a device by ID — removes it from the active list and closes any live WS connection.
#[tauri::command]
#[specta::specta]
pub fn revoke_paired_device(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let conn = state.db.get()?;
    crate::db::queries::remote::revoke_device(&conn, &id)?;
    // Close any active WS connection for this device (placeholder — wired in D3).
    {
        let mut conns = state.remote.connections.lock()?;
        if let Ok(uuid) = uuid::Uuid::parse_str(&id) {
            conns.remove(&uuid);
        }
    }
    let _ = app.emit("remote-devices-changed", ());
    Ok(())
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
            connections: 2,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"running\":false"));
        assert!(json.contains("\"port\":7456"));
        assert!(json.contains("\"ip\":\"192.168.1.10\""));
        assert!(json.contains("\"connections\":2"));
    }

    #[test]
    fn remote_device_type_is_exported() {
        // Ensures RemoteDevice is accessible via the commands module re-export.
        let d = RemoteDevice {
            id: "a".into(),
            name: "b".into(),
            created_at: 0,
            last_seen_at: None,
            revoked_at: None,
        };
        assert_eq!(d.name, "b");
    }

    #[test]
    fn pairing_info_serializes_camel_case() {
        let info = PairingInfo {
            token: "abc".into(),
            pin: "123456".into(),
            expires_at: 9999,
            qr_svg: "<svg/>".into(),
            url: "http://1.2.3.4:7456/pair?token=abc".into(),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"expiresAt\":9999"));
        assert!(json.contains("\"qrSvg\":"));
        assert!(json.contains("\"pin\":\"123456\""));
    }
}
