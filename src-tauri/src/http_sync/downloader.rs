use std::io::Write;
use std::path::Path;
use crate::error::AppError;

const MAX_DOWNLOAD_BYTES: u64 = 500 * 1024 * 1024; // 500 MB

#[derive(Debug)]
pub enum DownloadResult {
    Downloaded,
    Skipped,
}

/// Returns true if the local file already exists with the expected size
/// AND matches the expected SHA-256 hash (when provided).
pub fn should_skip_download(
    local_path: &Path,
    expected_size: Option<u64>,
    expected_sha256: Option<&str>,
) -> bool {
    let Some(expected) = expected_size else {
        return false;
    };
    let meta = match std::fs::metadata(local_path) {
        Ok(m) => m,
        Err(_) => return false,
    };
    if meta.len() != expected {
        return false;
    }
    // Size matches — verify hash if provided
    match expected_sha256 {
        Some(hash) if !hash.is_empty() => {
            verify_sha256_file(local_path, hash).unwrap_or(false)
        }
        _ => true, // No hash provided, size-only check (backwards compatible)
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

/// Sets I/O priority to VeryLow on a file handle so all disk requests through
/// this handle are deprioritized at the kernel I/O scheduler level.
/// This applies regardless of which thread (including tokio thread pool) submits the I/O.
#[cfg(target_os = "windows")]
#[allow(dead_code)]
fn set_file_io_priority_low(file: &std::fs::File) {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::SetFileInformationByHandle;
    // FileIoPriorityHintInfo = 43, IoPriorityHintVeryLow = 0
    #[repr(C)]
    struct FILE_IO_PRIORITY_HINT_INFO {
        PriorityHint: u32,
    }
    let hint = FILE_IO_PRIORITY_HINT_INFO { PriorityHint: 0 };
    unsafe {
        SetFileInformationByHandle(
            file.as_raw_handle() as _,
            43, // FileIoPriorityHintInfo
            &hint as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<FILE_IO_PRIORITY_HINT_INFO>() as u32,
        );
    }
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
fn set_file_io_priority_low(_file: &std::fs::File) {}

/// Creates a file with FILE_FLAG_SEQUENTIAL_SCAN on Windows for optimized cache behavior.
#[cfg(target_os = "windows")]
fn create_file_sequential(path: &Path) -> std::io::Result<std::fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    let file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .custom_flags(0x08000000) // FILE_FLAG_SEQUENTIAL_SCAN
        .open(path)?;
    set_file_io_priority_low(&file);
    Ok(file)
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
    if should_skip_download(local_path, expected_size, None) {
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

fn extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<(), AppError> {
    std::fs::create_dir_all(dest_dir).map_err(AppError::Io)?;
    let canonical_dest = dest_dir.canonicalize().map_err(AppError::Io)?;
    let file = std::fs::File::open(zip_path).map_err(AppError::Io)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Internal(format!("ZIP open failed: {}", e)))?;

    // Throttle: yield every 10 MB written to prevent I/O queue saturation on
    // eMMC/SSD devices (Windows reports 100% disk util on any sustained queue depth).
    let mut bytes_since_yield: u64 = 0;
    const YIELD_EVERY_BYTES: u64 = 10 * 1024 * 1024;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| AppError::Internal(format!("ZIP entry {} failed: {}", i, e)))?;

        let raw_entry_name = entry.name().to_string();
        // Normalize entry name to NFC. ZIP files from macOS use NFD filenames;
        // without normalization, extracted files have NFD names that don't match
        // the NFC paths stored in content DBs (both look identical but differ in bytes).
        #[cfg(target_os = "windows")]
        let entry_name = {
            use unicode_normalization::UnicodeNormalization;
            raw_entry_name.nfc().collect::<String>()
        };
        #[cfg(not(target_os = "windows"))]
        let entry_name = raw_entry_name;
        // Skip directory entries
        if entry_name.ends_with('/') || entry_name.ends_with('\\') {
            continue;
        }
        // Strip any leading slashes/backslashes to prevent absolute path injection
        let stripped = entry_name.trim_start_matches('/').trim_start_matches('\\');
        if stripped.is_empty() {
            continue;
        }
        // Normalize forward slashes to platform separator. On Windows,
        // canonicalize() produces \\?\ verbatim paths where '/' is NOT
        // a directory separator — joining "covers/img.jpg" would create a
        // single component with a literal '/' instead of nested dirs.
        let stripped = stripped.replace('/', std::path::MAIN_SEPARATOR_STR);

        let dest_path = canonical_dest.join(&stripped);

        // Path traversal guard: dest_path must stay inside canonical_dest.
        // Component-based check avoids per-file canonicalize syscall.
        if !dest_path.starts_with(&canonical_dest) {
            log::warn!("[extract_zip] Skipping path traversal attempt: {}", entry_name);
            continue;
        }

        if let Some(parent) = dest_path.parent() {
            std::fs::create_dir_all(parent).map_err(AppError::Io)?;
        }

        let out = create_file_sequential(&dest_path).map_err(AppError::Io)?;
        let mut writer = std::io::BufWriter::with_capacity(512 * 1024, out);
        let mut reader = std::io::BufReader::with_capacity(128 * 1024, &mut entry);
        let mut buf = [0u8; 128 * 1024];
        loop {
            let n = std::io::Read::read(&mut reader, &mut buf).map_err(AppError::Io)?;
            if n == 0 {
                break;
            }
            writer.write_all(&buf[..n]).map_err(AppError::Io)?;
            bytes_since_yield += n as u64;
            if bytes_since_yield >= YIELD_EVERY_BYTES {
                bytes_since_yield = 0;
                writer.flush().map_err(AppError::Io)?;
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
        }
        writer.flush().map_err(AppError::Io)?;
    }

    Ok(())
}

// ── Streaming ZIP extraction ─────────────────────────────────────────────────

/// Adapts a `std::sync::mpsc::Receiver<bytes::Bytes>` to `std::io::Read`.
/// Receives chunks from the download task and feeds them to the ZIP extractor.
struct ChannelReader {
    rx: std::sync::mpsc::Receiver<bytes::Bytes>,
    current: Option<(bytes::Bytes, usize)>,
}

impl ChannelReader {
    fn new(rx: std::sync::mpsc::Receiver<bytes::Bytes>) -> Self {
        Self { rx, current: None }
    }
}

impl std::io::Read for ChannelReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        loop {
            if let Some((chunk, offset)) = &mut self.current {
                let available = chunk.len() - *offset;
                if available == 0 {
                    self.current = None;
                    continue;
                }
                let to_copy = available.min(buf.len());
                buf[..to_copy].copy_from_slice(&chunk[*offset..*offset + to_copy]);
                *offset += to_copy;
                return Ok(to_copy);
            }
            match self.rx.recv() {
                Ok(chunk) => self.current = Some((chunk, 0)),
                Err(_) => return Ok(0), // sender dropped = EOF
            }
        }
    }
}

