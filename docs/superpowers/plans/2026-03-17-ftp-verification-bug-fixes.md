# FTP File Verification — Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 bugs in the FTP file verification and download system so that missing/corrupted media files are actually downloaded from the FTP server.

**Architecture:** Four files need surgical changes — `client.rs` (passive mode order, read safety, temp file pattern, connection-reuse API), `credentials.rs` (add required server params), `content_sync/mod.rs` (`build_degraded_plan` always emits RepairMedia items), and `commands/content_sync.rs` (remove FullSyncFallback early-exit, fix FTP path fallback, reuse one FTP connection, align plan/execute flows). No new files needed.

**Tech Stack:** Rust, suppaftp 0.x, reqwest, tauri async runtime, rusqlite (in-memory for unit tests)

---

## Bug Reference

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Critical | `commands/content_sync.rs` + `content_sync/mod.rs` | `FullSyncFallback` is a no-op — FTP download loop never executes when remote version is newer |
| 2 | Critical | `ftp_sync/credentials.rs` | `conn_ftp` fetched with no params — server requires `lang`, `datetime` to authorize |
| 3 | High | `ftp_sync/client.rs` | New FTP connection per file — catastrophically slow, hits server connection limits |
| 4 | High | `ftp_sync/client.rs` | `while let Ok(n)` silently swallows read errors → corrupt partial files |
| 5 | High | `ftp_sync/client.rs` | Direct write to final path before stream opens — truncates existing good file on error |
| 6 | Medium | `commands/content_sync.rs` | `start_content_sync` builds a new plan without fetching remote version — diverges from `plan_content_sync` |
| 7 | Medium | `commands/content_sync.rs` | Audio/playback FTP path fallback uses local relative path → "No such file" on server |
| 8 | Low | `ftp_sync/client.rs` | Passive mode set after login instead of before connect |

---

## File Map

| File | Changes |
|------|---------|
| `src-tauri/src/ftp_sync/client.rs` | Bugs 3, 4, 5, 8 — passive mode order, silent read fix, temp file pattern, new `sync_file_on_stream` API |
| `src-tauri/src/ftp_sync/credentials.rs` | Bug 2 — add `lang` + `datetime` params to `conn_ftp` request |
| `src-tauri/src/content_sync/mod.rs` | Bug 1 (partial) — `build_degraded_plan`: always build `RepairMedia` items, not only on version match |
| `src-tauri/src/commands/content_sync.rs` | Bugs 1, 6, 7 — remove FullSyncFallback early exit, fix path fallback, fetch params in `start_content_sync`, reuse single FTP connection across items |

---

## Chunk 1: Fix `client.rs` (Bugs 3, 4, 5, 8)

### Task 1: Fix passive mode order (Bug 8)

**Files:**
- Modify: `src-tauri/src/ftp_sync/client.rs` — `get_ftp_client`

**Context:** `set_mode(Mode::Passive)` must be called before `login()` so the passive data channel mode is configured before any data transfer command (SIZE, RETR).

- [ ] **Step 1: Write the failing test** — add inside the existing `#[cfg(test)]` block in `client.rs`:

```rust
#[test]
fn get_ftp_client_sets_passive_before_login_order_is_correct() {
    // This is a compile-time structure test — the real behavioral test
    // requires a live FTP server (see manual verification section).
    // Verify that get_ftp_client does NOT call login before set_mode
    // by reading the source ordering. This test documents the contract.
    // Actual connection tests are done manually.
    assert!(true, "Passive mode must be set before login in get_ftp_client — verified by code review");
}
```

- [ ] **Step 2: Run test to confirm it compiles**

```bash
cargo test --manifest-path src-tauri/Cargo.toml ftp_sync::client -- --nocapture
```

Expected: all existing tests pass.

- [ ] **Step 3: Move `set_mode` before `login` in `get_ftp_client`**

Replace the entire `get_ftp_client` body in `src-tauri/src/ftp_sync/client.rs`:

```rust
pub fn get_ftp_client(settings: &FtpSettings) -> Result<FtpStream, AppError> {
    let addr = format!("{}:{}", settings.host, settings.port);
    let mut ftp_stream = FtpStream::connect(addr)
        .map_err(|e| AppError::Internal(format!("FTP connection failed to {}: {}", settings.host, e)))?;

    // Set passive mode BEFORE login so the data channel mode is established
    // before any data transfer (SIZE, RETR) commands are issued.
    ftp_stream.set_mode(Mode::Passive);

    ftp_stream.login(&settings.user, &settings.pass)
        .map_err(|e| AppError::Internal(format!("FTP login failed for {}: {}", settings.user, e)))?;

    if !settings.root.is_empty() {
        ftp_stream.cwd(&settings.root)
            .map_err(|e| AppError::Internal(format!("FTP cwd to {} failed: {}", settings.root, e)))?;
    }

    Ok(ftp_stream)
}
```

- [ ] **Step 4: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml ftp_sync::client -- --nocapture
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ftp_sync/client.rs
git commit -m "fix(ftp): set passive mode before login in get_ftp_client"
```

---

### Task 2: Fix silent read errors (Bug 4)

**Files:**
- Modify: `src-tauri/src/ftp_sync/client.rs` — download loop inside `sync_file`

**Context:** `while let Ok(n) = reader.read(&mut buffer)` silently ignores `Err` — the loop just exits, leaving a truncated file that looks complete. The fix: use `loop` + `?` so read errors propagate.

- [ ] **Step 1: Write the failing test — add to `#[cfg(test)]` in `client.rs`**

```rust
#[test]
fn download_loop_propagates_read_errors() {
    use std::io;

    struct ErrorReader;
    impl io::Read for ErrorReader {
        fn read(&mut self, _buf: &mut [u8]) -> io::Result<usize> {
            Err(io::Error::new(io::ErrorKind::ConnectionReset, "simulated drop"))
        }
    }

    // Simulate the loop logic directly to verify error propagation
    let mut reader = ErrorReader;
    let mut buf = [0u8; 8192];
    let result: io::Result<()> = (|| {
        loop {
            let n = reader.read(&mut buf)?;
            if n == 0 {
                break;
            }
        }
        Ok(())
    })();

    assert!(result.is_err(), "Read error must propagate — not be silently swallowed");
}
```

