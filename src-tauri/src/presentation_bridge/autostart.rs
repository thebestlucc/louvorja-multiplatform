use super::BridgeConfig;
use tauri::AppHandle;
#[cfg(target_os = "windows")]
use tauri::Manager;
use thiserror::Error;

#[cfg(target_os = "windows")]
const WINDOWS_RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(target_os = "windows")]
const WINDOWS_VALUE_NAME: &str = "LouvorJAPresentationBridge";

pub fn bridge_autostart_requested(config: &BridgeConfig) -> bool {
    config.start_with_os
}

#[cfg(target_os = "windows")]
pub fn register_bridge_autostart(app: &AppHandle) -> Result<(), BridgeAutostartError> {
    use std::path::PathBuf;
    use std::process::Command;

    fn resolve_bridge_binary_path(app: &AppHandle) -> Result<PathBuf, BridgeAutostartError> {
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|error| BridgeAutostartError::Path(error.to_string()))?;

        let resource_candidate = resource_dir.join("presentation-bridge.exe");
        if resource_candidate.exists() {
            return Ok(resource_candidate);
        }

        let current_exe = std::env::current_exe()?;
        let exe_dir = current_exe.parent().ok_or_else(|| {
            BridgeAutostartError::Path("Current executable has no parent directory".into())
        })?;
        let sibling_candidate = exe_dir.join("presentation-bridge.exe");
        if sibling_candidate.exists() {
            return Ok(sibling_candidate);
        }

        Err(BridgeAutostartError::BinaryNotFound(resource_candidate))
    }

    let binary_path = resolve_bridge_binary_path(app)?;
    let launch_command = format!(
        "\"{}\" --startup-source=started-by-os",
        binary_path.display()
    );

    let status = Command::new("reg")
        .args([
            "add",
            WINDOWS_RUN_KEY,
            "/v",
            WINDOWS_VALUE_NAME,
            "/t",
            "REG_SZ",
            "/d",
            &launch_command,
            "/f",
        ])
        .status()?;

    if status.success() {
        Ok(())
    } else {
        Err(BridgeAutostartError::CommandFailed(
            "reg add returned a non-zero exit status".into(),
        ))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn register_bridge_autostart(_app: &AppHandle) -> Result<(), BridgeAutostartError> {
    Err(BridgeAutostartError::UnsupportedPlatform)
}

#[cfg(target_os = "windows")]
pub fn unregister_bridge_autostart() -> Result<(), BridgeAutostartError> {
    use std::process::Command;

    let status = Command::new("reg")
        .args(["delete", WINDOWS_RUN_KEY, "/v", WINDOWS_VALUE_NAME, "/f"])
        .status()?;

    if status.success() {
        Ok(())
    } else {
        Err(BridgeAutostartError::CommandFailed(
            "reg delete returned a non-zero exit status".into(),
        ))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn unregister_bridge_autostart() -> Result<(), BridgeAutostartError> {
    Err(BridgeAutostartError::UnsupportedPlatform)
}

#[derive(Debug, Error)]
pub enum BridgeAutostartError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("Bridge autostart is not implemented for this platform yet")]
    UnsupportedPlatform,
    #[error("Failed to resolve the bridge autostart path: {0}")]
    Path(String),
    #[error("Could not find the packaged presentation-bridge binary at {0}")]
    BinaryNotFound(std::path::PathBuf),
    #[error("Failed to register bridge autostart: {0}")]
    CommandFailed(String),
}

#[cfg(test)]
mod tests {
    use super::bridge_autostart_requested;
    use crate::presentation_bridge::BridgeConfig;

    #[test]
    fn disabled_default_config_does_not_request_autostart_registration() {
        assert!(!bridge_autostart_requested(&BridgeConfig::default()));
    }
}
