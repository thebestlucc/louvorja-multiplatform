use crate::error::AppError;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::sync::mpsc;
use std::sync::OnceLock;

/// Channel sender for the persistent Enigo worker thread.
/// Initialized once on first `send_keystroke` call.
/// When the app shuts down, this static is dropped, the sender closes,
/// and the worker thread's `recv()` returns `Err` → thread exits cleanly.
static ENIGO_TX: OnceLock<mpsc::Sender<Key>> = OnceLock::new();

fn get_enigo_sender() -> &'static mpsc::Sender<Key> {
    ENIGO_TX.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<Key>();
        std::thread::Builder::new()
            .name("enigo-worker".into())
            .spawn(move || {
                let Ok(mut enigo) = Enigo::new(&Settings::default()) else {
                    eprintln!("[slide-passer] Failed to initialize Enigo");
                    return;
                };
                while let Ok(key) = rx.recv() {
                    let _ = enigo.key(key, Direction::Click);
                }
                // Channel closed → app is shutting down → thread exits
            })
            .expect("Failed to spawn enigo worker thread");
        tx
    })
}

fn parse_key(key: &str) -> Result<Key, AppError> {
    match key {
        "PageDown" => Ok(Key::PageDown),
        "PageUp" => Ok(Key::PageUp),
        "F5" => Ok(Key::F5),
        "Escape" | "Esc" => Ok(Key::Escape),
        "Return" | "Enter" => Ok(Key::Return),
        "Tab" => Ok(Key::Tab),
        " " | "Space" => Ok(Key::Space),
        "ArrowRight" | "Right" => Ok(Key::RightArrow),
        "ArrowLeft" | "Left" => Ok(Key::LeftArrow),
        "ArrowUp" | "Up" => Ok(Key::UpArrow),
        "ArrowDown" | "Down" => Ok(Key::DownArrow),
        s if s.len() == 1 => Ok(Key::Unicode(s.chars().next().unwrap())),
        _ => Err(AppError::Internal(format!("Unsupported key: {key}"))),
    }
}

/// Send a keystroke to the currently focused application.
/// Used by external mode to forward clicker presses to PowerPoint/Keynote/etc.
#[tauri::command]
#[specta::specta]
pub fn send_keystroke(key: String) -> Result<(), AppError> {
    let enigo_key = parse_key(&key)?;
    let tx = get_enigo_sender();
    tx.send(enigo_key)
        .map_err(|_| AppError::Internal("Enigo worker thread has stopped".into()))?;
    Ok(())
}

/// Check if the app has macOS Accessibility permission (needed for keystroke simulation).
/// Returns true on non-macOS platforms.
#[tauri::command]
#[specta::specta]
pub fn check_accessibility_permission() -> Result<bool, AppError> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("osascript")
            .args(["-e", "tell application \"System Events\" to get name of first process"])
            .output();

        match output {
            Ok(o) => Ok(o.status.success()),
            Err(_) => Ok(false),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}
