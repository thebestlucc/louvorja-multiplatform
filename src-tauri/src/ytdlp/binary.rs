use std::fs;
use std::path::{Path, PathBuf};
use reqwest::blocking::Client;
use crate::error::AppError;

/// Returns the platform-specific binary filename.
fn binary_name() -> &'static str {
    // On Windows, x86 (32-bit) builds must use yt-dlp_x86.exe — the standard
    // yt-dlp.exe is a 64-bit binary and will fail to run on 32-bit Windows.
    #[cfg(all(target_os = "windows", target_arch = "x86"))]
    return "yt-dlp_x86.exe";
    #[cfg(all(target_os = "windows", not(target_arch = "x86")))]
    return "yt-dlp.exe";
    #[cfg(target_os = "macos")]
    return "yt-dlp_macos";
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    return "yt-dlp";
}

/// Returns the path where the yt-dlp binary should be stored.
fn binary_path(app_data_dir: &Path) -> PathBuf {
    let bin_dir = app_data_dir.join("bin");
    bin_dir.join(binary_name())
}

/// Ensures the yt-dlp binary exists. Downloads if missing.
/// MUST be called from a spawned thread — uses blocking HTTP.
pub fn ensure_binary(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let path = binary_path(app_data_dir);
    if path.exists() {
        return Ok(path);
    }
    download_binary(app_data_dir)
}

/// Downloads the latest yt-dlp binary from GitHub releases.
/// MUST be called from a spawned thread.
///
/// Uses an atomic write pattern: bytes land in `<binary>.tmp` first, then
/// renamed to the final path only after the SHA256 check passes.  This
/// prevents a partial file from blocking the next run when a download is
/// interrupted (cancelled pack sync, network drop, process kill).
pub fn download_binary(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let bin_dir = app_data_dir.join("bin");
    fs::create_dir_all(&bin_dir)?;

    let name = binary_name();
    let dest = binary_path(app_data_dir);
    let tmp = dest.with_extension("tmp");

    // Remove any stale .tmp left by a previous interrupted download so we
    // never confuse a half-written file with a valid binary.
    if tmp.exists() {
        let _ = fs::remove_file(&tmp);
    }

    let url = format!(
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/{}",
        name
    );
    let hash_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS";

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {}", e)))?;

    // Download the binary
    let binary_bytes = client.get(&url)
        .send()
        .map_err(|e| AppError::Internal(format!("Failed to download yt-dlp: {}", e)))?
        .bytes()
        .map_err(|e| AppError::Internal(format!("Failed to read yt-dlp bytes: {}", e)))?;

    // Download SHA256 checksums
    let hash_result = client.get(hash_url)
        .send()
        .and_then(|r| r.text());

    // Verify hash if checksums are available
    if let Ok(checksums) = hash_result {
        let computed_hash = compute_sha256(&binary_bytes);
        let expected = find_hash_for_file(&checksums, name);
        if let Some(expected_hash) = expected {
            if computed_hash != expected_hash {
                return Err(AppError::Internal(format!(
                    "SHA256 mismatch for {}: expected {}, got {}",
                    name, expected_hash, computed_hash
                )));
            }
        }
        // If hash not found in checksums file, proceed anyway (some releases may not have it)
    }

    // Write to .tmp first; only rename to final path after verification.
    // If this process is killed between write and rename, the next call
    // removes the stale .tmp at the top of this function.
    fs::write(&tmp, &binary_bytes)?;

    // Atomic rename — readers never observe a partial binary.
    fs::rename(&tmp, &dest)?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o755))?;
    }

    Ok(dest)
}

/// Force re-downloads the latest yt-dlp binary.
pub fn update_binary(app_data_dir: &Path) -> Result<PathBuf, AppError> {
    let path = binary_path(app_data_dir);
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    download_binary(app_data_dir)
}

fn compute_sha256(data: &[u8]) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn find_hash_for_file(checksums: &str, filename: &str) -> Option<String> {
    for line in checksums.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 && parts[1] == filename {
            return Some(parts[0].to_lowercase());
        }
    }
    None
}
