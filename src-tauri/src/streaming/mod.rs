use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

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
        let latest_message = self
            .latest_message
            .lock()
            .ok()
            .and_then(|msg| msg.clone());
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

    pub fn connection_count(&self) -> usize {
        if let Ok(senders) = self.senders.lock() {
            senders.len()
        } else {
            0
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
    listener: Option<Arc<TcpListener>>,
    is_running: Arc<AtomicBool>,
    broadcast_enabled: Arc<AtomicBool>,
    thread_handle: Option<thread::JoinHandle<()>>,
    port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingInfo {
    pub is_running: bool,
    pub ip: Option<String>,
    pub port: u16,
    pub urls: Option<StreamingUrls>,
    pub connections: u32,
    pub broadcast_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingUrls {
    pub music: String,
    pub bible: String,
    pub return_monitor: String,
}

impl StreamingServer {
    pub fn new(port: u16) -> Self {
        Self {
            music_broadcaster: Arc::new(SseBroadcaster::new()),
            bible_broadcaster: Arc::new(SseBroadcaster::new()),
            return_broadcaster: Arc::new(SseBroadcaster::new()),
            listener: None,
            is_running: Arc::new(AtomicBool::new(false)),
            broadcast_enabled: Arc::new(AtomicBool::new(true)),
            thread_handle: None,
            port,
        }
    }

    pub fn set_broadcast_enabled(&self, enabled: bool) {
        self.broadcast_enabled.store(enabled, Ordering::SeqCst);
    }

    pub fn is_broadcast_enabled(&self) -> bool {
        self.broadcast_enabled.load(Ordering::SeqCst)
    }

    pub fn start(&mut self, port: Option<u16>) -> Result<StreamingInfo, String> {
        if self.is_running.load(Ordering::SeqCst) {
            return self.get_status();
        }

        let port = port.unwrap_or(self.port);
        self.port = port;

        let addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&addr)
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;
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
                        let running = Arc::clone(&is_running);

                        thread::spawn(move || {
                            handle_connection(stream, &music, &bible, &ret, &running);
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
        self.listener = None;

        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }

    pub fn get_status(&self) -> Result<StreamingInfo, String> {
        let running = self.is_running.load(Ordering::SeqCst);
        let ip = if running { get_local_ip() } else { None };
        let urls = ip.as_ref().map(|ip| StreamingUrls {
            music: format!("http://{}:{}/music", ip, self.port),
            bible: format!("http://{}:{}/bible", ip, self.port),
            return_monitor: format!("http://{}:{}/return", ip, self.port),
        });
        let connections = if running {
            (self.music_broadcaster.connection_count()
                + self.bible_broadcaster.connection_count()
                + self.return_broadcaster.connection_count()) as u32
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
}

// --- Connection handler ---

fn handle_connection(
    mut stream: TcpStream,
    music_bc: &Arc<SseBroadcaster>,
    bible_bc: &Arc<SseBroadcaster>,
    return_bc: &Arc<SseBroadcaster>,
    is_running: &Arc<AtomicBool>,
) {
    // Read HTTP request
    let path = match parse_request_path(&stream) {
        Some(p) => p,
        None => return,
    };

    match path.as_str() {
        "/" => serve_html(&mut stream, STATUS_HTML),
        "/music" => serve_html(&mut stream, include_str!("templates/music.html")),
        "/bible" => serve_html(&mut stream, include_str!("templates/bible.html")),
        "/return" => serve_html(&mut stream, include_str!("templates/return.html")),
        "/status" => serve_json(&mut stream, r#"{"ok":true}"#),
        "/state/music" => {
            let body = music_bc
                .latest_payload()
                .unwrap_or_else(|| r#"{"label":"","text":"","title":""}"#.to_string());
            serve_json(&mut stream, &body);
        }
        "/state/bible" => {
            let body = bible_bc
                .latest_payload()
                .unwrap_or_else(|| r#"{"reference":"","text":""}"#.to_string());
            serve_json(&mut stream, &body);
        }
        "/state/return" => {
            let body = return_bc.latest_payload().unwrap_or_else(|| {
                r#"{"current":null,"next":null,"index":0,"total":0,"title":""}"#.to_string()
            });
            serve_json(&mut stream, &body);
        }
        "/sse/music" => serve_sse(stream, music_bc, is_running),
        "/sse/bible" => serve_sse(stream, bible_bc, is_running),
        "/sse/return" => serve_sse(stream, return_bc, is_running),
        _ => serve_not_found(&mut stream),
    }
}

fn parse_request_path(stream: &TcpStream) -> Option<String> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;

    // Parse: "GET /path HTTP/1.1\r\n"
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() >= 2 {
        Some(parts[1].to_string())
    } else {
        None
    }
}

fn serve_html(stream: &mut TcpStream, html: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
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

fn serve_sse(
    mut stream: TcpStream,
    broadcaster: &Arc<SseBroadcaster>,
    is_running: &Arc<AtomicBool>,
) {
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

pub fn get_local_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|a| a.ip().to_string())
}