/// Wraps a `Read` and feeds every byte through a SHA-256 hasher simultaneously.
struct TeeHashReader<R: std::io::Read> {
    inner: R,
    hasher: sha2::Sha256,
}

impl<R: std::io::Read> TeeHashReader<R> {
    fn new(inner: R) -> Self {
        use sha2::Digest;
        Self {
            inner,
            hasher: sha2::Sha256::new(),
        }
    }
    fn finalize(self) -> String {
        use sha2::Digest;
        format!("{:x}", self.hasher.finalize())
    }
}

impl<R: std::io::Read> std::io::Read for TeeHashReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        use sha2::Digest;
        let n = self.inner.read(buf)?;
        if n > 0 {
            self.hasher.update(&buf[..n]);
        }
        Ok(n)
    }
}

/// Returns true if the error is a ZIP format/parse problem (not a network error).
/// Used to decide whether to fall back to temp-file extraction.
fn is_zip_format_error(e: &AppError) -> bool {
    let msg = e.to_string();
    msg.contains("ZIP stream error")
        || msg.contains("invalid zip")
        || msg.contains("Extraction thread died")
}

/// Downloads a ZIP from `url` and extracts it to `dest_dir`.
/// Phase 1: tries streaming extraction (no temp file).
/// Phase 2: if the ZIP uses data descriptors or a non-streaming format, falls back
///          to downloading to a temp file and extracting via seekable ZipArchive.
pub async fn stream_extract_zip(
    client: &reqwest::Client,
    url: &str,
    dest_dir: &Path,
    expected_sha256: &str,
) -> Result<(), AppError> {
    validate_https_url(url)?;

    match try_stream_extract_zip(client, url, dest_dir, expected_sha256).await {
        Ok(()) => return Ok(()),
        Err(e) if is_zip_format_error(&e) => {
            log::warn!(
                "[pack-sync] Streaming extraction failed ({}), falling back to temp-file extraction",
                e
            );
        }
        Err(e) => return Err(e),
    }

    fallback_download_and_extract(client, url, dest_dir, expected_sha256).await
}

