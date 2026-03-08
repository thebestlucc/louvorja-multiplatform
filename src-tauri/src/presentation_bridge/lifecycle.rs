use super::{BridgeConfig, BridgeTargetApp};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::str::FromStr;
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum BridgeMode {
    Managed,
    Independent,
}

impl Default for BridgeMode {
    fn default() -> Self {
        Self::Managed
    }
}

impl FromStr for BridgeMode {
    type Err = &'static str;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "managed" => Ok(Self::Managed),
            "independent" => Ok(Self::Independent),
            _ => Err("invalid bridge mode"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum BridgeStartupSource {
    SpawnedByApp,
    StartedByOs,
    StartedManually,
}

impl FromStr for BridgeStartupSource {
    type Err = &'static str;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "spawned-by-app" => Ok(Self::SpawnedByApp),
            "started-by-os" => Ok(Self::StartedByOs),
            "started-manually" => Ok(Self::StartedManually),
            _ => Err("invalid bridge startup source"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    pub version: String,
    pub pid: u32,
    pub session_id: String,
    pub mode: BridgeMode,
    pub startup_source: BridgeStartupSource,
    pub target_app: BridgeTargetApp,
    pub shortcuts_registered: bool,
    pub adapter_healthy: bool,
}

impl BridgeStatus {
    pub fn bootstrap(config: &BridgeConfig, startup_source: BridgeStartupSource) -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            pid: std::process::id(),
            session_id: Uuid::new_v4().to_string(),
            mode: config.mode(),
            startup_source,
            target_app: config.target_app,
            shortcuts_registered: config.enabled,
            adapter_healthy: true,
        }
    }
}

pub const DEFAULT_HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BridgeSupervisionExitReason {
    SupervisorHeartbeatTimedOut,
    ParentProcessExited,
}

#[derive(Debug, Clone)]
pub struct BridgeSupervision {
    mode: BridgeMode,
    heartbeat_timeout: Duration,
    last_heartbeat_at: Instant,
    parent_dead: bool,
}

impl BridgeSupervision {
    pub fn new(mode: BridgeMode, heartbeat_timeout: Duration, now: Instant) -> Self {
        Self {
            mode,
            heartbeat_timeout,
            last_heartbeat_at: now,
            parent_dead: false,
        }
    }

    pub fn record_heartbeat(&mut self, now: Instant) {
        self.last_heartbeat_at = now;
    }

    pub fn mark_parent_dead(&mut self) {
        self.parent_dead = true;
    }

    pub fn exit_reason(&self, now: Instant) -> Option<BridgeSupervisionExitReason> {
        if self.mode == BridgeMode::Independent {
            return None;
        }

        if self.parent_dead {
            return Some(BridgeSupervisionExitReason::ParentProcessExited);
        }

        if now.saturating_duration_since(self.last_heartbeat_at) >= self.heartbeat_timeout {
            return Some(BridgeSupervisionExitReason::SupervisorHeartbeatTimedOut);
        }

        None
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum BridgeConfigApplyDecision {
    ApplyLive,
    RestartRequired,
}

pub fn evaluate_config_update(
    current: &BridgeConfig,
    next: &BridgeConfig,
) -> BridgeConfigApplyDecision {
    if current.mode() != next.mode() {
        BridgeConfigApplyDecision::RestartRequired
    } else {
        BridgeConfigApplyDecision::ApplyLive
    }
}

#[cfg(test)]
mod tests {
    use super::{
        evaluate_config_update, BridgeConfigApplyDecision, BridgeMode, BridgeStartupSource,
        BridgeStatus, BridgeSupervision, BridgeSupervisionExitReason,
    };
    use crate::presentation_bridge::config::{BridgeConfig, BridgeTargetApp};
    use serde_json::Value;
    use std::str::FromStr;
    use std::time::{Duration, Instant};

    #[test]
    fn parses_managed_mode() {
        assert_eq!(
            BridgeMode::from_str("managed").unwrap(),
            BridgeMode::Managed
        );
    }

    #[test]
    fn parses_independent_mode() {
        assert_eq!(
            BridgeMode::from_str("independent").unwrap(),
            BridgeMode::Independent
        );
    }

    #[test]
    fn parses_started_by_os_source() {
        assert_eq!(
            BridgeStartupSource::from_str("started-by-os").unwrap(),
            BridgeStartupSource::StartedByOs
        );
    }

    #[test]
    fn bridge_status_serializes_expected_fields() {
        let status = BridgeStatus::bootstrap(
            &BridgeConfig {
                enabled: true,
                start_with_os: true,
                target_app: BridgeTargetApp::PowerPointWindows,
                shortcut_next: "Alt+Right".into(),
                shortcut_prev: "Alt+Left".into(),
            },
            BridgeStartupSource::StartedByOs,
        );

        let json: Value = serde_json::to_value(status).unwrap();
        assert_eq!(json["mode"], "independent");
        assert_eq!(json["startupSource"], "started-by-os");
        assert_eq!(json["version"], env!("CARGO_PKG_VERSION"));
        assert_eq!(json["targetApp"], "power-point-windows");
        assert!(json["pid"].as_u64().is_some());
        assert!(json["sessionId"].as_str().is_some());
    }

    #[test]
    fn managed_mode_requires_supervision() {
        let start = Instant::now();
        let supervision =
            BridgeSupervision::new(BridgeMode::Managed, Duration::from_millis(50), start);

        assert_eq!(
            supervision.exit_reason(start + Duration::from_millis(60)),
            Some(BridgeSupervisionExitReason::SupervisorHeartbeatTimedOut)
        );
    }

    #[test]
    fn independent_mode_ignores_missing_supervision() {
        let start = Instant::now();
        let supervision =
            BridgeSupervision::new(BridgeMode::Independent, Duration::from_millis(50), start);

        assert_eq!(
            supervision.exit_reason(start + Duration::from_secs(1)),
            None
        );
    }

    #[test]
    fn managed_mode_exits_when_parent_dies() {
        let start = Instant::now();
        let mut supervision =
            BridgeSupervision::new(BridgeMode::Managed, Duration::from_secs(10), start);
        supervision.mark_parent_dead();

        assert_eq!(
            supervision.exit_reason(start),
            Some(BridgeSupervisionExitReason::ParentProcessExited)
        );
    }

    #[test]
    fn independent_mode_survives_parent_death_signal() {
        let start = Instant::now();
        let mut supervision =
            BridgeSupervision::new(BridgeMode::Independent, Duration::from_secs(10), start);
        supervision.mark_parent_dead();

        assert_eq!(supervision.exit_reason(start), None);
    }

    #[test]
    fn lifecycle_mode_changes_require_restart() {
        let current = BridgeConfig {
            enabled: true,
            start_with_os: false,
            target_app: BridgeTargetApp::PowerPointWindows,
            shortcut_next: "Alt+Right".into(),
            shortcut_prev: "Alt+Left".into(),
        };
        let next = BridgeConfig {
            start_with_os: true,
            ..current.clone()
        };

        assert_eq!(
            evaluate_config_update(&current, &next),
            BridgeConfigApplyDecision::RestartRequired
        );
    }
}
