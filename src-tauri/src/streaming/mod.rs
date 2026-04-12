use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Emitter};

// --- SSE Broadcaster ---

pub struct SseBroadcaster {
    senders: Mutex<HashMap<usize, Sender<String>>>,
    latest_message: Mutex<Option<String>>,
    next_id: AtomicUsize,
}

impl SseBroadcaster {
    pub fn new() -> Self {
        Self {
            senders: Mutex::new(HashMap::new()),
            latest_message: Mutex::new(None),
            next_id: AtomicUsize::new(1),
        }
    }

    pub fn subscribe(&self) -> (usize, Receiver<String>, Option<String>) {
        let (tx, rx) = mpsc::channel();
        let subscription_id = self.next_id.fetch_add(1, Ordering::Relaxed);
        if let Ok(mut senders) = self.senders.lock() {
            senders.insert(subscription_id, tx);
        }
        let latest_message = self.latest_message.lock().ok().and_then(|msg| msg.clone());
        (subscription_id, rx, latest_message)
    }

    pub fn unsubscribe(&self, subscription_id: usize) {
        if let Ok(mut senders) = self.senders.lock() {
            senders.remove(&subscription_id);
        }
    }

    pub fn broadcast(&self, data: &str) {
        let msg = format!("data: {}\n\n", data);
        if let Ok(mut latest_message) = self.latest_message.lock() {
            *latest_message = Some(msg.clone());
        }
        if let Ok(mut senders) = self.senders.lock() {
            senders.retain(|_, tx| tx.send(msg.clone()).is_ok());
        }
    }

    pub fn broadcast_transient(&self, data: &str) {
        let msg = format!("data: {}\n\n", data);
        if let Ok(mut senders) = self.senders.lock() {
            senders.retain(|_, tx| tx.send(msg.clone()).is_ok());
        }
    }

    pub fn latest_payload(&self) -> Option<String> {
        let message = self
            .latest_message
            .lock()
            .ok()
            .and_then(|msg| msg.clone())?;

        let payload = message.strip_prefix("data: ").unwrap_or(&message);
        Some(payload.trim_end_matches(['\r', '\n']).to_string())
    }

    pub fn disconnect_all(&self) {
        if let Ok(mut senders) = self.senders.lock() {
            senders.clear();
        }
    }
}

// --- Streaming Server ---