async fn fallback_download_and_extract(
    client: &reqwest::Client,
    url: &str,
    dest_dir: &Path,
    expected_sha256: &str,
) -> Result<(), AppError> {
    std::fs::create_dir_all(dest_dir).map_err(AppError::Io)?;

    let nonce = uuid::Uuid::new_v4().simple().to_string();
    let tmp_path = dest_dir.join(format!(".pack_{}.zip.tmp", nonce));

    if let Err(e) = download_bytes_to_path(client, url, &tmp_path, None).await {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(e);
    }

    if !expected_sha256.is_empty() {
        let tmp_clone = tmp_path.clone();
        let expected = expected_sha256.to_string();
        let ok = tokio::task::spawn_blocking(move || verify_sha256_file(&tmp_clone, &expected))
            .await
            .map_err(|e| AppError::Internal(format!("SHA verify task panicked: {}", e)))??;
        if !ok {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(AppError::Internal(format!(
                "SHA-256 mismatch (fallback) for {}",
                url
            )));
        }
    }

    let result = extract_zip(&tmp_path, dest_dir);
    let _ = std::fs::remove_file(&tmp_path);
    result
}

fn verify_sha256_file(path: &Path, expected: &str) -> Result<bool, AppError> {
    use sha2::Digest;
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(AppError::Io)?;
    let mut hasher = sha2::Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(AppError::Io)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()) == expected)
}

