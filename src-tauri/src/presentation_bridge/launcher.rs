use tauri::AppHandle;
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use thiserror::Error;

pub const SIDE_CAR_BINARY_NAME: &str = "presentation-bridge";
pub const SIDE_CAR_BINARY_PATH: &str = "binaries/presentation-bridge";

pub fn launch_bridge_sidecar<S>(
    app: &AppHandle,
    args: impl IntoIterator<Item = S>,
) -> Result<CommandChild, BridgeLauncherError>
where
    S: AsRef<str>,
{
    let command = app
        .shell()
        .sidecar(SIDE_CAR_BINARY_NAME)
        .map_err(BridgeLauncherError::CreateCommand)?;
    let command = command.args(args.into_iter().map(|arg| arg.as_ref().to_string()));
    let (_events, child) = command.spawn().map_err(BridgeLauncherError::Spawn)?;
    Ok(child)
}

#[derive(Debug, Error)]
pub enum BridgeLauncherError {
    #[error("Failed to create bridge sidecar command: {0}")]
    CreateCommand(#[source] tauri_plugin_shell::Error),
    #[error("Failed to spawn bridge sidecar: {0}")]
    Spawn(#[source] tauri_plugin_shell::Error),
}