pub struct StreamingServer {
    pub music_broadcaster: Arc<SseBroadcaster>,
    pub bible_broadcaster: Arc<SseBroadcaster>,
    pub return_broadcaster: Arc<SseBroadcaster>,
    pub alert_broadcaster: Arc<SseBroadcaster>,
    pub utility_broadcaster: Arc<SseBroadcaster>,
    pub ui_broadcaster: Arc<SseBroadcaster>,
    /// Video state/control broadcaster for streaming clients.
    /// Uses `broadcast` (sticky replay) for state updates so new connections
    /// immediately receive the current video position, and `broadcast_transient`
    /// for seek/play/pause commands so they are not replayed on reconnect.
    pub video_broadcaster: Arc<SseBroadcaster>,
    latest_audio_status: Arc<Mutex<Option<String>>>,
    ui_language: Arc<Mutex<String>>,
    media_root: Arc<Mutex<Option<PathBuf>>>,
    listener: Option<Arc<TcpListener>>,
    is_running: Arc<AtomicBool>,
    broadcast_enabled: Arc<AtomicBool>,
    /// Count of live SSE clients (one per browser EventSource), independent of
    /// how many broadcasters each client is subscribed to via multiplexing.
    sse_clients: Arc<AtomicUsize>,
    /// AppHandle used by the SSE client guard to emit `streaming-status-changed`
    /// on connect/disconnect so the frontend count stays current without polling.
    app_handle: Arc<OnceLock<AppHandle>>,
    thread_handle: Option<thread::JoinHandle<()>>,
    port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StreamingInfo {
    pub is_running: bool,
    pub ip: Option<String>,
    pub port: u16,
    pub urls: Option<StreamingUrls>,
    pub connections: u32,
    pub broadcast_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StreamingUrls {
    pub music: String,
    pub bible: String,
    pub return_monitor: String,
}

impl StreamingServer {
    pub fn new(port: u16) -> Self {
        let server = Self {
            music_broadcaster: Arc::new(SseBroadcaster::new()),
            bible_broadcaster: Arc::new(SseBroadcaster::new()),
            return_broadcaster: Arc::new(SseBroadcaster::new()),
            alert_broadcaster: Arc::new(SseBroadcaster::new()),
            utility_broadcaster: Arc::new(SseBroadcaster::new()),
            ui_broadcaster: Arc::new(SseBroadcaster::new()),
            video_broadcaster: Arc::new(SseBroadcaster::new()),
            latest_audio_status: Arc::new(Mutex::new(None)),
            ui_language: Arc::new(Mutex::new("pt".to_string())),
            media_root: Arc::new(Mutex::new(None)),
            listener: None,
            is_running: Arc::new(AtomicBool::new(false)),
            broadcast_enabled: Arc::new(AtomicBool::new(true)),
            sse_clients: Arc::new(AtomicUsize::new(0)),
            app_handle: Arc::new(OnceLock::new()),
            thread_handle: None,
            port,
        };
        server.set_ui_language("pt");
        server
    }

    pub fn set_broadcast_enabled(&self, enabled: bool) {
        self.broadcast_enabled.store(enabled, Ordering::SeqCst);
    }

    /// Registers the Tauri AppHandle used to emit `streaming-status-changed`
    /// whenever an SSE client connects or disconnects. Safe to call multiple
    /// times — only the first value is retained (OnceLock semantics).
    pub fn set_app_handle(&self, app: AppHandle) {
        let _ = self.app_handle.set(app);
    }

    pub fn set_ui_language(&self, language: &str) {
        let normalized = normalize_language(language).to_string();
        if let Ok(mut current) = self.ui_language.lock() {
            *current = normalized;
        }
        let payload = serde_json::json!({
            "language": normalize_language(language),
        });
        self.ui_broadcaster.broadcast(&payload.to_string());
    }

    pub fn set_media_root(&self, media_root: PathBuf) {
        let resolved_root = media_root.canonicalize().unwrap_or(media_root);
        if let Ok(mut root) = self.media_root.lock() {
            *root = Some(resolved_root);
        }
    }

    pub fn start(&mut self, port: Option<u16>) -> Result<StreamingInfo, String> {
        if self.is_running.load(Ordering::SeqCst) {
            return self.get_status();
        }

        let requested_port = port.unwrap_or(self.port);

        let addr = format!("0.0.0.0:{}", requested_port);
        let listener =
            TcpListener::bind(&addr).map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        // When port=0 the OS picks a free port — read the actual assigned port.
        let actual_port = listener
            .local_addr()
            .map(|a| a.port())
            .unwrap_or(requested_port);
        self.port = actual_port;
        // Non-blocking so our loop can check is_running
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to set non-blocking: {}", e))?;

        let listener = Arc::new(listener);
        self.listener = Some(Arc::clone(&listener));
        self.is_running.store(true, Ordering::SeqCst);

        let is_running = Arc::clone(&self.is_running);
        let music_bc = Arc::clone(&self.music_broadcaster);
        let bible_bc = Arc::clone(&self.bible_broadcaster);
        let return_bc = Arc::clone(&self.return_broadcaster);
        let alert_bc = Arc::clone(&self.alert_broadcaster);
        let utility_bc = Arc::clone(&self.utility_broadcaster);
        let ui_bc = Arc::clone(&self.ui_broadcaster);
        let video_bc = Arc::clone(&self.video_broadcaster);
        let latest_audio_status = Arc::clone(&self.latest_audio_status);
        let ui_language = Arc::clone(&self.ui_language);
        let media_root = Arc::clone(&self.media_root);
        let sse_clients = Arc::clone(&self.sse_clients);
        let app_handle = Arc::clone(&self.app_handle);

        self.thread_handle = Some(thread::spawn(move || {
            while is_running.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((stream, _addr)) => {
                        // Set blocking mode for this connection
                        let _ = stream.set_nonblocking(false);
                        let _ = stream.set_nodelay(true);

                        let music = Arc::clone(&music_bc);
                        let bible = Arc::clone(&bible_bc);
                        let ret = Arc::clone(&return_bc);
                        let alert = Arc::clone(&alert_bc);
                        let utility = Arc::clone(&utility_bc);
                        let ui = Arc::clone(&ui_bc);
                        let video = Arc::clone(&video_bc);
                        let running = Arc::clone(&is_running);
                        let language = Arc::clone(&ui_language);
                        let media_root_for_connection = Arc::clone(&media_root);
                        let latest_audio_status_for_connection =
                            Arc::clone(&latest_audio_status);
                        let sse_clients_for_connection = Arc::clone(&sse_clients);
                        let app_handle_for_connection = Arc::clone(&app_handle);

                        thread::spawn(move || {
                            let context = ConnectionContext {
                                music_bc: &music,
                                bible_bc: &bible,
                                return_bc: &ret,
                                alert_bc: &alert,
                                utility_bc: &utility,
                                ui_bc: &ui,
                                video_bc: &video,
                                latest_audio_status: &latest_audio_status_for_connection,
                                ui_language: &language,
                                media_root: &media_root_for_connection,
                                is_running: &running,
                                sse_clients: &sse_clients_for_connection,
                                app_handle: &app_handle_for_connection,
                            };
                            handle_connection(stream, &context);
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No pending connection, sleep briefly and retry
                        thread::sleep(Duration::from_millis(50));
                    }
                    Err(_) => {
                        break;
                    }
                }
            }
        }));

        self.get_status()
    }

    pub fn stop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        self.music_broadcaster.disconnect_all();
        self.bible_broadcaster.disconnect_all();
        self.return_broadcaster.disconnect_all();
        self.alert_broadcaster.disconnect_all();
        self.utility_broadcaster.disconnect_all();
        self.ui_broadcaster.disconnect_all();
        self.video_broadcaster.disconnect_all();
        self.listener = None;

        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }

    pub fn get_status(&self) -> Result<StreamingInfo, String> {
        let running = self.is_running.load(Ordering::SeqCst);
        #[allow(deprecated)]
        let ip = if running { get_local_ip() } else { None };
        let urls = ip.as_ref().map(|ip| StreamingUrls {
            music: format!("http://{}:{}/music", ip, self.port),
            bible: format!("http://{}:{}/bible", ip, self.port),
            return_monitor: format!("http://{}:{}/return", ip, self.port),
        });
        let connections = if running {
            self.sse_clients.load(Ordering::SeqCst) as u32
        } else {
            0
        };

        Ok(StreamingInfo {
            is_running: running,
            ip,
            port: self.port,
            urls,
            connections,
            broadcast_enabled: self.broadcast_enabled.load(Ordering::SeqCst),
        })
    }

    pub fn broadcast_music(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.music_broadcaster.broadcast(data);
        }
    }