/// Inner streaming implementation. Renamed from `stream_extract_zip` to allow
/// the public wrapper to add a fallback for data-descriptor ZIPs.
async fn try_stream_extract_zip(
    client: &reqwest::Client,
    url: &str,
    dest_dir: &Path,
    expected_sha256: &str,
) -> Result<(), AppError> {
    let canonical_dest = {
        std::fs::create_dir_all(dest_dir).map_err(AppError::Io)?;
        dest_dir.canonicalize().map_err(AppError::Io)?
    };

    // Bounded channel: backpressure so download pauses when extractor is behind.
    let (tx, rx) = std::sync::mpsc::sync_channel::<bytes::Bytes>(8);

    let dest_clone = canonical_dest.clone();

    // Spawn blocking thread: reads from channel, extracts zip, tracks files written.
    let extract_handle = tokio::task::spawn_blocking(move || -> Result<(String, Vec<std::path::PathBuf>), AppError> {
        let reader = ChannelReader::new(rx);
        let mut tee = TeeHashReader::new(reader);
        let mut extracted_files: Vec<std::path::PathBuf> = Vec::new();

        loop {
            match zip::read::read_zipfile_from_stream(&mut tee) {
                Ok(Some(mut entry)) => {
                    let raw_entry_name = entry.name().to_string();
                    // Normalize entry name to NFC (see extract_zip for rationale).
                    #[cfg(target_os = "windows")]
                    let entry_name = {
                        use unicode_normalization::UnicodeNormalization;
                        raw_entry_name.nfc().collect::<String>()
                    };
                    #[cfg(not(target_os = "windows"))]
                    let entry_name = raw_entry_name;
                    if entry_name.ends_with('/') || entry_name.ends_with('\\') {
                        // Consume the entry (should have no data, but drain anyway)
                        let _ = std::io::copy(&mut entry, &mut std::io::sink());
                        continue;
                    }
                    let stripped = entry_name
                        .trim_start_matches('/')
                        .trim_start_matches('\\');
                    if stripped.is_empty() {
                        let _ = std::io::copy(&mut entry, &mut std::io::sink());
                        continue;
                    }
                    // Normalize '/' → platform separator for Windows \\?\ verbatim paths
                    let stripped = stripped.replace('/', std::path::MAIN_SEPARATOR_STR);

                    let dest_path = dest_clone.join(&stripped);

                    // Path traversal guard: component-based check avoids per-file canonicalize.
                    if !dest_path.starts_with(&dest_clone) {
                        log::warn!("[stream_extract] Skipping path traversal: {}", entry_name);
                        // Must drain the entry so the stream advances correctly.
                        let _ = std::io::copy(&mut entry, &mut std::io::sink());
                        continue;
                    }

                    if let Some(parent) = dest_path.parent() {
                        std::fs::create_dir_all(parent).map_err(AppError::Io)?;
                    }

                    let out = create_file_sequential(&dest_path).map_err(AppError::Io)?;
                    let mut writer = std::io::BufWriter::with_capacity(512 * 1024, out);
                    std::io::copy(&mut entry, &mut writer).map_err(AppError::Io)?;
                    writer.flush().map_err(AppError::Io)?;

                    extracted_files.push(dest_path);
                }
                Ok(None) => break, // end of zip
                Err(e) => {
                    return Err(AppError::Internal(format!("ZIP stream error: {}", e)))
                }
            }
        }

        let actual_hash = tee.finalize();
        Ok((actual_hash, extracted_files))
    });

    // Async: stream download, send chunks to extraction thread.
    let download_result = async {
        let mut response = client
            .get(url)
            .header(reqwest::header::ACCEPT_ENCODING, "identity")
            .timeout(std::time::Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("HTTP GET failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "HTTP {} downloading file",
                response.status()
            )));
        }

        let mut total: u64 = 0;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| AppError::Internal(format!("HTTP read failed: {}", e)))?
        {
            total += chunk.len() as u64;
            if total > MAX_DOWNLOAD_BYTES {
                return Err(AppError::Internal(format!(
                    "Download exceeded {} MB limit",
                    MAX_DOWNLOAD_BYTES / 1024 / 1024
                )));
            }
            // send() blocks when channel is full (backpressure from extractor)
            tx.send(chunk)
                .map_err(|_| AppError::Internal("Extraction thread died".into()))?;
        }
        Ok(())
    }
    .await;

    drop(tx); // EOF signal to extraction thread

    // Wait for extraction to finish.
    let extract_result = extract_handle
        .await
        .map_err(|e| AppError::Internal(format!("Extract task panicked: {}", e)))?;

    // Surface any download error first.
    download_result?;

    let (actual_hash, extracted_files) = extract_result?;

    // Log sample of extracted files to aid path debugging
    if !extracted_files.is_empty() {
        let sample: Vec<_> = extracted_files.iter().take(3).map(|p| format!("{:?}", p)).collect();
        log::info!(
            "[stream_extract] Extracted {} files to {:?}. Sample: [{}]",
            extracted_files.len(),
            dest_dir,
            sample.join(", ")
        );
    }

    // Verify SHA-256 (skip if expected is empty).
    if !expected_sha256.is_empty() && actual_hash != expected_sha256 {
        // Cleanup all extracted files on hash mismatch.
        for f in &extracted_files {
            let _ = std::fs::remove_file(f);
        }
        return Err(AppError::Internal(format!(
            "SHA-256 mismatch: expected {}, got {}",
            expected_sha256, actual_hash
        )));
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

        let result = should_skip_download(&path, Some(1024), None);
        assert!(result, "Should skip when local size matches expected");
    }

    #[test]
    fn no_skip_when_file_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("missing.mp3");
        let result = should_skip_download(&path, Some(1024), None);
        assert!(!result, "Should not skip when file is missing");
    }

    #[test]
    fn no_skip_when_size_differs() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("partial.mp3");
        std::fs::write(&path, [0u8; 512]).unwrap();
        let result = should_skip_download(&path, Some(1024), None);
        assert!(!result, "Should not skip when size differs");
    }

    #[test]
    fn no_skip_when_expected_size_is_none() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("existing.mp3");
        std::fs::write(&path, [0u8; 512]).unwrap();
        let result = should_skip_download(&path, None, None);
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
    async fn extract_zip_extracts_files_correctly() {
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

        extract_zip(&zip_path, dir.path()).unwrap();
        assert!(dir.path().join("media/audio/test.mp3").exists());
    }
}
