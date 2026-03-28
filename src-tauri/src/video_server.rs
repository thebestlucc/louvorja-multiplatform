use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use memmap2::Mmap;
use serde::Serialize;
use specta::Type;
use uuid::Uuid;

use crate::streaming::media_content_type;

/// Maximum bytes served per single range response (10 MB).
const MAX_RANGE_CHUNK: u64 = 10 * 1024 * 1024;

/// Chunk size for streaming file data to the TCP socket (64 KB).
const STREAM_CHUNK_SIZE: usize = 65_536;

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoServerInfo {
    pub is_running: bool,
    pub port: u16,
    pub access_token: String,
}

struct ActiveFile {
    path: PathBuf,
    mmap: Arc<Mmap>,
    len: u64,
    content_type: &'static str,
}

pub struct VideoServer {
    port: u16,
    access_token: String,
    media_root: Option<PathBuf>,
    is_running: Arc<AtomicBool>,
    stop_flag: Arc<AtomicBool>,
    thread_handle: Option<thread::JoinHandle<()>>,
    active_file: Arc<Mutex<Option<ActiveFile>>>,
}

impl VideoServer {
    pub fn new() -> Self {
        Self {
            port: 0,
            access_token: Uuid::new_v4().to_string(),
            media_root: None,
            is_running: Arc::new(AtomicBool::new(false)),
            stop_flag: Arc::new(AtomicBool::new(false)),
            thread_handle: None,
            active_file: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_media_root(&mut self, root: PathBuf) {
        let canonical = root.canonicalize().unwrap_or_else(|_| root.clone());
        println!("[video-server] media_root set to '{}'", canonical.display());
        self.media_root = Some(canonical);
    }

    pub fn start(&mut self) -> Result<VideoServerInfo, String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(self.info());
        }

        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to bind video server: {e}"))?;
        self.port = listener
            .local_addr()
            .map(|a| a.port())
            .map_err(|e| format!("Failed to get local addr: {e}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to set non-blocking: {e}"))?;

        self.is_running.store(true, Ordering::SeqCst);
        self.stop_flag.store(false, Ordering::SeqCst);

        let is_running = Arc::clone(&self.is_running);
        let stop_flag = Arc::clone(&self.stop_flag);
        let access_token = self.access_token.clone();
        let media_root = self.media_root.clone();
        let active_file = Arc::clone(&self.active_file);

        println!(
            "[video-server] started on port {} (media_root={:?})",
            self.port,
            media_root.as_ref().map(|p| p.display().to_string())
        );

        self.thread_handle = Some(thread::spawn(move || {
            accept_loop(listener, &is_running, &stop_flag, &access_token, &media_root, &active_file);
        }));

        Ok(self.info())
    }

    /// Stop the video server. Called on app shutdown or when no longer needed.
    #[allow(dead_code)]
    pub fn stop(&mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        self.is_running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }

    pub fn info(&self) -> VideoServerInfo {
        VideoServerInfo {
            is_running: self.is_running.load(Ordering::SeqCst),
            port: self.port,
            access_token: self.access_token.clone(),
        }
    }
}

// --- Accept loop ---

fn accept_loop(
    listener: TcpListener,
    is_running: &Arc<AtomicBool>,
    stop_flag: &Arc<AtomicBool>,
    access_token: &str,
    media_root: &Option<PathBuf>,
    active_file: &Arc<Mutex<Option<ActiveFile>>>,
) {
    let token = Arc::new(access_token.to_string());
    let root = Arc::new(media_root.clone());

    while is_running.load(Ordering::SeqCst) && !stop_flag.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, addr)) => {
                let _ = stream.set_nonblocking(false);

                // Only accept loopback connections
                if !addr.ip().is_loopback() {
                    if let Ok(mut s) = stream.try_clone() {
                        send_forbidden(&mut s);
                    }
                    continue;
                }
                let _ = stream.set_nodelay(true);

                let token = Arc::clone(&token);
                let root = Arc::clone(&root);
                let active_file = Arc::clone(active_file);

                thread::spawn(move || {
                    handle_video_connection(stream, &token, &root, &active_file);
                });
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(_) => break,
        }
    }
}

// --- HTTP request handling ---

struct HttpRequest {
    method: String,
    path: String,
    headers: HashMap<String, String>,
}