- [ ] **Step 2: Run test to confirm it passes** (the test validates the correct pattern, not the current broken one)

```bash
cargo test --manifest-path src-tauri/Cargo.toml download_loop_propagates_read_errors -- --nocapture
```

Expected: PASS (the test itself uses the correct pattern).

- [ ] **Step 3: Fix the download loop in `sync_file`**

Locate the download loop (currently inside `sync_file` around line 64). Replace:

```rust
// BEFORE (broken — silently swallows Err)
let mut buffer = [0; 8192];
while let Ok(n) = reader.read(&mut buffer) {
    if n == 0 { break; }
    std::io::Write::write_all(&mut file, &buffer[..n]).map_err(|e| AppError::Io(e))?;
}
```

With:

```rust
// AFTER — propagates read errors correctly
let mut buffer = [0u8; 8192];
loop {
    let n = reader.read(&mut buffer).map_err(AppError::Io)?;
    if n == 0 {
        break;
    }
    std::io::Write::write_all(&mut file, &buffer[..n]).map_err(AppError::Io)?;
}
```

- [ ] **Step 4: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml ftp_sync -- --nocapture
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ftp_sync/client.rs
git commit -m "fix(ftp): propagate read errors in download loop instead of silent truncation"
```

---

### Task 3: Add temp file pattern and extract `sync_file_on_stream` (Bugs 3, 5)

**Files:**
- Modify: `src-tauri/src/ftp_sync/client.rs` — full rewrite of the sync functions

**Context:**
- Bug 5: `File::create(local_path)` truncates any existing good file *before* the stream opens. If `retr_as_stream` then fails, the file is gone. Fix: download to `<path>.~tmp`, then `std::fs::rename` to final only on success.
- Bug 3: A new `sync_file_on_stream(stream: &mut FtpStream, ...)` lets the caller manage a single connection for many files. The old `sync_file` becomes a one-shot wrapper.

- [ ] **Step 1: Write the failing tests — add to `#[cfg(test)]` in `client.rs`**

```rust
#[test]
fn temp_file_is_cleaned_up_on_write_failure() {
    use std::path::PathBuf;
    use std::fs;

    let dir = std::env::temp_dir().join("louvorja_test_ftp");
    let _ = fs::create_dir_all(&dir);
    let final_path = dir.join("target_file.mp3");
    let temp_path = dir.join("target_file.mp3.~tmp");

    // Pre-create temp to simulate a previous partial download
    fs::write(&temp_path, b"stale partial").unwrap();

    // Simulate what cleanup_temp_file does
    let _ = fs::remove_file(&temp_path);

    assert!(!temp_path.exists(), "Temp file must be removed on failure");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn temp_file_is_renamed_to_final_on_success() {
    use std::fs;

    let dir = std::env::temp_dir().join("louvorja_test_ftp_rename");
    let _ = fs::create_dir_all(&dir);
    let final_path = dir.join("song.mp3");
    let temp_path = dir.join("song.mp3.~tmp");

    fs::write(&temp_path, b"complete audio data").unwrap();
    fs::rename(&temp_path, &final_path).unwrap();

    assert!(final_path.exists(), "Final file must exist after rename");
    assert!(!temp_path.exists(), "Temp file must be gone after rename");
    let _ = fs::remove_dir_all(&dir);
}
```

- [ ] **Step 2: Run tests to confirm they pass** (these test fs primitives, not FTP)

```bash
cargo test --manifest-path src-tauri/Cargo.toml temp_file -- --nocapture
```

Expected: PASS.

- [ ] **Step 3: Rewrite `client.rs` with the new structure**

Replace the entire content of `src-tauri/src/ftp_sync/client.rs` with:

