use super::lifecycle::BridgeMode;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

const BRIDGE_CONFIG_FILE_NAME: &str = "presentation-bridge.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum BridgeTargetApp {
    PowerPointWindows,
}

impl Default for BridgeTargetApp {
    fn default() -> Self {
        Self::PowerPointWindows
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeConfig {
    pub enabled: bool,
    pub start_with_os: bool,
    pub target_app: BridgeTargetApp,
    pub shortcut_next: String,
    pub shortcut_prev: String,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            start_with_os: false,
            target_app: BridgeTargetApp::default(),
            shortcut_next: "Alt+Right".into(),
            shortcut_prev: "Alt+Left".into(),
        }
    }
}

impl BridgeConfig {
    pub fn load() -> Result<Self, BridgeConfigError> {
        Self::load_from_path(&Self::path()?)
    }

    pub fn save(&self) -> Result<(), BridgeConfigError> {
        self.save_to_path(&Self::path()?)
    }

    pub fn path() -> Result<PathBuf, BridgeConfigError> {
        Ok(default_bridge_config_dir()?.join(BRIDGE_CONFIG_FILE_NAME))
    }

    pub fn load_from_path(path: &Path) -> Result<Self, BridgeConfigError> {
        match fs::read_to_string(path) {
            Ok(contents) => Ok(serde_json::from_str(&contents)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(error) => Err(error.into()),
        }
    }

    pub fn save_to_path(&self, path: &Path) -> Result<(), BridgeConfigError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let payload = serde_json::to_vec_pretty(self)?;
        fs::write(path, payload)?;
        Ok(())
    }

    pub fn mode(&self) -> BridgeMode {
        if self.start_with_os {
            BridgeMode::Independent
        } else {
            BridgeMode::Managed
        }
    }

    pub fn bridge_global_shortcuts(&self) -> [(&'static str, &str); 2] {
        [
            ("slides-next", self.shortcut_next.as_str()),
            ("slides-prev", self.shortcut_prev.as_str()),
        ]
    }
}

fn default_bridge_config_dir() -> Result<PathBuf, BridgeConfigError> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or(BridgeConfigError::ConfigDirectoryUnavailable)?;
        return Ok(home
            .join("Library")
            .join("Application Support")
            .join("LouvorJA"));
    }

    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .ok_or(BridgeConfigError::ConfigDirectoryUnavailable)?;
        return Ok(appdata.join("LouvorJA"));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(xdg_config_home) = std::env::var_os("XDG_CONFIG_HOME") {
            return Ok(PathBuf::from(xdg_config_home).join("louvorja"));
        }

        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or(BridgeConfigError::ConfigDirectoryUnavailable)?;
        Ok(home.join(".config").join("louvorja"))
    }
}

#[derive(Debug, Error)]
pub enum BridgeConfigError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("Bridge config directory is not available in this environment")]
    ConfigDirectoryUnavailable,
}

#[cfg(test)]
mod tests {
    use super::{BridgeConfig, BridgeTargetApp};
    use tempfile::tempdir;

    #[test]
    fn load_missing_bridge_config_returns_defaults() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("presentation-bridge.json");

        let config = BridgeConfig::load_from_path(&config_path).unwrap();

        assert!(!config.enabled);
        assert!(!config.start_with_os);
        assert_eq!(config.target_app, BridgeTargetApp::PowerPointWindows);
    }

    #[test]
    fn save_and_reload_bridge_config_round_trips() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("presentation-bridge.json");
        let config = BridgeConfig {
            enabled: true,
            start_with_os: true,
            target_app: BridgeTargetApp::PowerPointWindows,
            shortcut_next: "Alt+PageDown".into(),
            shortcut_prev: "Alt+PageUp".into(),
        };

        config.save_to_path(&config_path).unwrap();
        let reloaded = BridgeConfig::load_from_path(&config_path).unwrap();

        assert_eq!(reloaded, config);
    }
}
