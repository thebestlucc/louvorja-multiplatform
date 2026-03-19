use std::io::Write;
use std::path::Path;
use crate::error::AppError;

const MAX_DOWNLOAD_BYTES: u64 = 500 * 1024 * 1024; // 500 MB

pub enum DownloadResult {
    Downloaded,
    Skipped,
}

pub enum PackResult {
    Extracted { files_count: usize },
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

/// Download a single file via HTTP to `local_path`.
/// Uses temp file + atomic rename for safety. Skips if already up to date.
pub async fn download_file_http(
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

    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let temp_path = local_path.with_extension(format!("~{}.tmp", nonce));

    let result = async {
        let mut response = client
            .get(url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("HTTP GET failed for '{}': {}", url, e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "HTTP {} downloading file",
                response.status()
            )));
        }

        let mut file = std::fs::File::create(&temp_path).map_err(AppError::Io)?;
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
            file.write_all(&chunk).map_err(AppError::Io)?;
        }
        Ok(())
    }
    .await;

    match result {
        Ok(()) => {
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

/// Download a ZIP pack from CDN and extract into `app_data_dir`.
/// Skips download+extraction when `local_version >= expected_version`.
/// ZIP entries are extracted preserving their internal paths relative to `app_data_dir`.
pub async fn download_and_extract_pack(
    client: &reqwest::Client,
    pack_url: &str,
    expected_version: u32,
    local_version: u32,
    app_data_dir: &Path,
) -> Result<PackResult, AppError> {
    if local_version >= expected_version {
        return Ok(PackResult::Skipped);
    }

    // Download ZIP to a unique temp file in app_data_dir
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let temp_zip = app_data_dir.join(format!("pack_download_{}_{}.zip.tmp", expected_version, nonce));

    let download = download_file_http(client, pack_url, &temp_zip, None).await;
    if let Err(e) = download {
        let _ = std::fs::remove_file(&temp_zip);
        return Err(e);
    }

    // Extract ZIP
    let extract_result = extract_zip(&temp_zip, app_data_dir);
    let _ = std::fs::remove_file(&temp_zip); // always clean up

    extract_result
}

fn extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<PackResult, AppError> {
    let canonical_dest = dest_dir.canonicalize().map_err(AppError::Io)?;
    let file = std::fs::File::open(zip_path).map_err(AppError::Io)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Internal(format!("ZIP open failed: {}", e)))?;

    let mut files_count = 0;
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

        let mut out = std::fs::File::create(&dest_path).map_err(AppError::Io)?;
        std::io::copy(&mut entry, &mut out).map_err(AppError::Io)?;
        files_count += 1;
    }

    Ok(PackResult::Extracted { files_count })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
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

        let result = extract_zip(&zip_path, &dest).unwrap();
        match result {
            PackResult::Extracted { files_count } => {
                assert_eq!(files_count, 1, "Should extract exactly 1 file (skipping dir + traversal)");
            }
            PackResult::Skipped => panic!("Should not be skipped"),
        }

        // Normal file should exist
        assert!(dest.join("media/audio/test.mp3").exists());
        // Path traversal file should NOT exist outside dest
        assert!(!dir.path().join("evil.txt").exists());
    }

    #[tokio::test]
    async fn download_file_http_success_writes_file() {
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

        let result = download_file_http(&client, &url, &dest, None).await.unwrap();
        assert!(matches!(result, DownloadResult::Downloaded));
        assert!(dest.exists());
        assert_eq!(std::fs::read(&dest).unwrap(), b"fake audio data");
    }

    #[tokio::test]
    async fn download_file_http_returns_error_on_404() {
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

        let result = download_file_http(&client, &url, &dest, None).await;
        assert!(result.is_err());
        // Temp file should be cleaned up
        assert!(!dest.exists());
    }

    #[tokio::test]
    async fn download_and_extract_pack_skips_when_up_to_date() {
        let dir = tempdir().unwrap();
        let client = reqwest::Client::new();
        // local_version == expected_version → should skip without any HTTP call
        let result = download_and_extract_pack(&client, "http://unused.invalid/pack.zip", 3, 3, dir.path()).await.unwrap();
        assert!(matches!(result, PackResult::Skipped));
    }

    #[tokio::test]
    async fn download_and_extract_pack_skips_when_local_version_gte_expected() {
        let dir = tempdir().unwrap();
        let client = reqwest::Client::new();

        // local_version (5) >= expected_version (5) → should skip without any HTTP call
        let result = download_and_extract_pack(
            &client,
            "http://this-should-not-be-called.invalid/pack.zip",
            5, // expected_version
            5, // local_version
            dir.path(),
        )
        .await
        .unwrap();

        assert!(matches!(result, PackResult::Skipped));
    }

    #[tokio::test]
    async fn download_and_extract_pack_skips_when_local_version_gt_expected() {
        let dir = tempdir().unwrap();
        let client = reqwest::Client::new();

        // local_version (7) > expected_version (5) → should skip
        let result = download_and_extract_pack(
            &client,
            "http://this-should-not-be-called.invalid/pack.zip",
            5, // expected_version
            7, // local_version
            dir.path(),
        )
        .await
        .unwrap();

        assert!(matches!(result, PackResult::Skipped));
    }
}