fn parse_http_request(stream: &TcpStream) -> Option<HttpRequest> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }
    let method = parts[0].to_string();
    let path = parts[1].to_string();

    let mut headers = HashMap::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).ok()? == 0 {
            break;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            break;
        }
        if let Some((key, value)) = trimmed.split_once(':') {
            headers.insert(
                key.trim().to_ascii_lowercase(),
                value.trim().to_string(),
            );
        }
    }

    Some(HttpRequest {
        method,
        path,
        headers,
    })
}

fn create_mmap(file_path: &Path) -> Option<ActiveFile> {
    let file = std::fs::File::open(file_path).ok()?;
    let len = file.metadata().ok()?.len();
    if len == 0 {
        return None;
    }
    let mmap = unsafe { Mmap::map(&file).ok()? };
    let content_type = detect_video_content_type_from_bytes(&mmap, file_path);
    println!(
        "[video-server] mmap '{}' ({} bytes, {content_type})",
        file_path.display(),
        len
    );
    Some(ActiveFile {
        path: file_path.to_path_buf(),
        mmap: Arc::new(mmap),
        len,
        content_type,
    })
}

fn handle_video_connection(
    mut stream: TcpStream,
    access_token: &str,
    media_root: &Option<PathBuf>,
    active_file: &Arc<Mutex<Option<ActiveFile>>>,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));

    // Keep-alive loop: handle multiple requests per connection
    loop {
        let request = match parse_http_request(&stream) {
            Some(r) => r,
            None => break, // Client closed or timeout
        };

        // Only log non-range requests to avoid flooding stdout during seeking
        if request.headers.get("range").is_none() {
            println!(
                "[video-server] {} {}",
                request.method,
                &request.path[..request.path.len().min(120)],
            );
        }

        // Handle CORS preflight
        if request.method == "OPTIONS" {
            send_cors_preflight(&mut stream);
            continue;
        }

        // Only allow GET requests
        if request.method != "GET" {
            send_method_not_allowed(&mut stream);
            break;
        }

        // Strip query string and fragment
        let clean_path = request.path.split(['?', '#']).next().unwrap_or(&request.path);

        // Expected format: /video/{access_token}/{encoded_path}
        let stripped = match clean_path.strip_prefix("/video/") {
            Some(s) => s,
            None => {
                send_not_found(&mut stream);
                break;
            }
        };

        // Split into token and file path
        let (req_token, encoded_path) = match stripped.split_once('/') {
            Some((t, p)) => (t, p),
            None => {
                send_not_found(&mut stream);
                break;
            }
        };

        // Validate access token
        if req_token != access_token {
            send_forbidden(&mut stream);
            break;
        }

        // Decode percent-encoded path
        let decoded_path = match decode_percent_path(encoded_path) {
            Some(d) => d,
            None => {
                send_not_found(&mut stream);
                break;
            }
        };

        // Normalize Windows backslashes
        let decoded = decoded_path.replace('\\', "/");

        // Resolve the file path
        let root = match media_root {
            Some(r) => r.clone(),
            None => {
                send_not_found(&mut stream);
                break;
            }
        };

        let file_path = match resolve_video_path(&decoded, &root) {
            Ok(p) => p,
            Err(reason) => {
                eprintln!("[video-server] 404: {reason}");
                send_not_found(&mut stream);
                break;
            }
        };

        // Get or create mmap for this file
        let (mmap, file_len, content_type) = {
            let mut guard = match active_file.lock() {
                Ok(g) => g,
                Err(poisoned) => poisoned.into_inner(),
            };
            if let Some(ref af) = *guard {
                if af.path == file_path {
                    (Arc::clone(&af.mmap), af.len, af.content_type)
                } else {
                    // Different file — create new mmap
                    match create_mmap(&file_path) {
                        Some(af_new) => {
                            let result = (Arc::clone(&af_new.mmap), af_new.len, af_new.content_type);
                            *guard = Some(af_new);
                            result
                        }
                        None => {
                            send_not_found(&mut stream);
                            break;
                        }
                    }
                }
            } else {
                match create_mmap(&file_path) {
                    Some(af_new) => {
                        let result = (Arc::clone(&af_new.mmap), af_new.len, af_new.content_type);
                        *guard = Some(af_new);
                        result
                    }
                    None => {
                        send_not_found(&mut stream);
                        break;
                    }
                }
            }
        };

        if file_len == 0 {
            send_not_found(&mut stream);
            break;
        }

        // Parse Range header
        let range = request
            .headers
            .get("range")
            .and_then(|v| parse_range_header(v, file_len));

        if let Some((start, mut end)) = range {
            // Cap range to MAX_RANGE_CHUNK
            if end - start + 1 > MAX_RANGE_CHUNK {
                end = start + MAX_RANGE_CHUNK - 1;
            }
            let content_length = end - start + 1;
            let data = &mmap[start as usize..=end as usize];

            let header = format!(
                "HTTP/1.1 206 Partial Content\r\n\
                 Content-Type: {content_type}\r\n\
                 Content-Range: bytes {start}-{end}/{file_len}\r\n\
                 Accept-Ranges: bytes\r\n\
                 Content-Length: {content_length}\r\n\
                 Access-Control-Allow-Origin: *\r\n\
                 Access-Control-Allow-Methods: GET, OPTIONS\r\n\
                 Access-Control-Allow-Headers: Range\r\n\
                 Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\
                 Cache-Control: private, max-age=3600, immutable\r\n\
                 Connection: keep-alive\r\n\
                 Keep-Alive: timeout=5\r\n\r\n"
            );
            if stream.write_all(header.as_bytes()).is_err() {
                break;
            }
            if stream.write_all(data).is_err() {
                break;
            }
        } else {
            // Full file response — stream in chunks to avoid huge write_all
            let header = format!(
                "HTTP/1.1 200 OK\r\n\
                 Content-Type: {content_type}\r\n\
                 Accept-Ranges: bytes\r\n\
                 Cache-Control: private, max-age=3600, immutable\r\n\
                 Access-Control-Allow-Origin: *\r\n\
                 Access-Control-Allow-Methods: GET, OPTIONS\r\n\
                 Access-Control-Allow-Headers: Range\r\n\
                 Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\
                 Content-Length: {file_len}\r\n\
                 Connection: keep-alive\r\n\
                 Keep-Alive: timeout=5\r\n\r\n"
            );
            if stream.write_all(header.as_bytes()).is_err() {
                break;
            }
            // Stream mmap data in chunks
            let data = &mmap[..];
            let mut offset = 0usize;
            while offset < data.len() {
                let chunk_end = (offset + STREAM_CHUNK_SIZE).min(data.len());
                if stream.write_all(&data[offset..chunk_end]).is_err() {
                    break;
                }
                offset = chunk_end;
            }
        }
        let _ = stream.flush();
    }
}