    pub fn broadcast_music_transient(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.music_broadcaster.broadcast_transient(data);
        }
    }

    pub fn broadcast_bible(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.bible_broadcaster.broadcast(data);
        }
    }

    pub fn broadcast_return(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.return_broadcaster.broadcast(data);
        }
    }

    pub fn broadcast_return_transient(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.return_broadcaster.broadcast_transient(data);
        }
    }

    pub fn broadcast_alert(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.alert_broadcaster.broadcast(data);
        }
    }

    pub fn broadcast_utility(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.utility_broadcaster.broadcast(data);
        }
    }

    pub fn set_audio_status(&self, data: &str) {
        if let Ok(mut latest_audio_status) = self.latest_audio_status.lock() {
            *latest_audio_status = Some(data.to_string());
        }
    }

    /// Broadcast a sticky video state snapshot (replayed to new connections).
    /// Used for play/pause/currentTime/duration updates so late-joining clients
    /// immediately sync to the current position.
    pub fn broadcast_video_state(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.video_broadcaster.broadcast(data);
        }
    }

    /// Broadcast a transient video command (NOT replayed to new connections).
    /// Used for seek commands where replaying old positions would be wrong.
    pub fn broadcast_video_cmd(&self, data: &str) {
        if self.is_running.load(Ordering::SeqCst) && self.broadcast_enabled.load(Ordering::SeqCst) {
            self.video_broadcaster.broadcast_transient(data);
        }
    }
}

// --- Connection handler ---

struct ConnectionContext<'a> {
    music_bc: &'a Arc<SseBroadcaster>,
    bible_bc: &'a Arc<SseBroadcaster>,
    return_bc: &'a Arc<SseBroadcaster>,
    alert_bc: &'a Arc<SseBroadcaster>,
    utility_bc: &'a Arc<SseBroadcaster>,
    ui_bc: &'a Arc<SseBroadcaster>,
    video_bc: &'a Arc<SseBroadcaster>,
    latest_audio_status: &'a Arc<Mutex<Option<String>>>,
    ui_language: &'a Arc<Mutex<String>>,
    media_root: &'a Arc<Mutex<Option<PathBuf>>>,
    is_running: &'a Arc<AtomicBool>,
    sse_clients: &'a Arc<AtomicUsize>,
    app_handle: &'a Arc<OnceLock<AppHandle>>,
}

