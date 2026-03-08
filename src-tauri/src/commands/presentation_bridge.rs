use crate::error::AppError;
use crate::presentation_bridge::{
    bridge_autostart_requested, launch_bridge_sidecar, probe_bridge_status,
    register_bridge_autostart, request_bridge_apply_config, request_bridge_shutdown,
    unregister_bridge_autostart, BridgeAutostartError, BridgeConfig, BridgeConfigApplyDecision,
    BridgeConfigError, BridgeIpcError, BridgeLauncherError, BridgeStatus,
};
use serde::Serialize;
use specta::Type;
use std::thread;
use std::time::{Duration, Instant};
use tauri::AppHandle;

const BRIDGE_START_TIMEOUT: Duration = Duration::from_secs(3);
const BRIDGE_STOP_TIMEOUT: Duration = Duration::from_secs(2);
const BRIDGE_POLL_INTERVAL: Duration = Duration::from_millis(100);

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeManagerStatus {
    pub config: BridgeConfig,
    pub status: Option<BridgeStatus>,
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeApplyConfigResult {
    pub config: BridgeConfig,
    pub status: Option<BridgeStatus>,
    pub running: bool,
    pub decision: BridgeConfigApplyDecision,
}

#[tauri::command]
#[specta::specta]
pub fn bridge_status() -> Result<BridgeManagerStatus, AppError> {
    let config = BridgeConfig::load().map_err(map_bridge_config_error)?;
    let status = probe_bridge_status().map_err(map_bridge_ipc_error)?;
    Ok(BridgeManagerStatus {
        running: status.is_some(),
        status,
        config,
    })
}

#[tauri::command]
#[specta::specta]
pub fn bridge_start(app: AppHandle) -> Result<BridgeManagerStatus, AppError> {
    let config = BridgeConfig::load().map_err(map_bridge_config_error)?;

    if let Some(status) = probe_bridge_status().map_err(map_bridge_ipc_error)? {
        return Ok(BridgeManagerStatus {
            running: true,
            status: Some(status),
            config,
        });
    }

    launch_bridge_sidecar(&app, ["--startup-source=spawned-by-app"])
        .map_err(map_bridge_launcher_error)?;

    let status = wait_for_bridge_status(BRIDGE_START_TIMEOUT)?;
    if status.is_none() {
        return Err(AppError::Internal(
            "presentation-bridge did not expose IPC before the startup timeout.".into(),
        ));
    }

    Ok(BridgeManagerStatus {
        running: true,
        status,
        config,
    })
}

#[tauri::command]
#[specta::specta]
pub fn bridge_stop() -> Result<BridgeManagerStatus, AppError> {
    let config = BridgeConfig::load().map_err(map_bridge_config_error)?;

    if probe_bridge_status()
        .map_err(map_bridge_ipc_error)?
        .is_none()
    {
        return Ok(BridgeManagerStatus {
            running: false,
            status: None,
            config,
        });
    }

    request_bridge_shutdown().map_err(map_bridge_ipc_error)?;
    let status = wait_for_bridge_shutdown(BRIDGE_STOP_TIMEOUT)?;

    Ok(BridgeManagerStatus {
        running: status.is_some(),
        status,
        config,
    })
}

#[tauri::command]
#[specta::specta]
pub fn bridge_apply_config(config: BridgeConfig) -> Result<BridgeApplyConfigResult, AppError> {
    config.save().map_err(map_bridge_config_error)?;

    if probe_bridge_status()
        .map_err(map_bridge_ipc_error)?
        .is_none()
    {
        return Ok(BridgeApplyConfigResult {
            running: false,
            status: None,
            config,
            decision: BridgeConfigApplyDecision::ApplyLive,
        });
    }

    let result = request_bridge_apply_config(&config).map_err(map_bridge_ipc_error)?;
    Ok(BridgeApplyConfigResult {
        running: true,
        status: Some(result.status),
        config,
        decision: result.decision,
    })
}

#[tauri::command]
#[specta::specta]
pub fn bridge_register_autostart(app: AppHandle) -> Result<bool, AppError> {
    let config = BridgeConfig::load().map_err(map_bridge_config_error)?;
    if !bridge_autostart_requested(&config) {
        return Ok(false);
    }

    register_bridge_autostart(&app).map_err(map_bridge_autostart_error)?;
    Ok(true)
}

#[tauri::command]
#[specta::specta]
pub fn bridge_unregister_autostart() -> Result<(), AppError> {
    unregister_bridge_autostart().map_err(map_bridge_autostart_error)
}

fn wait_for_bridge_status(timeout: Duration) -> Result<Option<BridgeStatus>, AppError> {
    let deadline = Instant::now() + timeout;

    loop {
        if let Some(status) = probe_bridge_status().map_err(map_bridge_ipc_error)? {
            return Ok(Some(status));
        }

        if Instant::now() >= deadline {
            return Ok(None);
        }

        thread::sleep(BRIDGE_POLL_INTERVAL);
    }
}

fn wait_for_bridge_shutdown(timeout: Duration) -> Result<Option<BridgeStatus>, AppError> {
    let deadline = Instant::now() + timeout;

    loop {
        let status = probe_bridge_status().map_err(map_bridge_ipc_error)?;
        if status.is_none() {
            return Ok(None);
        }

        if Instant::now() >= deadline {
            return Ok(status);
        }

        thread::sleep(BRIDGE_POLL_INTERVAL);
    }
}

fn map_bridge_config_error(error: BridgeConfigError) -> AppError {
    AppError::Internal(format!("Bridge config error: {error}"))
}

fn map_bridge_ipc_error(error: BridgeIpcError) -> AppError {
    AppError::Internal(format!("Bridge IPC error: {error}"))
}

fn map_bridge_launcher_error(error: BridgeLauncherError) -> AppError {
    AppError::Internal(format!("Bridge launcher error: {error}"))
}

fn map_bridge_autostart_error(error: BridgeAutostartError) -> AppError {
    AppError::Internal(format!("Bridge autostart error: {error}"))
}