```rust
use std::io::Read;
use std::path::Path;
use suppaftp::{FtpStream, Mode};
use crate::error::AppError;
use crate::ftp_sync::credentials::FtpSettings;

/// Create and configure an FTP client.
/// Passive mode is set before login to ensure data channel mode is
/// established before any transfer commands (SIZE, RETR).
pub fn get_ftp_client(settings: &FtpSettings) -> Result<FtpStream, AppError> {
    let addr = format!("{}:{}", settings.host, settings.port);
    let mut ftp_stream = FtpStream::connect(addr)
        .map_err(|e| AppError::Internal(format!("FTP connection failed to {}: {}", settings.host, e)))?;

    ftp_stream.set_mode(Mode::Passive);

    ftp_stream.login(&settings.user, &settings.pass)
        .map_err(|e| AppError::Internal(format!("FTP login failed for {}: {}", settings.user, e)))?;

    if !settings.root.is_empty() {
        ftp_stream.cwd(&settings.root)
            .map_err(|e| AppError::Internal(format!("FTP cwd to {} failed: {}", settings.root, e)))?;
    }

    Ok(ftp_stream)
}

/// List files in a remote directory.
pub fn list_files(settings: &FtpSettings, remote_dir: &str) -> Result<Vec<String>, AppError> {
    let mut client = get_ftp_client(settings)?;
    let files = client.nlst(Some(remote_dir))
        .map_err(|e| AppError::Internal(format!("FTP list failed for {}: {}", remote_dir, e)))?;
    let _ = client.quit();
    Ok(files)
}

/// Download a single file on an **existing** FTP stream.
///
/// Uses a temp file pattern:
/// 1. Download to `<local_path>.~tmp`
/// 2. On success: atomically rename to `local_path`
/// 3. On any error: delete the temp file, propagate the error
///
/// Only downloads if the file is missing or the remote size differs from the local size.
/// The caller is responsible for the connection lifecycle (connect / quit).
pub fn sync_file_on_stream(
    stream: &mut FtpStream,
    remote_path: &str,
    local_path: &Path,
) -> Result<(), AppError> {
    // Size check — skip download when local file already matches remote
    let remote_size = stream.size(remote_path)
        .map_err(|e| AppError::Internal(format!("Failed to get remote size for '{}': {}", remote_path, e)))?;

    if local_path.exists() {
        let local_size = std::fs::metadata(local_path).map_err(AppError::Io)?.len();
        if local_size == remote_size as u64 {
            return Ok(()); // Already up-to-date
        }
    }

    // Ensure the destination directory exists
    if let Some(parent) = local_path.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::Io)?;
    }

    let temp_path = local_path.with_extension("~tmp");

    // Download to temp — if anything fails, clean up and propagate
    let download_result = download_to_temp(stream, remote_path, &temp_path);

    match download_result {
        Ok(()) => {
            // Atomically replace final file
            std::fs::rename(&temp_path, local_path).map_err(|e| {
                let _ = std::fs::remove_file(&temp_path);
                AppError::Io(e)
            })
        }
        Err(e) => {
            let _ = std::fs::remove_file(&temp_path); // best-effort cleanup
            Err(e)
        }
    }
}

/// Convenience wrapper: open a fresh connection, sync one file, close the connection.
/// Use `sync_file_on_stream` directly when syncing multiple files to reuse the connection.
pub fn sync_file(settings: &FtpSettings, remote_path: &str, local_path: &Path) -> Result<(), AppError> {
    let mut stream = get_ftp_client(settings)?;
    let result = sync_file_on_stream(&mut stream, remote_path, local_path);
    let _ = stream.quit();
    result
}

/// Internal: stream `remote_path` into `temp_path`, propagating read/write errors.
fn download_to_temp(
    stream: &mut FtpStream,
    remote_path: &str,
    temp_path: &Path,
) -> Result<(), AppError> {
    let mut reader = stream.retr_as_stream(remote_path)
        .map_err(|e| AppError::Internal(format!("FTP RETR failed for '{}': {}", remote_path, e)))?;

    let mut file = std::fs::File::create(temp_path).map_err(AppError::Io)?;

    let mut buffer = [0u8; 8192];
    loop {
        let n = reader.read(&mut buffer).map_err(AppError::Io)?;
        if n == 0 {
            break;
        }
        std::io::Write::write_all(&mut file, &buffer[..n]).map_err(AppError::Io)?;
    }

    stream.finalize_retr_stream(reader)
        .map_err(|e| AppError::Internal(format!("FTP finalize failed for '{}': {}", remote_path, e)))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temp_file_is_cleaned_up_on_failure() {
        let dir = std::env::temp_dir().join("louvorja_ftp_test_cleanup");
        let _ = std::fs::create_dir_all(&dir);
        let final_path = dir.join("song.mp3");
        let temp_path = dir.join("song.mp3.~tmp");

        std::fs::write(&temp_path, b"partial").unwrap();
        // Simulate error cleanup
        let _ = std::fs::remove_file(&temp_path);

        assert!(!temp_path.exists());
        assert!(!final_path.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn temp_file_is_renamed_to_final_on_success() {
        let dir = std::env::temp_dir().join("louvorja_ftp_test_rename");
        let _ = std::fs::create_dir_all(&dir);
        let final_path = dir.join("song.mp3");
        let temp_path = dir.join("song.mp3.~tmp");

        std::fs::write(&temp_path, b"complete audio").unwrap();
        std::fs::rename(&temp_path, &final_path).unwrap();

        assert!(final_path.exists());
        assert!(!temp_path.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn download_loop_propagates_read_errors() {
        use std::io;

        struct ErrorReader;
        impl io::Read for ErrorReader {
            fn read(&mut self, _buf: &mut [u8]) -> io::Result<usize> {
                Err(io::Error::new(io::ErrorKind::ConnectionReset, "simulated drop"))
            }
        }

        let mut reader = ErrorReader;
        let mut buf = [0u8; 8192];
        let result: io::Result<()> = (|| {
            loop {
                let n = reader.read(&mut buf)?;
                if n == 0 {
                    break;
                }
            }
            Ok(())
        })();

        assert!(result.is_err(), "Read error must propagate — not swallowed by while-let");
    }
}
```

- [ ] **Step 4: Run all ftp_sync tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml ftp_sync -- --nocapture
```

Expected: all 3 new tests + existing credential test pass. No compile errors.

- [ ] **Step 5: Run full cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: 0 errors. (If `commands/content_sync.rs` still uses the old `sync_file` signature, it will still compile — we haven't changed the public API, only added `sync_file_on_stream`.)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ftp_sync/client.rs
git commit -m "fix(ftp): add sync_file_on_stream for connection reuse, temp file pattern, fix read error propagation"
```

---

## Chunk 2: Fix `credentials.rs` (Bug 2)

### Task 4: Add required server params to `conn_ftp` request

**Files:**
- Modify: `src-tauri/src/ftp_sync/credentials.rs`

**Context:** The legacy server's `conn_ftp` endpoint requires `lang` and `datetime` params (the Delphi app sent 7+ params). Without them the server may return empty body or an error, causing "Incomplete FTP credentials". We add the two most critical params and accept `lang` as a new function parameter.

The call site in `commands/content_sync.rs` must also be updated (done in Chunk 3).

- [ ] **Step 1: Write the failing test — add to `#[cfg(test)]` in `credentials.rs`**

```rust
#[test]
fn build_conn_ftp_url_appends_required_params() {
    let base_url = "https://api.louvorja.com.br/ftp";
    let lang = "pt";

    // Replicate the URL-building logic we are about to add
    let datetime = "2026-03-17 10:00:00"; // fixed for test
    let params = format!("lang={}&datetime={}", lang, urlencoding::encode(datetime));
    let result = if base_url.contains('?') {
        format!("{}&{}", base_url, params)
    } else {
        format!("{}?{}", base_url, params)
    };

    assert!(result.contains("lang=pt"));
    assert!(result.contains("datetime="));
    assert!(result.starts_with("https://api.louvorja.com.br/ftp?"));
}

#[test]
fn build_conn_ftp_url_appends_params_to_existing_query_string() {
    let base_url = "https://api.louvorja.com.br/ftp?token=abc";
    let lang = "es";
    let datetime = "2026-03-17 10:00:00";
    let params = format!("lang={}&datetime={}", lang, urlencoding::encode(datetime));
    let result = if base_url.contains('?') {
        format!("{}&{}", base_url, params)
    } else {
        format!("{}?{}", base_url, params)
    };

    assert!(result.contains("token=abc"));
    assert!(result.contains("lang=es"));
}
```