fn handle_connection(mut stream: TcpStream, context: &ConnectionContext<'_>) {
    // Read HTTP request (path + headers)
    let request = match parse_http_request(&stream) {
        Some(r) => r,
        None => return,
    };

    match request.path.as_str() {
        "/" => serve_html(&mut stream, STATUS_HTML),
        "/music" => serve_html(&mut stream, include_str!("templates/music.html")),
        "/bible" => serve_html(&mut stream, include_str!("templates/bible.html")),
        "/return" => serve_html(&mut stream, include_str!("templates/return.html")),
        "/status" => serve_json(&mut stream, r#"{"ok":true}"#),
        "/state/music" => {
            let body = context
                .music_bc
                .latest_payload()
                .unwrap_or_else(|| {
                    r#"{"slideType":"","videoPath":"","label":"","text":"","title":"","subtitle":"","backgroundImage":"","backgroundColor":"","textColor":"","textSize":0,"audioPath":""}"#
                        .to_string()
                });
            serve_json(&mut stream, &body);
        }
        "/state/bible" => {
            let body = context
                .bible_bc
                .latest_payload()
                .unwrap_or_else(|| r#"{"reference":"","text":""}"#.to_string());
            serve_json(&mut stream, &body);
        }
        "/state/return" => {
            let body = context.return_bc.latest_payload().unwrap_or_else(|| {
                r#"{"current":null,"next":null,"index":0,"total":0,"title":""}"#.to_string()
            });
            serve_json(&mut stream, &body);
        }
        "/state/alert" => {
            let body = context.alert_bc.latest_payload().unwrap_or_else(|| {
                r#"{"text":"","isVisible":false,"isTicker":false}"#.to_string()
            });
            serve_json(&mut stream, &body);
        }
        "/state/utility" => {
            let body = context.utility_bc.latest_payload().unwrap_or_else(|| {
                r#"{"phase":"stop","sessionId":"","kind":"","valueMs":0,"use24Hour":true,"showDate":false}"#
                    .to_string()
            });
            serve_json(&mut stream, &body);
        }
        "/state/audio" => {
            let body = context
                .latest_audio_status
                .lock()
                .ok()
                .and_then(|value| value.clone())
                .unwrap_or_else(|| {
                    r#"{"positionMs":0,"durationMs":0,"isPlaying":false,"isPaused":false,"volume":1,"currentFile":null}"#
                        .to_string()
                });
            serve_json(&mut stream, &body);
        }
        "/state/ui" => {
            let body = context.ui_bc.latest_payload().unwrap_or_else(|| {
                let language = context
                    .ui_language
                    .lock()
                    .map(|value| normalize_language(&value).to_string())
                    .unwrap_or_else(|_| "pt".to_string());
                serde_json::json!({ "language": language }).to_string()
            });
            serve_json(&mut stream, &body);
        }
        "/sse/music" => serve_sse(stream, context.music_bc, context.is_running, context.sse_clients, context.app_handle),
        "/sse/bible" => serve_sse(stream, context.bible_bc, context.is_running, context.sse_clients, context.app_handle),
        "/sse/return" => serve_sse(stream, context.return_bc, context.is_running, context.sse_clients, context.app_handle),
        "/sse/alert" => serve_sse(stream, context.alert_bc, context.is_running, context.sse_clients, context.app_handle),
        "/sse/utility" => serve_sse(stream, context.utility_bc, context.is_running, context.sse_clients, context.app_handle),
        "/sse/ui" => serve_sse(stream, context.ui_bc, context.is_running, context.sse_clients, context.app_handle),
        "/sse/video" => serve_sse(stream, context.video_bc, context.is_running, context.sse_clients, context.app_handle),
        // Multiplexed SSE endpoints — one connection carries multiple named event
        // streams so a single browser tab opens 1 persistent connection instead of 3.
        // Chrome caps HTTP/1.1 at 6 connections per origin, so without this a /music
        // tab + /return tab (3 SSE each) saturates the pool and new requests like
        // background image fetches sit pending forever.
        "/sse/combined/music" => serve_sse_multi(
            stream,
            &[
                ("music", context.music_bc),
                ("alert", context.alert_bc),
                ("video", context.video_bc),
            ],
            context.is_running,
            context.sse_clients,
            context.app_handle,
        ),
        "/sse/combined/return" => serve_sse_multi(
            stream,
            &[
                ("return", context.return_bc),
                ("alert", context.alert_bc),
                ("video", context.video_bc),
            ],
            context.is_running,
            context.sse_clients,
            context.app_handle,
        ),
        "/state/video" => {
            let body = context.video_bc.latest_payload().unwrap_or_else(|| {
                r#"{"type":"state","paused":true,"currentTime":0,"duration":0,"volume":1,"videoId":null,"videoSource":null}"#
                    .to_string()
            });
            serve_json(&mut stream, &body);
        }
        _ if request.path.starts_with("/media/") => {
            serve_media(stream, &request.path, &request.headers, context.media_root)
        }
        _ => serve_not_found(&mut stream),
    }
}

struct HttpRequest {
    path: String,
    headers: HashMap<String, String>,
}

fn parse_http_request(stream: &TcpStream) -> Option<HttpRequest> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;

    // Parse: "GET /path HTTP/1.1\r\n"
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    let path = parts.get(1)?.to_string();

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

    Some(HttpRequest { path, headers })
}

fn serve_html(stream: &mut TcpStream, html: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-cache, no-store, must-revalidate\r\nPragma: no-cache\r\nExpires: 0\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn serve_json(stream: &mut TcpStream, json: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-cache, no-store, must-revalidate\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        json.len(),
        json
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

/// RAII guard: increments the SSE client counter on creation and decrements on
/// drop so the counter reflects live EventSource connections regardless of the
/// exit path (graceful disconnect, write error, shutdown).
struct SseClientGuard {
    counter: Arc<AtomicUsize>,
    app_handle: Arc<OnceLock<AppHandle>>,
}

impl SseClientGuard {
    fn new(counter: &Arc<AtomicUsize>, app_handle: &Arc<OnceLock<AppHandle>>) -> Self {
        counter.fetch_add(1, Ordering::SeqCst);
        if let Some(app) = app_handle.get() {
            let _ = app.emit("streaming-status-changed", ());
        }
        Self {
            counter: Arc::clone(counter),
            app_handle: Arc::clone(app_handle),
        }
    }
}

impl Drop for SseClientGuard {
    fn drop(&mut self) {
        self.counter.fetch_sub(1, Ordering::SeqCst);
        if let Some(app) = self.app_handle.get() {
            let _ = app.emit("streaming-status-changed", ());
        }
    }
}

fn serve_sse(
    mut stream: TcpStream,
    broadcaster: &Arc<SseBroadcaster>,
    is_running: &Arc<AtomicBool>,
    sse_clients: &Arc<AtomicUsize>,
    app_handle: &Arc<OnceLock<AppHandle>>,
) {
    let _client_guard = SseClientGuard::new(sse_clients, app_handle);
    const SSE_HEARTBEAT_INTERVAL_SECS: u64 = 5;

    // Write SSE headers
    let headers = "HTTP/1.1 200 OK\r\n\
        Content-Type: text/event-stream; charset=utf-8\r\n\
        Cache-Control: no-cache\r\n\
        Connection: keep-alive\r\n\
        Access-Control-Allow-Origin: *\r\n\
        \r\n";

    if stream.write_all(headers.as_bytes()).is_err() {
        return;
    }
    if stream.flush().is_err() {
        return;
    }

    // Subscribe to the broadcaster and immediately replay latest payload.
    let (subscription_id, rx, latest_message) = broadcaster.subscribe();
    if let Some(initial_message) = latest_message {
        if stream.write_all(initial_message.as_bytes()).is_err() {
            broadcaster.unsubscribe(subscription_id);
            return;
        }
        if stream.flush().is_err() {
            broadcaster.unsubscribe(subscription_id);
            return;
        }
    }

    // Track remote socket closure independently from write heartbeats.
    // Browsers send FIN on tab close; a blocking read returns 0 immediately.
    let disconnected = Arc::new(AtomicBool::new(false));
    if let Ok(mut read_stream) = stream.try_clone() {
        let disconnect_flag = Arc::clone(&disconnected);
        let _ = read_stream.set_read_timeout(Some(Duration::from_secs(1)));
        thread::spawn(move || {
            let mut buf = [0_u8; 1];
            loop {
                match read_stream.read(&mut buf) {
                    Ok(0) => {
                        disconnect_flag.store(true, Ordering::SeqCst);
                        break;
                    }
                    Ok(_) => {
                        // Ignore any unexpected payload and keep waiting for close.
                    }
                    Err(ref e)
                        if matches!(
                            e.kind(),
                            std::io::ErrorKind::WouldBlock
                                | std::io::ErrorKind::TimedOut
                                | std::io::ErrorKind::Interrupted
                        ) => {}
                    Err(_) => {
                        disconnect_flag.store(true, Ordering::SeqCst);
                        break;
                    }
                }
            }
        });
    }

    // Set a read timeout so we can send heartbeats
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    // Event loop: receive messages and write directly to socket with flush
    while is_running.load(Ordering::SeqCst) && !disconnected.load(Ordering::SeqCst) {
        match rx.recv_timeout(Duration::from_secs(SSE_HEARTBEAT_INTERVAL_SECS)) {
            Ok(msg) => {
                // msg is already formatted as "data: {...}\n\n"
                if stream.write_all(msg.as_bytes()).is_err() {
                    break; // Client disconnected
                }
                if stream.flush().is_err() {
                    break; // Client disconnected
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Send heartbeat to keep connection alive and detect disconnects
                let heartbeat = format!(": heartbeat {}\n\n", chrono::Utc::now().timestamp());
                if stream.write_all(heartbeat.as_bytes()).is_err() {
                    break;
                }
                if stream.flush().is_err() {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                break; // Broadcaster dropped
            }
        }
    }

    // Ensure connection count is decremented immediately on disconnect.
    broadcaster.unsubscribe(subscription_id);
}

/// Serve multiple SSE streams multiplexed over a single connection using named
/// events (`event: <name>\ndata: ...`). Each underlying broadcaster is subscribed
/// to and its payloads are forwarded to a shared channel tagged with the stream
/// name. The client uses `addEventListener(name, ...)` to dispatch by stream.
fn serve_sse_multi(
    mut stream: TcpStream,
    streams: &[(&str, &Arc<SseBroadcaster>)],
    is_running: &Arc<AtomicBool>,
    sse_clients: &Arc<AtomicUsize>,
    app_handle: &Arc<OnceLock<AppHandle>>,
) {
    let _client_guard = SseClientGuard::new(sse_clients, app_handle);
    const SSE_HEARTBEAT_INTERVAL_SECS: u64 = 5;

    let headers = "HTTP/1.1 200 OK\r\n\
        Content-Type: text/event-stream; charset=utf-8\r\n\
        Cache-Control: no-cache\r\n\
        Connection: keep-alive\r\n\
        Access-Control-Allow-Origin: *\r\n\
        \r\n";

    if stream.write_all(headers.as_bytes()).is_err() {
        return;
    }
    if stream.flush().is_err() {
        return;
    }

    let (out_tx, out_rx) = mpsc::channel::<String>();
    let mut subs: Vec<(Arc<SseBroadcaster>, usize)> = Vec::with_capacity(streams.len());

    for (name, broadcaster) in streams {
        let event_name = name.to_string();
        let (subscription_id, rx, latest_message) = broadcaster.subscribe();
        subs.push((Arc::clone(broadcaster), subscription_id));

        // Replay the latest payload immediately so late-joining clients get the
        // current state without waiting for the next broadcast.
        if let Some(raw) = latest_message {
            let payload = raw
                .strip_prefix("data: ")
                .unwrap_or(&raw)
                .trim_end_matches(['\r', '\n']);
            let tagged = format!("event: {}\ndata: {}\n\n", event_name, payload);
            if stream.write_all(tagged.as_bytes()).is_err() {
                for (bc, id) in subs {
                    bc.unsubscribe(id);
                }
                return;
            }
        }

        // Forwarder thread: tag each broadcast with the event name and push to
        // the shared channel. Exits cleanly when the broadcaster drops its tx
        // (i.e. on unsubscribe) — rx.recv() returns Err at that point.
        let tx = out_tx.clone();
        thread::spawn(move || {
            while let Ok(raw) = rx.recv() {
                let payload = raw
                    .strip_prefix("data: ")
                    .unwrap_or(&raw)
                    .trim_end_matches(['\r', '\n'])
                    .to_string();
                let tagged = format!("event: {}\ndata: {}\n\n", event_name, payload);
                if tx.send(tagged).is_err() {
                    break;
                }
            }
        });
    }
    // Drop the original tx so out_rx returns Disconnected once all forwarders exit.
    drop(out_tx);

    let _ = stream.flush();

    // Track remote socket closure (same pattern as serve_sse).
    let disconnected = Arc::new(AtomicBool::new(false));
    if let Ok(mut read_stream) = stream.try_clone() {
        let flag = Arc::clone(&disconnected);
        let _ = read_stream.set_read_timeout(Some(Duration::from_secs(1)));
        thread::spawn(move || {
            let mut buf = [0_u8; 1];
            loop {
                match read_stream.read(&mut buf) {
                    Ok(0) => {
                        flag.store(true, Ordering::SeqCst);
                        break;
                    }
                    Ok(_) => {}
                    Err(ref e)
                        if matches!(
                            e.kind(),
                            std::io::ErrorKind::WouldBlock
                                | std::io::ErrorKind::TimedOut
                                | std::io::ErrorKind::Interrupted
                        ) => {}
                    Err(_) => {
                        flag.store(true, Ordering::SeqCst);
                        break;
                    }
                }
            }
        });
    }

    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    while is_running.load(Ordering::SeqCst) && !disconnected.load(Ordering::SeqCst) {
        match out_rx.recv_timeout(Duration::from_secs(SSE_HEARTBEAT_INTERVAL_SECS)) {
            Ok(msg) => {
                if stream.write_all(msg.as_bytes()).is_err() {
                    break;
                }
                if stream.flush().is_err() {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let heartbeat = format!(": heartbeat {}\n\n", chrono::Utc::now().timestamp());
                if stream.write_all(heartbeat.as_bytes()).is_err() {
                    break;
                }
                if stream.flush().is_err() {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    for (bc, id) in subs {
        bc.unsubscribe(id);
    }
}

/// Resolve a percent-decoded media path to a file to serve.
/// Absolute paths are read directly (user-selected files, full OS access).
/// Relative paths are resolved against `media_root` and validated to stay inside it.
/// Returns `None` if the path is invalid, suspicious, or does not exist as a file.
pub(crate) fn resolve_serve_path(decoded: &str, media_root: &std::path::Path) -> Option<std::path::PathBuf> {
    if decoded.is_empty() || decoded.contains("..") || decoded.contains('\0') {
        return None;
    }
    let path = std::path::Path::new(decoded);
    if path.is_absolute() {
        let canonical = path.canonicalize().ok()?;
        if canonical.is_file() { Some(canonical) } else { None }
    } else {
        let canonical_root = media_root.canonicalize().ok()?;
        let joined = canonical_root.join(path);
        let canonical = joined.canonicalize().ok()?;
        if canonical.starts_with(&canonical_root) && canonical.is_file() {
            Some(canonical)
        } else {
            None
        }
    }
}

fn serve_media(
    mut stream: TcpStream,
    request_path: &str,
    headers: &HashMap<String, String>,
    media_root: &Arc<Mutex<Option<PathBuf>>>,
) {
    let root = media_root.lock().ok().and_then(|value| value.clone());
    let Some(root) = root else {
        serve_not_found(&mut stream);
        return;
    };

    let sanitized_path = request_path
        .split(['?', '#'])
        .next()
        .unwrap_or(request_path);
    let encoded_relative = sanitized_path.strip_prefix("/media/").unwrap_or("");
    let Some(decoded_relative) = decode_percent_path(encoded_relative) else {
        serve_not_found(&mut stream);
        return;
    };

    // Normalize Windows backslashes; resolve via helper (handles absolute/relative branching)
    let decoded = decoded_relative.replace('\\', "/");
    let Some(candidate) = resolve_serve_path(&decoded, &root) else {
        serve_not_found(&mut stream);
        return;
    };
    // candidate is already canonical — proceed to serve

    // Stream in 64 KB chunks — loading the entire file into RAM would allocate
    // hundreds of MB per concurrent request for large video files.
    let mut file = match std::fs::File::open(&candidate) {
        Ok(f) => f,
        Err(_) => {
            serve_not_found(&mut stream);
            return;
        }
    };
    let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let content_type = media_content_type(&candidate);

    // Parse Range header for partial content (enables video seeking on external browsers).
    let range = headers
        .get("range")
        .and_then(|v| parse_range_header(v, file_len));

    if let Some((start, end)) = range {
        let content_length = end - start + 1;
        if file.seek(SeekFrom::Start(start)).is_err() {
            serve_not_found(&mut stream);
            return;
        }
        let header = format!(
            "HTTP/1.1 206 Partial Content\r\n\
             Content-Type: {}\r\n\
             Content-Range: bytes {}-{}/{}\r\n\
             Accept-Ranges: bytes\r\n\
             Content-Length: {}\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Connection: close\r\n\r\n",
            content_type, start, end, file_len, content_length
        );
        if stream.write_all(header.as_bytes()).is_err() {
            return;
        }
        stream_bytes(&mut file, &mut stream, content_length);
    } else {
        let header = format!(
            "HTTP/1.1 200 OK\r\n\
             Content-Type: {}\r\n\
             Accept-Ranges: bytes\r\n\
             Cache-Control: no-cache\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Content-Length: {}\r\n\
             Connection: close\r\n\r\n",
            content_type, file_len
        );
        if stream.write_all(header.as_bytes()).is_err() {
            return;
        }
        stream_bytes(&mut file, &mut stream, file_len);
    }
    let _ = stream.flush();
}

/// Parse an HTTP Range header value like "bytes=0-1023" or "bytes=500-".
fn parse_range_header(header: &str, file_len: u64) -> Option<(u64, u64)> {
    let range_str = header.strip_prefix("bytes=")?;
    let (start_str, end_str) = range_str.split_once('-')?;
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

/// Stream exactly `limit` bytes from reader to writer in 64 KB chunks.
fn stream_bytes(reader: &mut std::fs::File, writer: &mut TcpStream, limit: u64) {
    let mut remaining = limit;
    let mut buf = [0u8; 65_536];
    while remaining > 0 {
        let to_read = (remaining as usize).min(buf.len());
        let n = match std::io::Read::read(reader, &mut buf[..to_read]) {
            Ok(n) => n,
            Err(_) => break,
        };
        if n == 0 {
            break;
        }
        if writer.write_all(&buf[..n]).is_err() {
            break;
        }
        remaining -= n as u64;
    }
}

pub(crate) fn media_content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("avif") => "image/avif",
        Some("tif") | Some("tiff") => "image/tiff",
        Some("ico") => "image/x-icon",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mov") => "video/quicktime",
        Some("m4v") => "video/x-m4v",
        Some("ogv") => "video/ogg",
        Some("3gp") => "video/3gpp",
        Some("avi") => "video/x-msvideo",
        Some("mkv") => "video/x-matroska",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("ogg") => "audio/ogg",
        Some("flac") => "audio/flac",
        Some("aac") => "audio/aac",
        _ => "application/octet-stream",
    }
}

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

fn serve_not_found(stream: &mut TcpStream) {
    let body = "Not Found";
    let response = format!(
        "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

const STATUS_HTML: &str = r#"<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LouvorJA Streaming</title>
<style>body{font-family:sans-serif;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
a{color:#60a5fa;text-decoration:none;display:block;margin:0.5rem}a:hover{text-decoration:underline}h1{margin-bottom:1rem}</style></head>
<body><div><h1>LouvorJA Streaming Server</h1>
<a href="/music">Music / Lyrics</a><a href="/bible">Bible</a><a href="/return">Return Monitor</a></div></body></html>"#;

// --- Local IP detection ---

#[deprecated(note = "use crate::net::get_lan_ip")]
pub fn get_local_ip() -> Option<String> {
    crate::net::get_lan_ip()
}

fn normalize_language(value: &str) -> &'static str {
    match value.trim().to_ascii_lowercase().as_str() {
        "en" => "en",
        "es" => "es",
        _ => "pt",
    }
}

#[cfg(test)]
mod serve_path_tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn test_relative_path_resolves_inside_root() {
        let dir = setup();
        let file = dir.path().join("media/videos/test.mp4");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, b"fake").unwrap();
        let result = resolve_serve_path("media/videos/test.mp4", dir.path());
        assert!(result.is_some());
    }

    #[test]
    fn test_absolute_path_resolves_outside_root() {
        let dir = setup();
        let outside = tempfile::tempdir().unwrap();
        let file = outside.path().join("bg.jpg");
        fs::write(&file, b"fake").unwrap();
        let abs = file.to_str().unwrap();
        let result = resolve_serve_path(abs, dir.path());
        assert!(result.is_some());
    }

    #[test]
    fn test_traversal_rejected() {
        let dir = setup();
        assert!(resolve_serve_path("../etc/passwd", dir.path()).is_none());
        assert!(resolve_serve_path("media/../../etc/passwd", dir.path()).is_none());
    }

    #[test]
    fn test_null_byte_rejected() {
        let dir = setup();
        assert!(resolve_serve_path("media/file\0.jpg", dir.path()).is_none());
    }

    #[test]
    fn test_empty_path_rejected() {
        let dir = setup();
        assert!(resolve_serve_path("", dir.path()).is_none());
    }

    #[test]
    fn test_nonexistent_absolute_returns_none() {
        let dir = setup();
        assert!(resolve_serve_path("/tmp/nonexistent_louvorja_test_file_xyz123.jpg", dir.path()).is_none());
    }

    #[test]
    #[allow(deprecated)]
    fn streaming_module_exports_same_fn_behavior() {
        // Both must agree: get_local_ip() (legacy) and crate::net::get_lan_ip() (new).
        let a = super::get_local_ip();
        let b = crate::net::get_lan_ip();
        assert_eq!(a, b);
    }
}
