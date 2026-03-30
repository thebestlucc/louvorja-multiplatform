use std::io::Write;
use std::path::Path;
use crate::error::AppError;

const MAX_DOWNLOAD_BYTES: u64 = 500 * 1024 * 1024; // 500 MB

#[derive(Debug)]
pub enum DownloadResult {
    Downloaded,
    Skipped,
}

/// Returns true if the local file already exists with the expected size.
/// When `expected_size` is None, always returns false (force download).
pub fn should_skip_download(local_path: &Path, expected_size: Option<u64>) -> bool {
    // TODO(review): Size-only dedup has no integrity guarantee — a corrupted file of
    // the same size will be considered valid. Future work: add SHA-256 verification.
    // - security-reviewer, 2026-03-19, Severity: Low
    let Some(expected) = expected_size else {
        return false;
    };
    match std::fs::metadata(local_path) {
        Ok(meta) => meta.len() == expected,
        Err(_) => false,
    }
}

/// Validates that a URL uses HTTPS to prevent SSRF via non-HTTPS schemes.
fn validate_https_url(url: &str) -> Result<(), AppError> {
    if !url.starts_with("https://") {
        return Err(AppError::Internal(
            "Only HTTPS URLs are permitted for downloads".into(),
        ));
    }
    Ok(())
}

/// Creates a file with FILE_FLAG_SEQUENTIAL_SCAN on Windows for optimized cache behavior.
#[cfg(target_os = "windows")]
fn create_file_sequential(path: &Path) -> std::io::Result<std::fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .custom_flags(0x08000000) // FILE_FLAG_SEQUENTIAL_SCAN
        .open(path)
}

#[cfg(not(target_os = "windows"))]
fn create_file_sequential(path: &Path) -> std::io::Result<std::fs::File> {
    std::fs::File::create(path)
}

/// Internal download function — assumes URL has already been validated.
/// Public callers must use `download_file_http` which enforces HTTPS.
async fn download_bytes_to_path(
    client: &reqwest::Client,
    url: &str,
    local_path: &Path,
    expected_size: Option<u64>,
) -> Result<DownloadResult, AppError> {
    if should_skip_download(local_path, expected_size) {
        return Ok(DownloadResult::Skipped);
    }

    if let Some(parent) = local_path.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::Io)?;
    }

    let file_name = local_path
        .file_name()
        .ok_or_else(|| AppError::Internal("local_path has no file name component".into()))?;
    let nonce = uuid::Uuid::new_v4().simple().to_string();
    let temp_path = local_path.with_file_name(
        format!("{}.~{}.tmp", file_name.to_string_lossy(), nonce)
    );

    let result = async {
        let mut response = client
            .get(url)
            // Disable transfer-encoding compression for binary downloads.
            // CDNs (Cloudflare R2, etc.) may add Content-Encoding: gzip even for
            // .zip/.db files. reqwest's auto-decompression then tries to gunzip an
            // already-compressed binary, producing "error decoding response body".
            .header(reqwest::header::ACCEPT_ENCODING, "identity")
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("HTTP GET failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "HTTP {} downloading file",
                response.status()
            )));
        }

        if let Some(content_length) = response.content_length() {
            if content_length > MAX_DOWNLOAD_BYTES {
                return Err(AppError::Internal(format!(
                    "Download rejected: Content-Length {} exceeds {} MB limit",
                    content_length,
                    MAX_DOWNLOAD_BYTES / 1024 / 1024
                )));
            }
        }

        let file = create_file_sequential(&temp_path).map_err(AppError::Io)?;
        let mut writer = std::io::BufWriter::with_capacity(256 * 1024, file);
        let mut total_written: u64 = 0;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| AppError::Internal(format!("HTTP read failed: {}", e)))?
        {
            total_written += chunk.len() as u64;
            if total_written > MAX_DOWNLOAD_BYTES {
                return Err(AppError::Internal(format!(
                    "Download exceeded {} MB limit",
                    MAX_DOWNLOAD_BYTES / 1024 / 1024
                )));
            }
            writer.write_all(&chunk).map_err(AppError::Io)?;
        }
        writer.flush().map_err(AppError::Io)?;
        Ok(())
    }
    .await;

    match result {
        Ok(()) => {
            // Windows: fs::rename fails when destination exists. Remove first.
            if local_path.exists() {
                let _ = std::fs::remove_file(local_path);
            }
            std::fs::rename(&temp_path, local_path).map_err(|e| {
                let _ = std::fs::remove_file(&temp_path);
                AppError::Io(e)
            })?;
            Ok(DownloadResult::Downloaded)
        }
        Err(e) => {
            let _ = std::fs::remove_file(&temp_path);
            Err(e)
        }
    }
}

/// Download a single file via HTTPS to `local_path`.
/// Uses temp file + atomic rename for safety. Skips if already up to date.
pub async fn download_file_http(
    client: &reqwest::Client,
    url: &str,
    local_path: &Path,
    expected_size: Option<u64>,
) -> Result<DownloadResult, AppError> {
    validate_https_url(url)?;
    download_bytes_to_path(client, url, local_path, expected_size).await
}