// --- Video path resolution ---

/// Resolves a decoded path to an absolute file path.
/// Returns `Ok(PathBuf)` on success or `Err(reason)` with a diagnostic message.
fn resolve_video_path(decoded: &str, media_root: &Path) -> Result<PathBuf, String> {
    if decoded.is_empty() {
        return Err("empty path".into());
    }
    if decoded.contains("..") {
        return Err("path traversal (..) rejected".into());
    }
    if decoded.contains('\0') {
        return Err("null byte in path".into());
    }

    let path = Path::new(decoded);

    if path.is_absolute() {
        // Absolute paths: allow any file on the filesystem (loopback-only server)
        if !path.exists() {
            return Err(format!("absolute path does not exist: '{}'", path.display()));
        }
        if !path.is_file() {
            return Err(format!("absolute path is not a file: '{}'", path.display()));
        }
        Ok(path.to_path_buf())
    } else {
        // Relative paths: resolve under media_root
        let joined = media_root.join(path);
        if !joined.exists() {
            return Err(format!(
                "relative path does not exist: '{}' (resolved to '{}')",
                decoded,
                joined.display()
            ));
        }
        if !joined.is_file() {
            return Err(format!(
                "relative path is not a file: '{}' (resolved to '{}')",
                decoded,
                joined.display()
            ));
        }
        // Security: ensure the resolved path is still under media_root
        match (joined.canonicalize(), media_root.canonicalize()) {
            (Ok(canonical_file), Ok(canonical_root)) => {
                if canonical_file.starts_with(&canonical_root) {
                    Ok(canonical_file)
                } else {
                    Err(format!(
                        "path escapes media_root (canonical='{}', root='{}')",
                        canonical_file.display(),
                        canonical_root.display()
                    ))
                }
            }
            (Err(e), _) => Err(format!("canonicalize file failed: {e}")),
            (_, Err(e)) => Err(format!("canonicalize media_root failed: {e}")),
        }
    }
}