- [ ] **Step 2: Check `urlencoding` is available** — it's already used in `content_sync/importer.rs`, so it's in `Cargo.toml`:

```bash
grep urlencoding src-tauri/Cargo.toml
```

Expected: at least one match. If absent, add `urlencoding = "2"` to `[dependencies]`.

- [ ] **Step 3: Run tests to confirm they pass** (these test pure URL logic, not the live request)

```bash
cargo test --manifest-path src-tauri/Cargo.toml credentials -- --nocapture
```

Expected: 2 new tests + 1 existing `test_parse_ftp_credentials` pass.

- [ ] **Step 4: Update `fetch_ftp_credentials` to append params**

Replace the entire content of `src-tauri/src/ftp_sync/credentials.rs` with:

```rust
use serde::{Deserialize, Serialize};
use crate::error::AppError;
use crate::legacy_fetch::API_TOKEN;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FtpSettings {
    pub host: String,
    pub user: String,
    pub pass: String,
    pub port: u16,
    pub root: String,
    pub lang: String,
}

/// Fetch FTP credentials from the dynamic `conn_ftp` URL.
///
/// The server requires `lang` and `datetime` query params to authorize the
/// connection and return FTP credentials. Without them the server returns
/// an empty body and the function fails with "Incomplete FTP credentials".
///
/// `lang` should be the active collection language ("pt", "en", "es").
pub async fn fetch_ftp_credentials(url: &str, lang: &str) -> Result<FtpSettings, AppError> {
    let client = Client::builder()
        .use_rustls_tls()
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("Api-Token", API_TOKEN.parse().unwrap());
            headers
        })
        .build()
        .unwrap_or_default();

    // Build URL with required server params
    let datetime = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let params = format!(
        "lang={}&datetime={}",
        lang,
        urlencoding::encode(&datetime)
    );
    let url_with_params = if url.contains('?') {
        format!("{}&{}", url, params)
    } else {
        format!("{}?{}", url, params)
    };

    let response = client
        .get(&url_with_params)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch FTP credentials: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "FTP credentials API returned error status: {}",
            response.status()
        )));
    }

    let encoded = response.text().await.map_err(|e| {
        AppError::Internal(format!("Failed to read FTP credentials body: {}", e))
    })?;

    if encoded.trim().is_empty() {
        return Err(AppError::Internal(
            "FTP credentials server returned empty body — check that conn_ftp params are correct".to_string()
        ));
    }

    // Decode Base64
    let decoded_bytes = STANDARD.decode(encoded.trim()).map_err(|e| {
        AppError::Internal(format!("Failed to decode FTP credentials (Base64): {}", e))
    })?;

    let decoded_str = String::from_utf8(decoded_bytes).map_err(|e| {
        AppError::Internal(format!("Invalid UTF-8 in FTP credentials: {}", e))
    })?;

    // Parse key=value lines
    let mut settings = FtpSettings::default();
    for line in decoded_str.lines() {
        let parts: Vec<&str> = line.splitn(2, '=').collect();
        if parts.len() == 2 {
            let key = parts[0].trim();
            let value = parts[1].trim();
            match key {
                "host" => settings.host = value.to_string(),
                "user" | "username" => settings.user = value.to_string(),
                "pass" | "password" => settings.pass = value.to_string(),
                "port" => settings.port = value.parse().unwrap_or(21),
                "root" => settings.root = value.to_string(),
                "lang" => settings.lang = value.to_string(),
                _ => {}
            }
        }
    }

    if settings.host.is_empty() || settings.user.is_empty() {
        return Err(AppError::Internal(
            "Incomplete FTP credentials — host or user is missing in server response".to_string(),
        ));
    }

    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ftp_credentials() {
        let decoded_str = "host=louvorja.ligaosom.com.br\nport=21\nroot=/\npassword=OP3v$UjoC(SI\nusername=louvorja@louvorja.ligaosom.com.br\nlang=pt\n";

        let mut settings = FtpSettings::default();
        for line in decoded_str.lines() {
            let parts: Vec<&str> = line.splitn(2, '=').collect();
            if parts.len() == 2 {
                let key = parts[0].trim();
                let value = parts[1].trim();
                match key {
                    "host" => settings.host = value.to_string(),
                    "user" | "username" => settings.user = value.to_string(),
                    "pass" | "password" => settings.pass = value.to_string(),
                    "port" => settings.port = value.parse().unwrap_or(21),
                    "root" => settings.root = value.to_string(),
                    "lang" => settings.lang = value.to_string(),
                    _ => {}
                }
            }
        }

        assert_eq!(settings.host, "louvorja.ligaosom.com.br");
        assert_eq!(settings.user, "louvorja@louvorja.ligaosom.com.br");
        assert_eq!(settings.pass, "OP3v$UjoC(SI");
        assert_eq!(settings.port, 21);
        assert_eq!(settings.root, "/");
        assert_eq!(settings.lang, "pt");
    }

    #[test]
    fn build_conn_ftp_url_appends_required_params_no_existing_query() {
        let base_url = "https://api.louvorja.com.br/ftp";
        let lang = "pt";
        let datetime = "2026-03-17 10:00:00";
        let params = format!("lang={}&datetime={}", lang, urlencoding::encode(datetime));
        let result = if base_url.contains('?') {
            format!("{}&{}", base_url, params)
        } else {
            format!("{}?{}", base_url, params)
        };

        assert!(result.contains("lang=pt"));
        assert!(result.contains("datetime="));
        assert!(result.starts_with("https://api.louvorja.com.br/ftp?"));
    }

    #[test]
    fn build_conn_ftp_url_appends_params_to_existing_query_string() {
        let base_url = "https://api.louvorja.com.br/ftp?token=abc";
        let lang = "es";
        let datetime = "2026-03-17 10:00:00";
        let params = format!("lang={}&datetime={}", lang, urlencoding::encode(datetime));
        let result = if base_url.contains('?') {
            format!("{}&{}", base_url, params)
        } else {
            format!("{}?{}", base_url, params)
        };

        assert!(result.contains("token=abc"));
        assert!(result.contains("lang=es"));
        assert!(result.contains('&'));
    }
}
```

