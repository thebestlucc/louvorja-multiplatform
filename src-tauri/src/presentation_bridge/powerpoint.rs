use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum PowerPointCommand {
    Next,
    Previous,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum PowerPointCommandOutcome {
    Success,
    PowerPointNotRunning,
    SlideshowNotActive,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PowerPointCommandResult {
    pub command: PowerPointCommand,
    pub outcome: PowerPointCommandOutcome,
}

#[cfg_attr(not(any(test, target_os = "windows")), allow(dead_code))]
#[derive(Debug, Clone, PartialEq, Eq)]
struct PowerPointHelperOutput {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[cfg_attr(not(any(test, target_os = "windows")), allow(dead_code))]
#[derive(Debug, Deserialize)]
struct PowerPointHelperResponse {
    status: String,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PowerPointAdapter;

impl PowerPointAdapter {
    pub fn new() -> Self {
        Self
    }

    pub fn dispatch(
        &self,
        command: PowerPointCommand,
    ) -> Result<PowerPointCommandResult, PowerPointAdapterError> {
        #[cfg(target_os = "windows")]
        {
            let output = self.run_windows_helper(command)?;
            return self.decode_helper_output(command, output);
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = command;
            Err(PowerPointAdapterError::UnsupportedPlatform)
        }
    }

    #[cfg_attr(not(any(test, target_os = "windows")), allow(dead_code))]
    fn decode_helper_output(
        &self,
        command: PowerPointCommand,
        output: PowerPointHelperOutput,
    ) -> Result<PowerPointCommandResult, PowerPointAdapterError> {
        if output.exit_code.unwrap_or_default() != 0 {
            let stderr = if output.stderr.trim().is_empty() {
                output.stdout.trim().to_string()
            } else {
                output.stderr.trim().to_string()
            };

            return Err(PowerPointAdapterError::HelperFailed {
                exit_code: output.exit_code,
                stderr,
            });
        }

        let response: PowerPointHelperResponse = serde_json::from_str(output.stdout.trim())?;
        let outcome = match response.status.as_str() {
            "ok" => PowerPointCommandOutcome::Success,
            "powerpoint-not-running" => PowerPointCommandOutcome::PowerPointNotRunning,
            "slideshow-not-active" => PowerPointCommandOutcome::SlideshowNotActive,
            unknown => return Err(PowerPointAdapterError::UnknownStatus(unknown.to_string())),
        };

        Ok(PowerPointCommandResult { command, outcome })
    }

    #[cfg(target_os = "windows")]
    fn run_windows_helper(
        &self,
        command: PowerPointCommand,
    ) -> Result<PowerPointHelperOutput, PowerPointAdapterError> {
        let output = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &windows_powershell_script(command),
            ])
            .output()?;

        Ok(PowerPointHelperOutput {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

#[cfg(target_os = "windows")]
fn windows_powershell_script(command: PowerPointCommand) -> String {
    let action = match command {
        PowerPointCommand::Next => "next",
        PowerPointCommand::Previous => "previous",
    };

    format!(
        r#"$ErrorActionPreference = 'Stop'
try {{
  $app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
}} catch {{
  [Console]::Out.WriteLine('{{"status":"powerpoint-not-running"}}')
  exit 0
}}

if ($null -eq $app -or $app.SlideShowWindows.Count -lt 1) {{
  [Console]::Out.WriteLine('{{"status":"slideshow-not-active"}}')
  exit 0
}}

$view = $app.SlideShowWindows.Item(1).View
if ('{action}' -eq 'next') {{
  $view.Next() | Out-Null
}} else {{
  $view.Previous() | Out-Null
}}

[Console]::Out.WriteLine('{{"status":"ok"}}')
"#
    )
}

#[derive(Debug, Error)]
pub enum PowerPointAdapterError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("PowerPoint automation helper failed with exit code {exit_code:?}: {stderr}")]
    HelperFailed {
        exit_code: Option<i32>,
        stderr: String,
    },
    #[error("PowerPoint automation helper returned an unknown status: {0}")]
    UnknownStatus(String),
    #[error("PowerPoint automation is not supported on this platform")]
    UnsupportedPlatform,
}

#[cfg(test)]
mod tests {
    use super::{
        PowerPointAdapter, PowerPointCommand, PowerPointCommandOutcome, PowerPointCommandResult,
        PowerPointHelperOutput,
    };

    #[test]
    fn maps_powerpoint_not_running_outcome() {
        let result = PowerPointAdapter::new()
            .decode_helper_output(
                PowerPointCommand::Next,
                PowerPointHelperOutput {
                    exit_code: Some(0),
                    stdout: r#"{"status":"powerpoint-not-running"}"#.into(),
                    stderr: String::new(),
                },
            )
            .unwrap();

        assert_eq!(
            result,
            PowerPointCommandResult {
                command: PowerPointCommand::Next,
                outcome: PowerPointCommandOutcome::PowerPointNotRunning,
            }
        );
    }

    #[test]
    fn maps_slideshow_not_active_outcome() {
        let result = PowerPointAdapter::new()
            .decode_helper_output(
                PowerPointCommand::Previous,
                PowerPointHelperOutput {
                    exit_code: Some(0),
                    stdout: r#"{"status":"slideshow-not-active"}"#.into(),
                    stderr: String::new(),
                },
            )
            .unwrap();

        assert_eq!(
            result,
            PowerPointCommandResult {
                command: PowerPointCommand::Previous,
                outcome: PowerPointCommandOutcome::SlideshowNotActive,
            }
        );
    }

    #[test]
    fn maps_success_outcome() {
        let result = PowerPointAdapter::new()
            .decode_helper_output(
                PowerPointCommand::Next,
                PowerPointHelperOutput {
                    exit_code: Some(0),
                    stdout: r#"{"status":"ok"}"#.into(),
                    stderr: String::new(),
                },
            )
            .unwrap();

        assert_eq!(
            result,
            PowerPointCommandResult {
                command: PowerPointCommand::Next,
                outcome: PowerPointCommandOutcome::Success,
            }
        );
    }
}