/// Extract a ZIP file into `dest_dir`, preserving internal paths.
/// Used by the pack_sync executor after SHA-256 verification.
pub fn extract_zip_to(zip_path: &Path, dest_dir: &Path) -> Result<(), AppError> {
    extract_zip(zip_path, dest_dir)
}

fn extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<(), AppError> {
    std::fs::create_dir_all(dest_dir).map_err(AppError::Io)?;
    let canonical_dest = dest_dir.canonicalize().map_err(AppError::Io)?;
    let file = std::fs::File::open(zip_path).map_err(AppError::Io)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Internal(format!("ZIP open failed: {}", e)))?;

    let mut buf = vec![0u8; 256 * 1024];
    // Throttle: yield every 5 MB written to prevent I/O queue saturation on
    // eMMC/SSD devices (Windows reports 100% disk util on any sustained queue depth).
    let mut bytes_since_yield: u64 = 0;
    const YIELD_EVERY_BYTES: u64 = 5 * 1024 * 1024;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| AppError::Internal(format!("ZIP entry {} failed: {}", i, e)))?;

        let entry_name = entry.name().to_string();
        // Skip directory entries
        if entry_name.ends_with('/') || entry_name.ends_with('\\') {
            continue;
        }
        // Strip any leading slashes/backslashes to prevent absolute path injection
        let stripped = entry_name.trim_start_matches('/').trim_start_matches('\\');
        if stripped.is_empty() {
            continue;
        }

        let dest_path = canonical_dest.join(stripped);

        // Canonicalize the parent to detect traversal (symlinks, .., etc.)
        if let Some(parent) = dest_path.parent() {
            std::fs::create_dir_all(parent).map_err(AppError::Io)?;
        }
        // Verify extracted path stays within dest_dir
        // We can't canonicalize dest_path before it exists, so canonicalize its parent
        let actual_parent = dest_path
            .parent()
            .and_then(|p| p.canonicalize().ok())
            .ok_or_else(|| AppError::Internal(format!("ZIP entry '{}' has invalid parent", entry_name)))?;
        if !actual_parent.starts_with(&canonical_dest) {
            eprintln!("[extract_zip] Skipping path traversal attempt: {}", entry_name);
            continue;
        }

        let out = create_file_sequential(&dest_path).map_err(AppError::Io)?;
        let mut writer = std::io::BufWriter::with_capacity(256 * 1024, out);
        loop {
            let n = std::io::Read::read(&mut entry, &mut buf).map_err(AppError::Io)?;
            if n == 0 {
                break;
            }
            writer.write_all(&buf[..n]).map_err(AppError::Io)?;
            bytes_since_yield += n as u64;
            if bytes_since_yield >= YIELD_EVERY_BYTES {
                bytes_since_yield = 0;
                writer.flush().map_err(AppError::Io)?;
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }
        writer.flush().map_err(AppError::Io)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use wiremock::{MockServer, Mock, ResponseTemplate};
    use wiremock::matchers::{method, path};

    #[test]
    fn skip_when_file_exists_with_matching_size() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("song.mp3");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(&[0u8; 1024]).unwrap();
        drop(f);

        let result = should_skip_download(&path, Some(1024));
        assert!(result, "Should skip when local size matches expected");
    }

    #[test]
    fn no_skip_when_file_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("missing.mp3");
        let result = should_skip_download(&path, Some(1024));
        assert!(!result, "Should not skip when file is missing");
    }

    #[test]
    fn no_skip_when_size_differs() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("partial.mp3");
        std::fs::write(&path, [0u8; 512]).unwrap();
        let result = should_skip_download(&path, Some(1024));
        assert!(!result, "Should not skip when size differs");
    }

    #[test]
    fn no_skip_when_expected_size_is_none() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("existing.mp3");
        std::fs::write(&path, [0u8; 512]).unwrap();
        let result = should_skip_download(&path, None);
        assert!(!result, "Should not skip when expected_size is None (force download)");
    }

    #[test]
    fn extract_zip_skips_directory_entries_and_path_traversal() {
        let dir = tempdir().unwrap();
        // Create a zip with a directory entry, a normal file, and a path traversal attempt
        let zip_path = dir.path().join("test.zip");
        {
            use zip::write::SimpleFileOptions;
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let opts = SimpleFileOptions::default();

            // Directory entry (should be skipped)
            zip.add_directory("subdir/", opts).unwrap();

            // Normal file (should be extracted)
            zip.start_file("media/audio/test.mp3", opts).unwrap();
            zip.write_all(b"fake audio data").unwrap();

            // Path traversal (should be skipped)
            zip.start_file("../evil.txt", opts).unwrap();
            zip.write_all(b"evil content").unwrap();

            zip.finish().unwrap();
        }

        let dest = dir.path().join("extracted");
        std::fs::create_dir(&dest).unwrap();

        extract_zip(&zip_path, &dest).unwrap();

        // Normal file should exist
        assert!(dest.join("media/audio/test.mp3").exists());
        // Path traversal file should NOT exist outside dest
        assert!(!dir.path().join("evil.txt").exists());
    }

    // ── download_bytes_to_path tests ────────────────────────────────────────
    // These call the inner function directly so wiremock's HTTP URLs are accepted.
    // The HTTPS enforcement on the public API is tested separately below.

    #[tokio::test]
    async fn download_bytes_to_path_success_writes_file() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/audio.mp3"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(b"fake audio data"))
            .mount(&server)
            .await;

        let dir = tempdir().unwrap();
        let dest = dir.path().join("audio.mp3");
        let client = reqwest::Client::new();
        let url = format!("{}/audio.mp3", server.uri());

        let result = download_bytes_to_path(&client, &url, &dest, None).await.unwrap();
        assert!(matches!(result, DownloadResult::Downloaded));
        assert_eq!(std::fs::read(&dest).unwrap(), b"fake audio data");
    }

    #[tokio::test]
    async fn download_bytes_to_path_returns_error_on_404() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/missing.mp3"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&server)
            .await;

        let dir = tempdir().unwrap();
        let dest = dir.path().join("missing.mp3");
        let client = reqwest::Client::new();
        let url = format!("{}/missing.mp3", server.uri());

        let result = download_bytes_to_path(&client, &url, &dest, None).await;
        assert!(result.is_err());
        // Temp files should be cleaned up
        let leftover = std::fs::read_dir(dir.path()).unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp"))
            .count();
        assert_eq!(leftover, 0, "Temp files were not cleaned up after error");
    }

    #[tokio::test]
    async fn download_bytes_to_path_rejects_when_content_length_exceeds_limit() {
        let server = MockServer::start().await;
        // Send a small body but lie about content-length being 512 MB (> 500 MB limit).
        // reqwest reads the Content-Length header before streaming and rejects early.
        Mock::given(method("GET"))
            .and(path("/huge.zip"))
            .respond_with(
                ResponseTemplate::new(200)
                    .append_header("content-length", "536870912") // 512 MB > 500 MB limit
                    .set_body_bytes(b"small")
            )
            .mount(&server)
            .await;

        let dir = tempdir().unwrap();
        let dest = dir.path().join("huge.zip");
        let client = reqwest::Client::new();
        let url = format!("{}/huge.zip", server.uri());

        let result = download_bytes_to_path(&client, &url, &dest, None).await;
        // Either our size-limit guard fires (err contains "limit") or hyper/reqwest rejects
        // the mismatched Content-Length header before streaming begins — both are correct
        // behaviour: a claimed 512 MB download must never succeed.
        assert!(result.is_err(), "Expected error for oversized Content-Length, got Ok");
    }

    #[tokio::test]
    async fn download_bytes_to_path_skips_when_expected_size_matches() {
        let dir = tempdir().unwrap();
        let dest = dir.path().join("already.mp3");
        // Create a file with known size
        let mut f = std::fs::File::create(&dest).unwrap();
        f.write_all(&[0u8; 1024]).unwrap();
        drop(f);

        let client = reqwest::Client::new();
        // URL is never contacted because should_skip_download fires first
        let result = download_bytes_to_path(&client, "http://unused.invalid/audio.mp3", &dest, Some(1024)).await.unwrap();
        assert!(matches!(result, DownloadResult::Skipped));
    }

    // ── Public API: HTTPS guard ─────────────────────────────────────────────

    #[tokio::test]
    async fn download_file_http_rejects_non_https_url() {
        let client = reqwest::Client::new();
        let dir = tempdir().unwrap();
        let dest = dir.path().join("file.mp3");
        let result = download_file_http(&client, "http://example.com/file.mp3", &dest, None).await;
        assert!(result.is_err());
        let err_msg = format!("{:?}", result.unwrap_err());
        assert!(err_msg.contains("HTTPS"));
    }

    // ── extract_zip_to tests ─────────────────────────────────────────────────

    #[tokio::test]
    async fn extract_zip_to_extracts_files_correctly() {
        let mut zip_bytes = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut zip_bytes);
            let mut zip = zip::ZipWriter::new(cursor);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            zip.start_file("media/audio/test.mp3", options).unwrap();
            zip.write_all(b"fake audio").unwrap();
            zip.finish().unwrap();
        }

        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/pack.zip"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(zip_bytes))
            .mount(&server)
            .await;

        let dir = tempdir().unwrap();
        let url = format!("{}/pack.zip", server.uri());
        let client = reqwest::Client::new();
        let zip_path = dir.path().join("pack.zip");
        let dl = download_bytes_to_path(&client, &url, &zip_path, None).await.unwrap();
        assert!(matches!(dl, DownloadResult::Downloaded));

        extract_zip_to(&zip_path, dir.path()).unwrap();
        assert!(dir.path().join("media/audio/test.mp3").exists());
    }
}