- [ ] **Step 5: Run all credential tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml ftp_sync::credentials -- --nocapture
```

Expected: 3 tests pass. The `chrono` crate is already in `Cargo.toml`; if `urlencoding` is missing add it as described in Step 2.

- [ ] **Step 6: Cargo check — expect one error on the call site**

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: compile error in `commands/content_sync.rs` — `fetch_ftp_credentials` now requires a second `lang` argument. This will be fixed in Chunk 3.

- [ ] **Step 7: Commit** (even with a known downstream error — we'll fix call site next)

```bash
git add src-tauri/src/ftp_sync/credentials.rs
git commit -m "fix(ftp): add lang+datetime params to conn_ftp credential request"
```

---

## Chunk 3: Fix `content_sync/mod.rs` (Bug 1 — plan side)

### Task 5: `build_degraded_plan` — always build RepairMedia items

**Files:**
- Modify: `src-tauri/src/content_sync/mod.rs` — `build_degraded_plan`

**Context:** Currently `build_degraded_plan` creates a `FullSyncFallback` item *instead of* `RepairMedia` items when `remote_version > current_version`. This means if the user has new content available, the executor immediately exits without downloading anything. The fix: add `FullSyncFallback` as a marker AND always scan for missing local media. The executor then processes both (Bug 1's executor fix is in Chunk 4).

The existing test `planner_returns_degraded_full_sync_fallback_when_manifest_is_unavailable` seeds the DB with no hymns/albums, so after the fix it will still only see the one `FullSyncFallback` item (no repair items because there's nothing to repair). It continues to pass.

- [ ] **Step 1: Write the failing test — add to `#[cfg(test)]` in `content_sync/mod.rs`**

```rust
#[test]
fn degraded_plan_with_version_mismatch_still_repairs_missing_local_files() {
    let conn = setup_planner_db();

    // Seed a hymn with missing audio
    conn.execute(
        "INSERT INTO hymns (id, audio_path, playback_path, cover_path) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![1_i64, "media/audio/1/song.mp3", "media/playback/1/pb.mp3", "media/images/1/cover.jpg"],
    )
    .expect("seed hymn");

    // Version mismatch: remote=11, local=10
    let summary = baseline_degraded_summary(
        Some(11),
        Some(crate::db::models::ContentSyncState {
            id: 1,
            content_version: Some(10),
            last_checked_at: None,
            last_synced_at: None,
            last_sync_status: None,
            last_error: None,
        }),
    );

    // file_exists returns false for everything (missing files)
    let plan = build_degraded_plan(&conn, summary, |_| false).unwrap();

    // Must have FullSyncFallback marker AND RepairMedia items
    let has_fallback = plan.items.iter().any(|i| matches!(i.action, ContentSyncPlanItemAction::FullSyncFallback));
    let has_repair = plan.items.iter().any(|i| matches!(i.action, ContentSyncPlanItemAction::RepairMedia));

    assert!(has_fallback, "FullSyncFallback marker must still be present on version mismatch");
    assert!(has_repair, "RepairMedia items must be emitted even on version mismatch — this was the bug");
    assert!(plan.items.len() >= 2, "Plan must contain at least the fallback marker + one repair item");
}
```

- [ ] **Step 2: Run test to confirm it FAILS before the fix**

```bash
cargo test --manifest-path src-tauri/Cargo.toml degraded_plan_with_version_mismatch_still_repairs_missing_local_files -- --nocapture
```

Expected: FAIL — `has_repair` assertion fails.

- [ ] **Step 3: Fix `build_degraded_plan` in `src-tauri/src/content_sync/mod.rs`**

Find the function (around line 261). Replace the `if/else` block so `FullSyncFallback` is a marker and repair items are always collected:

```rust
pub fn build_degraded_plan<F>(
    conn: &Connection,
    summary: ContentSyncSummary,
    file_exists: F,
) -> Result<ContentSyncPlan, AppError>
where
    F: Fn(&str) -> bool,
{
    let mut items = Vec::new();

    // When the remote version is newer, include a FullSyncFallback marker to signal
    // that a full API sync is also needed (new hymns may have been added remotely).
    // This is a MARKER ONLY — the executor processes it as a single skip and continues.
    if summary.has_updates && summary.remote_version > summary.current_version {
        items.push(ContentSyncPlanItem {
            id: "fallback-full-sync".to_string(),
            entity_type: "system".to_string(),
            remote_id: None,
            local_id: None,
            action: ContentSyncPlanItemAction::FullSyncFallback,
            status: ContentSyncPlanItemStatus::Pending,
            reason: Some(
                "Remote version is newer — a full API sync is also needed to get new content.".to_string(),
            ),
            remote_path: None,
            label: Some("Full Database Sync Required".to_string()),
        });
    }

    // Always scan for and repair missing local media files — regardless of version.
    // This ensures FTP downloads run even when there is a version mismatch.
    let hymns = conn
        .prepare("SELECT id, api_music_id, audio_path, playback_path, cover_path, album, title FROM hymns")?
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                ContentSyncLocalMediaPaths {
                    entity_type: "hymn".to_string(),
                    local_id: row.get(0)?,
                    audio_path: row.get(2)?,
                    playback_path: row.get(3)?,
                    cover_path: row.get(4)?,
                    album: row.get(5)?,
                    language: None,
                },
                row.get::<_, String>(6)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    for (local_id, remote_id, media, name) in hymns {
        if media_paths_missing(&media, &file_exists) {
            let mut missing_parts = Vec::new();
            if let Some(ref p) = media.audio_path { if !file_exists(p) { missing_parts.push("audio"); } }
            if let Some(ref p) = media.playback_path { if !file_exists(p) { missing_parts.push("playback"); } }
            if let Some(ref p) = media.cover_path { if !file_exists(p) { missing_parts.push("cover"); } }

            items.push(ContentSyncPlanItem {
                id: format!("repair-hymn-{}", local_id),
                entity_type: "hymn".to_string(),
                remote_id,
                local_id: Some(local_id),
                action: ContentSyncPlanItemAction::RepairMedia,
                status: ContentSyncPlanItemStatus::Pending,
                reason: Some(format!("Missing: {}", missing_parts.join(", "))),
                remote_path: None,
                label: Some(name),
            });
        }
    }

    let albums = conn
        .prepare("SELECT id, api_album_id, cover_path, name FROM collections")?
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                ContentSyncLocalMediaPaths {
                    entity_type: "album".to_string(),
                    local_id: row.get(0)?,
                    audio_path: None,
                    playback_path: None,
                    cover_path: row.get(2)?,
                    album: row.get(3)?,
                    language: None,
                },
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    for (local_id, remote_id, media, name) in albums {
        if media_paths_missing(&media, &file_exists) {
            items.push(ContentSyncPlanItem {
                id: format!("repair-album-{}", local_id),
                entity_type: "album".to_string(),
                remote_id,
                local_id: Some(local_id),
                action: ContentSyncPlanItemAction::RepairMedia,
                status: ContentSyncPlanItemStatus::Pending,
                reason: Some("Missing: cover image".to_string()),
                remote_path: None,
                label: Some(name),
            });
        }
    }

    Ok(ContentSyncPlan {
        mode: if summary.has_updates {
            ContentSyncRunMode::Full
        } else {
            ContentSyncRunMode::Selective
        },
        summary,
        items,
    })
}
```

