pub mod autostart;
pub mod config;
pub mod ipc;
pub mod launcher;
pub mod lifecycle;
pub mod powerpoint;

pub use autostart::{
    bridge_autostart_requested, register_bridge_autostart, unregister_bridge_autostart,
    BridgeAutostartError,
};
pub use config::{BridgeConfig, BridgeConfigError, BridgeTargetApp};
pub use ipc::{
    bootstrap_ipc, probe_bridge_status, request_bridge_apply_config, request_bridge_next,
    request_bridge_previous, request_bridge_shutdown, BridgeApplyConfigIpcResult, BridgeIpcError,
    BridgeRuntime,
};
pub use launcher::{
    launch_bridge_sidecar, BridgeLauncherError, SIDE_CAR_BINARY_NAME, SIDE_CAR_BINARY_PATH,
};
pub use lifecycle::{
    evaluate_config_update, BridgeConfigApplyDecision, BridgeMode, BridgeStartupSource,
    BridgeStatus, BridgeSupervision, BridgeSupervisionExitReason, DEFAULT_HEARTBEAT_TIMEOUT,
};
pub use powerpoint::{
    PowerPointAdapter, PowerPointAdapterError, PowerPointCommand, PowerPointCommandOutcome,
    PowerPointCommandResult,
};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum BridgeBootstrapError {
    #[error("Failed to load bridge config: {0}")]
    Config(#[from] BridgeConfigError),
    #[error("Failed to bootstrap IPC: {0}")]
    Ipc(#[from] BridgeIpcError),
}

pub fn run_bridge(
    startup_source: BridgeStartupSource,
) -> Result<BridgeRuntime, BridgeBootstrapError> {
    let config = BridgeConfig::load()?;
    let runtime = bootstrap_ipc(&config, startup_source)?;
    Ok(runtime)
}