// --- Content type detection from magic bytes ---

/// Detects the actual video container format by reading the first bytes of the
/// mmap slice. Falls back to extension-based detection if unknown.
/// This is important because yt-dlp may save MPEG-TS streams with a .mp4
/// extension, causing the browser to reject them with error code 4.
fn detect_video_content_type_from_bytes(data: &[u8], path: &Path) -> &'static str {
    if data.len() < 4 {
        return media_content_type(path);
    }

    // MPEG Transport Stream: sync byte 0x47
    if data[0] == 0x47 {
        return "video/mp2t";
    }

    // ISO BMFF / MP4 / MOV: "ftyp" at offset 4
    if data.len() >= 8 && &data[4..8] == b"ftyp" {
        return "video/mp4";
    }

    // WebM / Matroska: EBML header 0x1A45DFA3
    if data[0..4] == [0x1A, 0x45, 0xDF, 0xA3] {
        return "video/webm";
    }

    // Ogg container
    if &data[0..4] == b"OggS" {
        return "video/ogg";
    }

    // AVI: "RIFF" + "AVI "
    if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"AVI " {
        return "video/x-msvideo";
    }

    // FLV
    if data.len() >= 3 && &data[0..3] == b"FLV" {
        return "video/x-flv";
    }

    // Fall back to extension
    media_content_type(path)
}

// --- Range parsing ---

fn parse_range_header(header: &str, file_len: u64) -> Option<(u64, u64)> {
    let range_str = header.strip_prefix("bytes=")?;
    let (start_str, end_str) = range_str.split_once('-')?;

    if start_str.is_empty() {
        // Suffix range: bytes=-N (last N bytes)
        let suffix_len: u64 = end_str.parse().ok()?;
        if suffix_len == 0 || suffix_len > file_len {
            return None;
        }
        Some((file_len - suffix_len, file_len - 1))
    } else {
        let start: u64 = start_str.parse().ok()?;
        let end: u64 = if end_str.is_empty() {
            file_len.saturating_sub(1)
        } else {
            end_str.parse().ok()?
        };
        if start <= end && end < file_len {
            Some((start, end))
        } else {
            None
        }
    }
}

// --- Percent decoding ---

fn decode_percent_path(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' => {
                if i + 2 >= bytes.len() {
                    return None;
                }
                let hi = decode_hex_digit(bytes[i + 1])?;
                let lo = decode_hex_digit(bytes[i + 2])?;
                decoded.push((hi << 4) | lo);
                i += 3;
            }
            b'+' => {
                decoded.push(b' ');
                i += 1;
            }
            byte => {
                decoded.push(byte);
                i += 1;
            }
        }
    }
    String::from_utf8(decoded).ok()
}

fn decode_hex_digit(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

// --- HTTP responses ---

fn send_not_found(stream: &mut TcpStream) {
    let body = "Not Found";
    let response = format!(
        "HTTP/1.1 404 Not Found\r\n\
         Content-Type: text/plain\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn send_forbidden(stream: &mut TcpStream) {
    let body = "Forbidden";
    let response = format!(
        "HTTP/1.1 403 Forbidden\r\n\
         Content-Type: text/plain\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn send_method_not_allowed(stream: &mut TcpStream) {
    let body = "Method Not Allowed";
    let response = format!(
        "HTTP/1.1 405 Method Not Allowed\r\n\
         Content-Type: text/plain\r\n\
         Allow: GET, OPTIONS\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn send_cors_preflight(stream: &mut TcpStream) {
    let response = "HTTP/1.1 204 No Content\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, OPTIONS\r\n\
         Access-Control-Allow-Headers: Range\r\n\
         Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\
         Access-Control-Max-Age: 86400\r\n\
         Content-Length: 0\r\n\
         Connection: keep-alive\r\n\
         Keep-Alive: timeout=5\r\n\r\n";
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}