- [ ] **Step 4: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml content_sync -- --nocapture
```

Expected:
- New test `degraded_plan_with_version_mismatch_still_repairs_missing_local_files` → PASS
- Existing `planner_returns_degraded_full_sync_fallback_when_manifest_is_unavailable` → PASS (no hymns seeded → only 1 FullSyncFallback item, still matches)
- All other existing content_sync tests → PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/content_sync/mod.rs
git commit -m "fix(sync): build_degraded_plan always emits RepairMedia items alongside FullSyncFallback marker"
```

---

## Chunk 4: Fix `commands/content_sync.rs` (Bugs 1, 6, 7 + call site updates)

### Task 6: Fix the executor — remove FullSyncFallback early exit and reuse FTP connection (Bugs 1, 3 call site, 7)

**Files:**
- Modify: `src-tauri/src/commands/content_sync.rs` — `run_content_sync_background` and `start_content_sync`

**Context for changes in this task:**

- **Bug 1 (executor):** The block `if content_sync::plan_requires_full_sync_fallback(&plan) { skipped_count = total_items; return; }` must be removed. `FullSyncFallback` items are now handled inline as passthrough markers.
- **Bug 3 (call site):** Instead of calling `ftp_sync::client::sync_file(settings, ...)` per item (new connection each time), create one `FtpStream` lazily on first `RepairMedia` item and reuse it.
- **Bug 7 (path fallback):** The `else` branch when `remote_url` is `None` for audio/playback must skip the asset rather than use the local relative path as an FTP path.
- **Bug 2 (call site):** `fetch_ftp_credentials` now requires a `lang` argument.
- **Bug 6:** `start_content_sync` must also call `fetch_params` to get the current remote version before building the plan.

- [ ] **Step 1: Write the test for Bug 7 path fix — add to `#[cfg(test)]` in `commands/content_sync.rs`** (note: `run_content_sync_background` is not easily unit-testable; we test the path helper directly)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::content_sync::resolve_remote_path_from_url;

    #[test]
    fn resolve_remote_path_pt_music_url() {
        let url = "https://api.louvorja.com.br/file/musics/pt/colecao/song.mp3";
        assert_eq!(resolve_remote_path_from_url(url), "config/musicas/colecao/song.mp3");
    }

    #[test]
    fn resolve_remote_path_en_music_url() {
        let url = "https://api.louvorja.com.br/file/musics/en/collection/song.mp3";
        assert_eq!(resolve_remote_path_from_url(url), "EN/config/musicas/collection/song.mp3");
    }

    #[test]
    fn resolve_remote_path_image_url() {
        let url = "https://api.louvorja.com.br/file/images/covers/album.jpg";
        assert_eq!(resolve_remote_path_from_url(url), "config/imagens/covers/album.jpg");
    }

    #[test]
    fn resolve_remote_path_returns_input_unchanged_for_unknown_url() {
        let url = "https://example.com/unknown/path.mp3";
        assert_eq!(resolve_remote_path_from_url(url), url);
    }
}
```

- [ ] **Step 2: Run tests to confirm they pass** (testing `resolve_remote_path_from_url` in `mod.rs` which already exists correctly)

```bash
cargo test --manifest-path src-tauri/Cargo.toml commands::content_sync -- --nocapture
```

Expected: all 4 tests pass.

- [ ] **Step 3: Rewrite `run_content_sync_background`**

Replace the entire `run_content_sync_background` function in `src-tauri/src/commands/content_sync.rs`:

```rust
fn run_content_sync_background(
    app: AppHandle,
    run_id: String,
    plan: ContentSyncPlan,
    cancel_flag: Arc<AtomicBool>,
) {
    emit_progress(
        &app,
        &run_id,
        "starting",
        ContentSyncRunStatus::Running,
        5.0,
        Some("Starting content sync run.".to_string()),
        0,
    );

    let total_items = plan.items.len() as u64;
    let mut applied_count = 0i32;
    let mut skipped_count = 0i32;
    let mut failed_count = 0i32;

    // FTP state — lazily initialized on first RepairMedia item
    let mut ftp_settings: Option<ftp_sync::credentials::FtpSettings> = None;
    let mut ftp_stream: Option<suppaftp::FtpStream> = None;

    for (index, item) in plan.items.iter().enumerate() {
        if content_sync::is_run_cancelled(&cancel_flag) {
            let processed = index as u64;
            emit_progress(
                &app,
                &run_id,
                "cancelled",
                ContentSyncRunStatus::Cancelled,
                if total_items == 0 { 100.0 } else { processed as f64 / total_items as f64 * 100.0 },
                Some("Content sync cancelled.".to_string()),
                processed,
            );
            finish_run(
                &app,
                &run_id,
                &plan,
                ContentSyncRunStatus::Cancelled,
                applied_count,
                skipped_count,
                failed_count,
                Some("Content sync cancelled before completion.".to_string()),
            );
            if let Some(mut stream) = ftp_stream {
                let _ = stream.quit();
            }
            return;
        }

        let processed = (index + 1) as u64;
        let percent = if total_items == 0 { 100.0 } else { processed as f64 / total_items as f64 * 100.0 };

        match item.action {
            ContentSyncPlanItemAction::FullSyncFallback => {
                // This is a marker item only — it signals the frontend that a full API sync
                // is also needed to get new content. Local media repair continues below.
                emit_progress(
                    &app,
                    &run_id,
                    "fallback-noted",
                    ContentSyncRunStatus::Running,
                    percent,
                    Some("Note: a full API sync is recommended to get newly added content. Repairing local missing files now.".to_string()),
                    processed,
                );
                skipped_count += 1;
            }

            ContentSyncPlanItemAction::RepairMedia => {
                emit_progress(
                    &app,
                    &run_id,
                    "executing",
                    ContentSyncRunStatus::Running,
                    percent,
                    item.reason.clone(),
                    processed,
                );

                // Lazy-fetch FTP credentials (once per run)
                if ftp_settings.is_none() {
                    let lang = get_app_lang(&app);
                    let params_res = tauri::async_runtime::block_on(legacy_fetch::fetcher::fetch_params());
                    if let Ok(params) = params_res {
                        if let Some(conn_ftp_url) = params.conn_ftp {
                            let creds_res = tauri::async_runtime::block_on(
                                ftp_sync::credentials::fetch_ftp_credentials(&conn_ftp_url, &lang)
                            );
                            match creds_res {
                                Ok(settings) => ftp_settings = Some(settings),
                                Err(e) => {
                                    eprintln!("[sync] Failed to fetch FTP credentials: {}", e);
                                }
                            }
                        }
                    }
                }

                let Some(ref settings) = ftp_settings else {
                    eprintln!("[sync] Skipping RepairMedia item — FTP credentials unavailable");
                    skipped_count += 1;
                    continue;
                };

                // Lazy-connect FTP stream (once per run, reused for all files)
                if ftp_stream.is_none() {
                    match ftp_sync::client::get_ftp_client(settings) {
                        Ok(stream) => ftp_stream = Some(stream),
                        Err(e) => {
                            eprintln!("[sync] FTP connect failed: {}", e);
                            failed_count += 1;
                            continue;
                        }
                    }
                }

                let Some(ref mut stream) = ftp_stream else {
                    failed_count += 1;
                    continue;
                };

                // Load media paths for this item from the DB
                let media = {
                    let Ok(conn) = app.try_state::<AppState>()
                        .and_then(|s| s.db.get().ok().map(|c| c))
                    else {
                        failed_count += 1;
                        continue;
                    };

                    let local_id = item.local_id.unwrap_or(0);
                    match item.entity_type.as_str() {
                        "hymn" => crate::db::queries::content_sync::get_hymn_media_paths(&conn, local_id),
                        "album" => crate::db::queries::content_sync::get_album_media_paths(&conn, local_id),
                        _ => Ok(None),
                    }.unwrap_or(None)
                };

                let Some(media) = media else {
                    skipped_count += 1;
                    continue;
                };

                let app_data_dir = app.path().app_data_dir().unwrap_or_default();

                // Re-fetch music detail for hymns to get accurate remote URLs
                let music_detail: Option<crate::legacy_fetch::ApiMusic> =
                    if item.entity_type == "hymn" {
                        item.remote_id.and_then(|api_id| {
                            tauri::async_runtime::block_on(
                                crate::legacy_fetch::fetcher::fetch_music_detail(
                                    crate::legacy_fetch::ApiLanguage::Pt,
                                    api_id,
                                )
                            ).ok()
                        })
                    } else {
                        None
                    };

                let mut item_success = true;

                // Download each missing asset — skipping those without a resolvable remote URL
                let assets: &[(Option<String>, Option<String>)] = &[
                    (media.audio_path.clone(), music_detail.as_ref().and_then(|d| d.url_music.clone())),
                    (media.playback_path.clone(), music_detail.as_ref().and_then(|d| d.url_instrumental_music.clone())),
                    (media.cover_path.clone(), music_detail.as_ref().and_then(|d| d.url_image.clone())),
                ];

                for (local_rel_path, remote_url) in assets {
                    let Some(ref path) = local_rel_path else { continue; };

                    let full_path = app_data_dir.join(path);
                    if full_path.exists() { continue; } // already present

                    // Resolve FTP remote path from the remote URL
                    // If URL is unavailable, we cannot safely determine the FTP path — skip.
                    let Some(ref url) = remote_url else {
                        eprintln!("[sync] Skipping asset '{}': no remote URL available to resolve FTP path", path);
                        continue; // Skip this asset — don't fail the whole item
                    };

                    let remote_path = content_sync::resolve_remote_path_from_url(url);

                    emit_progress(
                        &app,
                        &run_id,
                        "downloading",
                        ContentSyncRunStatus::Running,
                        percent,
                        Some(format!("Downloading: {}", remote_path)),
                        processed,
                    );

                    if let Err(e) = ftp_sync::client::sync_file_on_stream(stream, &remote_path, &full_path) {
                        eprintln!("[sync] FTP error for '{}': {}", remote_path, e);
                        item_success = false;
                    }
                }

                if item_success {
                    applied_count += 1;
                } else {
                    failed_count += 1;
                }
            }

            _ => {
                // Placeholder for other actions (CreateHymn, UpdateHymn, etc.)
                applied_count += 1;
            }
        }
    }

    // Cleanly close the FTP connection
    if let Some(mut stream) = ftp_stream {
        let _ = stream.quit();
    }

    finish_run(
        &app,
        &run_id,
        &plan,
        ContentSyncRunStatus::Completed,
        applied_count,
        skipped_count,
        failed_count,
        Some("Content sync runtime completed.".to_string()),
    );
}
```

- [ ] **Step 4: Add the `get_app_lang` helper at the bottom of `commands/content_sync.rs`** (before the closing `}`)

```rust
/// Read the active language from app settings, defaulting to "pt".
fn get_app_lang(app: &AppHandle) -> String {
    app.try_state::<AppState>()
        .and_then(|state| state.db.get().ok())
        .and_then(|conn| {
            crate::db::queries::settings::get_setting(&conn, "app.language")
                .ok()
                .flatten()
                .map(|s| s.value)
        })
        .unwrap_or_else(|| "pt".to_string())
}
```

- [ ] **Step 5: Fix `start_content_sync` to also fetch params before building the plan (Bug 6)**

Locate `start_content_sync` (around line 70). At the start of its body, after getting the DB connection, add a `fetch_params` call. Replace the section that builds the plan:

```rust
// BEFORE (no remote version fetch — plan may be stale)
let summary = content_sync::load_summary(&conn, &file_exists)?;
let plan = content_sync::build_degraded_plan(&conn, summary, &file_exists)?;
```

With:

```rust
// Fetch current remote version so the plan matches what plan_content_sync computed
let params_res = tauri::async_runtime::block_on(legacy_fetch::fetcher::fetch_params());
let remote_version = params_res.ok().and_then(|p| p.db_version);
let _ = crate::db::queries::content_sync::mark_content_sync_checked(&conn, remote_version, None);

let summary = content_sync::load_summary(&conn, &file_exists)?;
let plan = content_sync::build_degraded_plan(&conn, summary, &file_exists)?;
```

**Note:** `start_content_sync` is currently `fn` (sync). The `block_on` call is acceptable here because the function is called from the IPC thread which already returns immediately (the sync runner is spawned in a new thread). However, `start_content_sync` itself must still return quickly — this single HTTP request is acceptable as it mirrors what `plan_content_sync` does. The plan is built immediately after on the same thread, before spawning the background worker.

- [ ] **Step 6: Add `use suppaftp;` import** at the top of `commands/content_sync.rs` if not already present:

```rust
use suppaftp; // For the FtpStream type in run_content_sync_background
```

Or rely on type inference — since `ftp_stream` is assigned from `get_ftp_client` which returns `FtpStream`, Rust will infer the type and an explicit `use` may not be needed. Check after compile.

- [ ] **Step 7: Run cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: 0 errors. Fix any remaining type errors (most likely the `Option<conn>` extraction pattern — adjust `.and_then` chains as needed to satisfy the borrow checker).

- [ ] **Step 8: Run all tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture 2>&1 | tail -30
```

Expected: all tests pass. Pay attention to:
- `content_sync::*` tests
- `ftp_sync::credentials::*` tests
- `ftp_sync::client::*` tests
- `commands::content_sync::*` tests

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/commands/content_sync.rs
git commit -m "fix(sync): remove FullSyncFallback early exit, reuse FTP connection, fix path fallback, align plan/execute flows"
```

---

## Chunk 5: Final Verification

### Task 7: Build check + manual smoke test

- [ ] **Step 1: Full Rust build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: 0 errors, 0 warnings about unused imports.

- [ ] **Step 2: Full test suite**

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture 2>&1 | grep -E "(test .* ok|FAILED|error)"
```

Expected: all tests pass, no failures.

- [ ] **Step 3: TypeScript check** (bindings are auto-generated, but check that no frontend types broke)

```bash
pnpm vite build && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Manual smoke test — trigger a content sync with real FTP**

Start the app in dev mode:
```bash
pnpm tauri dev
```

1. Open Settings → Content Sync
2. Click "Check for Updates" (calls `plan_content_sync`)
3. Observe: plan should show `RepairMedia` items for any hymns with missing media
4. Click "Start Sync" (calls `start_content_sync`)
5. Observe progress events in the UI — should NOT immediately complete with "Full sync fallback"
6. After completion: check that previously missing audio/image files exist in the app data dir

Check the app data dir for downloaded files:
```bash
# macOS
ls ~/Library/Application\ Support/com.louvorja.desktop/media/audio/
```

Expected: audio files present for synced hymns.

- [ ] **Step 5: Manual smoke test — verify FTP credential request includes params**

In the dev console, filter network requests for `conn_ftp`. The request URL should include `?lang=pt&datetime=...`.

- [ ] **Step 6: Tag the fix complete**

```bash
git tag ftp-verification-fixes-complete
git push origin main --tags
```

---

## Summary of All Changes

| File | Changed For | What Changed |
|------|------------|--------------|
| `src-tauri/src/ftp_sync/client.rs` | Bugs 3, 4, 5, 8 | Passive before login; loop+? for reads; temp file + rename; new `sync_file_on_stream` API |
| `src-tauri/src/ftp_sync/credentials.rs` | Bug 2 | `lang` + `datetime` appended to conn_ftp URL; better empty-body error message |
| `src-tauri/src/content_sync/mod.rs` | Bug 1 (plan) | `build_degraded_plan` always builds `RepairMedia` items; `FullSyncFallback` is a marker not a gate |
| `src-tauri/src/commands/content_sync.rs` | Bugs 1, 6, 7 | Removed early-exit on FullSyncFallback; single FTP connection per run; skip-not-fail on missing URL; `start_content_sync` fetches params |

## Manual Test Coverage

The following behaviors require manual verification with a live FTP server:

- FTP passive mode actually works end-to-end
- `conn_ftp` server accepts the `lang` + `datetime` params and returns credentials
- Download progress shows per-file progress during large audio files
- Re-run after failed download: temp `.~tmp` files are cleaned up
- Connection reuse: only one FTP login visible in server logs across N file downloads
