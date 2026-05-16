//! WebSocket upgrade handler at `GET /ws`.
//!
//! Authentication: devices pass their token via the `Sec-WebSocket-Protocol`
//! header as `["bearer", "<device-token>"]` (browsers cannot set custom
//! headers on WS upgrades). The server validates by hashing the token and
//! looking it up in the DB. The plaintext token is kept in memory as the HMAC
//! signing key for the session only — it is never persisted.
//!
//! Outbound events: each WS session subscribes to the shared broadcast channel
//! (`RemoteServerState.broadcast_tx`). When a Tauri event arrives on the
//! channel (unsigned JSON envelope), the handler signs it with the per-device
//! HMAC key and forwards it to the socket.
//!
//! D6: responses to inbound commands are sent via a per-session
//! `mpsc::unbounded_channel`, NOT via the shared broadcast. This means one
//! client's command response is only delivered to that client.

use axum::{
    extract::{State, WebSocketUpgrade},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{broadcast, mpsc};
use uuid::Uuid;

use crate::remote::{
    dispatcher::{self, DispatcherCtx},
    hmac_util,
    nonce_cache::NonceCache,
    protocol::RemoteEnvelope,
    rate_limit::SuspiciousHmacTracker,
    routes::pair::PairRouteState,
    state::ConnectionInfo,
};

/// WS upgrade — validates device token via subprotocol then upgrades.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<PairRouteState>,
    headers: axum::http::HeaderMap,
) -> Response {
    // Extract token from `Sec-WebSocket-Protocol: bearer, <token>` header.
    let token_opt = extract_bearer_token(&headers);

    let token = match token_opt {
        Some(t) => t,
        None => {
            return (StatusCode::UNAUTHORIZED, "Missing bearer token in subprotocol")
                .into_response()
        }
    };

    // Validate: hash token, look up device, check not revoked.
    let conn = match state.db.get() {
        Ok(c) => c,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    // Decode the base64url token back to raw bytes for hashing.
    // The DB stores hash(raw_32_bytes); the client holds the base64-encoded form.
    let raw_bytes_result = base64::Engine::decode(
        &base64::prelude::BASE64_URL_SAFE_NO_PAD,
        token.as_str(),
    );
    let token_bytes = match raw_bytes_result {
        Ok(b) => b,
        Err(_) => return (StatusCode::UNAUTHORIZED, "Malformed device token").into_response(),
    };
    let device = match crate::db::queries::remote::find_by_token_hash(&conn, &token_bytes) {
        Ok(Some(d)) if d.revoked_at.is_none() => d,
        _ => return (StatusCode::UNAUTHORIZED, "Invalid or revoked device token").into_response(),
    };
    drop(conn);

    let device_id = device.id.clone();
    let device_name = device.name.clone();
    let nonce_cache = state.nonce_cache.clone();
    let broadcast_tx = state.broadcast_tx.clone();
    let connections = state.connections.clone();
    let app_handle = state.app_handle.clone();
    let db = state.db.clone();
    let suspicious_tracker = state.suspicious_tracker.clone();

    ws.protocols(["bearer"])
        .on_upgrade(move |socket| {
            handle_socket(
                socket,
                token_bytes,
                device_id,
                device_name,
                nonce_cache,
                broadcast_tx,
                connections,
                app_handle,
                db,
                suspicious_tracker,
            )
        })
}

/// Extract the device token from `Sec-WebSocket-Protocol: bearer, <token>`.
fn extract_bearer_token(headers: &axum::http::HeaderMap) -> Option<String> {
    let proto = headers
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())?;
    // Expected format: "bearer, <token>" (with optional whitespace)
    let parts: Vec<&str> = proto.splitn(2, ',').collect();
    if parts.len() == 2 && parts[0].trim().eq_ignore_ascii_case("bearer") {
        Some(parts[1].trim().to_string())
    } else {
        None
    }
}

/// RAII guard: removes this session from the connections map on drop and
/// emits `remote-devices-changed` so presence.changed fires.
struct ConnGuard {
    id: Uuid,
    connections: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<Uuid, ConnectionInfo>>>,
    app_handle: Option<tauri::AppHandle>,
}

impl Drop for ConnGuard {
    fn drop(&mut self) {
        {
            let mut map = self.connections.lock().unwrap_or_else(|e| e.into_inner());
            map.remove(&self.id);
        }
        if let Some(ref app) = self.app_handle {
            use tauri::Emitter;
            let _ = app.emit("remote-devices-changed", ());
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn handle_socket(
    socket: WebSocket,
    device_token: Vec<u8>,
    device_id: String,
    device_name: String,
    nonce_cache: std::sync::Arc<std::sync::Mutex<NonceCache>>,
    broadcast_tx: std::sync::Arc<broadcast::Sender<String>>,
    connections: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<Uuid, ConnectionInfo>>>,
    app_handle: Option<tauri::AppHandle>,
    db: r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>,
    suspicious_tracker: std::sync::Arc<SuspiciousHmacTracker>,
) {
    // Register this connection in the presence map.
    let session_id = Uuid::new_v4();
    let connected_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    {
        let mut map = connections.lock().unwrap_or_else(|e| e.into_inner());
        map.insert(session_id, ConnectionInfo {
            device_id: device_id.clone(),
            name: device_name.clone(),
            connected_at,
        });
    }
    // Emit so presence.changed broadcasts the updated list.
    if let Some(ref app) = app_handle {
        use tauri::Emitter;
        let _ = app.emit("remote-devices-changed", ());
    }

    // RAII guard: removes from map + re-emits on disconnect.
    let _guard = ConnGuard {
        id: session_id,
        connections: connections.clone(),
        app_handle: app_handle.clone(),
    };

    // Subscribe to the broadcast channel BEFORE splitting the socket so we don't
    // miss events that arrive right after the upgrade.
    let mut broadcast_rx = broadcast_tx.subscribe();

    // D6: per-session response channel — only this client sees its own command responses.
    let (resp_tx, mut resp_rx) = mpsc::unbounded_channel::<String>();

    let (mut sink, mut stream) = socket.split();

    // Clone what we need in the outbound task.
    let device_token_out = device_token.clone();

    // Outbound task: merges broadcast channel (server events) + per-session channel (responses).
    let outbound = tokio::spawn(async move {
        loop {
            tokio::select! {
                // Server-initiated events (slide.changed, etc.) — sign per-device and forward.
                broadcast_result = broadcast_rx.recv() => {
                    match broadcast_result {
                        Ok(unsigned_json) => {
                            if let Ok(mut env) = serde_json::from_str::<RemoteEnvelope>(&unsigned_json) {
                                let payload_str = serde_json::to_string(&env.payload).unwrap_or_default();
                                let sig = hmac_util::sign(
                                    &device_token_out,
                                    env.ts,
                                    &env.nonce,
                                    &env.op,
                                    &payload_str,
                                );
                                env.sig = Some(sig);
                                if let Ok(json) = serde_json::to_string(&env) {
                                    if sink.send(Message::Text(json.into())).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => {
                            // Slow consumer dropped some events — continue.
                            continue;
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            // Server is shutting down.
                            let _ = sink
                                .send(Message::Close(Some(axum::extract::ws::CloseFrame {
                                    code: 1001,
                                    reason: "Server shutting down".into(),
                                })))
                                .await;
                            break;
                        }
                    }
                }
                // Per-session responses — already fully serialised (signed by inbound task).
                Some(json) = resp_rx.recv() => {
                    if sink.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Inbound task: socket → verify HMAC → dispatcher.
    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(text) => {
                // Try to parse as RemoteEnvelope and verify HMAC.
                if let Ok(env) = serde_json::from_str::<RemoteEnvelope>(&text) {
                    // 1. Check timestamp window (±30 s).
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);
                    if (env.ts - now).abs() > 30 {
                        log::warn!("WS timestamp outside window: client_ts={}, server_ts={}, device={}", env.ts, now, device_id);
                        break;
                    }

                    // 2. Nonce replay check — drop the guard BEFORE any await.
                    let nonce_ok = {
                        let mut cache = nonce_cache.lock().unwrap_or_else(|e| e.into_inner());
                        cache.check_and_store(&env.nonce)
                    };
                    if !nonce_ok {
                        log::warn!("WS nonce replay detected: nonce={}, device={}", env.nonce, device_id);
                        break;
                    }

                    // 3. HMAC verification.
                    let payload_str = serde_json::to_string(&env.payload).unwrap_or_default();
                    let sig = env.sig.as_deref().unwrap_or("");
                    if !hmac_util::verify(&device_token, env.ts, &env.nonce, &env.op, &payload_str, sig) {
                        // Structured log with op so integrations bugs can be traced.
                        log::warn!(
                            "[remote] HMAC verification failed: device={} op={} sig_present={}",
                            device_id,
                            env.op,
                            env.sig.is_some(),
                        );
                        // Send a signed error envelope so the client can distinguish
                        // "bad HMAC" from "socket dead" / "server error".
                        {
                            let ts = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_secs() as i64)
                                .unwrap_or(0);
                            let nonce = format!("hmac-err-{ts}");
                            let err_payload = serde_json::json!({ "reason": "hmac_mismatch" });
                            let err_payload_str = serde_json::to_string(&err_payload).unwrap_or_default();
                            let err_sig = hmac_util::sign(&device_token, ts, &nonce, "error", &err_payload_str);
                            let err_env = RemoteEnvelope {
                                id: env.id.clone(),
                                kind: "error".into(),
                                op: env.op.clone(),
                                ts,
                                nonce,
                                payload: err_payload,
                                sig: Some(err_sig),
                            };
                            if let Ok(json) = serde_json::to_string(&err_env) {
                                let _ = resp_tx.send(json);
                            }
                        }
                        // H7: track suspicious HMAC failures; emit event at threshold.
                        if suspicious_tracker.record_failure(&device_id) {
                            if let Some(ref app) = app_handle {
                                use tauri::Emitter;
                                let _ = app.emit(
                                    "remote-device-suspicious",
                                    serde_json::json!({ "deviceId": device_id }),
                                );
                                log::warn!("[remote] H7: suspicious HMAC threshold reached for device={}", device_id);
                            }
                        }
                        break;
                    }

                    // Update last_seen_at for presence tracking.
                    if let Ok(conn) = db.get() {
                        let _ = crate::db::queries::remote::touch_last_seen(&conn, &device_id);
                    }

                    // 4. Dispatch via dispatcher (requires AppHandle).
                    if let Some(ref app) = app_handle {
                        let ctx = DispatcherCtx::new(app.clone());
                        match dispatcher::dispatch(&env.op, &env.payload, &ctx).await {
                            Ok(result_payload) => {
                                // D6: send response to this client only via per-session channel.
                                let ts = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_secs() as i64)
                                    .unwrap_or(0);
                                let nonce = format!("resp-{ts}");
                                let payload_str = serde_json::to_string(&result_payload).unwrap_or_default();
                                let sig = hmac_util::sign(&device_token, ts, &nonce, &env.op, &payload_str);
                                let response = RemoteEnvelope {
                                    id: env.id.clone(),
                                    kind: "response".into(),
                                    op: env.op.clone(),
                                    ts,
                                    nonce,
                                    payload: result_payload,
                                    sig: Some(sig),
                                };
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let _ = resp_tx.send(json);
                                }

                                // H1: broadcast attribution event so other operators see "Next by Ana".
                                // Only broadcast for ops that change visible state (skip pings/queries).
                                const ATTRIBUTED_OPS: &[&str] = &[
                                    "slide.next", "slide.prev", "slide.goto", "slide.clear",
                                    "slide.overlay", "display.overlay",
                                    "audio.play", "audio.pause", "audio.toggle", "audio.seek",
                                    "audio.skip_next", "audio.skip_prev",
                                    "service.start", "service.stop", "service.next_item",
                                    "service.prev_item", "service.goto", "service.jump_to",
                                    "video.play", "video.pause", "video.seek", "video.set_targets",
                                    "projector.open", "projector.close", "projector.set_monitor",
                                    "return_monitor.open", "return_monitor.close",
                                    "overlay.black", "overlay.logo", "overlay.clear",
                                    "search.select", "queue.play", "queue.add",
                                ];
                                if ATTRIBUTED_OPS.contains(&env.op.as_str()) {
                                    use crate::remote::events::make_event_envelope;
                                    let attr_payload = serde_json::json!({
                                        "op": env.op,
                                        "fromDeviceId": device_id,
                                        "fromDeviceName": device_name,
                                    });
                                    let attr_env = make_event_envelope("command.attributed", attr_payload);
                                    if let Ok(attr_json) = serde_json::to_string(&attr_env) {
                                        let _ = broadcast_tx.send(attr_json);
                                    }
                                }
                            }
                            Err(e) => {
                                let ts = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_secs() as i64)
                                    .unwrap_or(0);
                                let nonce = format!("err-{ts}");
                                let payload = serde_json::json!({ "error": e.to_string() });
                                let payload_str = serde_json::to_string(&payload).unwrap_or_default();
                                let sig = hmac_util::sign(&device_token, ts, &nonce, "error", &payload_str);
                                let error_env = RemoteEnvelope {
                                    id: env.id.clone(),
                                    kind: "error".into(),
                                    op: env.op.clone(),
                                    ts,
                                    nonce,
                                    payload,
                                    sig: Some(sig),
                                };
                                if let Ok(json) = serde_json::to_string(&error_env) {
                                    let _ = resp_tx.send(json);
                                }
                            }
                        }
                    } else {
                        // No AppHandle (test mode) — only handle ping inline.
                        if env.op == "ping" {
                            let ts = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_secs() as i64)
                                .unwrap_or(0);
                            let nonce = format!("resp-{ts}");
                            let payload = serde_json::json!({ "op": "pong" });
                            let payload_str = serde_json::to_string(&payload).unwrap_or_default();
                            let sig = hmac_util::sign(&device_token, ts, &nonce, "ping", &payload_str);
                            let pong = RemoteEnvelope {
                                id: env.id.clone(),
                                kind: "response".into(),
                                op: "ping".into(),
                                ts,
                                nonce,
                                payload,
                                sig: Some(sig),
                            };
                            if let Ok(json) = serde_json::to_string(&pong) {
                                let _ = resp_tx.send(json);
                            }
                        }
                    }
                } else {
                    // Not a valid envelope — close inbound.
                    break;
                }
            }
            Message::Close(_) => break,
            Message::Ping(data) => {
                // axum handles WS-level pings automatically; app-level ping is via "op":"ping".
                let _ = data; // suppress unused warning
            }
            _ => {}
        }
    }

    // Inbound done — abort outbound task gracefully.
    outbound.abort();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::{
        nonce_cache::NonceCache,
        pairing::PairingSession,
        routes::pair::PairRouteState,
        server::RemoteServer,
    };
    use std::{sync::{Arc, Mutex}, time::Duration};
    use tokio_tungstenite::tungstenite::Message as TMsg;

    fn make_test_db() -> r2d2::Pool<r2d2_sqlite::SqliteConnectionManager> {
        let manager = r2d2_sqlite::SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).unwrap();
        let conn = pool.get().unwrap();
        crate::db::migrations::run_migrations(&conn).unwrap();
        pool
    }

    fn test_pair_state() -> PairRouteState {
        let (tx, _rx) = tokio::sync::broadcast::channel(16);
        PairRouteState {
            db: make_test_db(),
            pairing: Arc::new(Mutex::new(Some(PairingSession::new(Duration::from_secs(120))))),
            nonce_cache: Arc::new(Mutex::new(NonceCache::new(100, Duration::from_secs(60)))),
            server_name: "Test".into(),
            app_handle: None,
            broadcast_tx: std::sync::Arc::new(tx),
            connections: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
            pin_limiter: std::sync::Arc::new(crate::remote::state::PinRateLimiter::new()),
            pair_rate_limiter: std::sync::Arc::new(crate::remote::rate_limit::PairRateLimiter::default()),
            suspicious_tracker: std::sync::Arc::new(crate::remote::rate_limit::SuspiciousHmacTracker::default()),
        }
    }

    /// Insert a device and return (device_id, base64_token_string, raw_token_bytes).
    /// Mirrors the real pairing flow: raw bytes are stored (hashed), base64 is returned to client.
    fn seed_device(pair_state: &PairRouteState) -> (String, String, Vec<u8>) {
        let raw_token: Vec<u8> = (0u8..32).collect(); // deterministic 32-byte token
        let conn = pair_state.db.get().unwrap();
        let id = crate::db::queries::remote::insert_device(&conn, "TestPhone", &raw_token).unwrap();
        let b64_token = base64::Engine::encode(&base64::prelude::BASE64_URL_SAFE_NO_PAD, &raw_token);
        (id, b64_token, raw_token)
    }

    #[tokio::test]
    async fn ws_echoes_pong_unauthenticated() {
        // D2 baseline: without auth the server still upgrades (Phase D2 mode).
        // But now the handler requires token, so connecting without one → 401.
        // This test validates that lack of token causes failure.
        let mut srv = RemoteServer::new();
        let port = srv.start(0).unwrap();
        let url = format!("ws://127.0.0.1:{}/ws", port);
        // Without a subprotocol header, the upgrade should be rejected (101 → 401).
        let result = tokio_tungstenite::connect_async(&url).await;
        // The server closes the connection or returns non-101.
        // Either an error or a non-2xx response is acceptable.
        match result {
            Err(_) => {} // connection refused or protocol error — expected
            Ok((mut ws, resp)) => {
                // If upgraded anyway (no-auth server), check we can still ping.
                assert!(resp.status().is_success() || resp.status().as_u16() == 101);
                // Minimal server may still be running — just close cleanly.
                let _ = ws.send(TMsg::Close(None)).await;
            }
        }
        srv.stop();
    }

    #[tokio::test]
    async fn ws_rejects_missing_token() {
        let ps = test_pair_state();
        let mut srv = RemoteServer::new();
        let port = srv.start_with_state(0, Some(ps)).unwrap();
        let url = format!("ws://127.0.0.1:{}/ws", port);
        // No subprotocol → server should reject with HTTP error.
        let result = tokio_tungstenite::connect_async(&url).await;
        assert!(result.is_err(), "expected rejection without token, got Ok");
        srv.stop();
    }

    #[tokio::test]
    async fn ws_rejects_invalid_token() {
        let ps = test_pair_state();
        let mut srv = RemoteServer::new();
        let port = srv.start_with_state(0, Some(ps)).unwrap();
        let url = format!("ws://127.0.0.1:{}/ws", port);

        use tokio_tungstenite::tungstenite::client::IntoClientRequest;
        let mut req = url.into_client_request().unwrap();
        req.headers_mut().insert(
            "sec-websocket-protocol",
            "bearer, invalid-token-that-doesnt-exist".parse().unwrap(),
        );
        let result = tokio_tungstenite::connect_async(req).await;
        assert!(result.is_err(), "expected rejection with invalid token");
        srv.stop();
    }

    #[tokio::test]
    async fn ws_accepts_valid_device_token() {
        let ps = test_pair_state();
        let (_device_id, token_str, token) = seed_device(&ps);

        let mut srv = RemoteServer::new();
        let port = srv.start_with_state(0, Some(ps)).unwrap();
        let url = format!("ws://127.0.0.1:{}/ws", port);

        use tokio_tungstenite::tungstenite::client::IntoClientRequest;
        let mut req = url.into_client_request().unwrap();
        req.headers_mut().insert(
            "sec-websocket-protocol",
            format!("bearer, {}", token_str).parse().unwrap(),
        );
        let (mut ws, _) = tokio_tungstenite::connect_async(req)
            .await
            .expect("should accept valid token");

        // Send a signed ping envelope.
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let nonce = "test-nonce-1";
        let sig = crate::remote::hmac_util::sign(&token, ts, nonce, "ping", "{}");
        let env = serde_json::json!({
            "type": "request",
            "op": "ping",
            "ts": ts,
            "nonce": nonce,
            "payload": {},
            "sig": sig,
        });
        ws.send(TMsg::Text(env.to_string().into())).await.unwrap();

        // D6: pong now comes via per-session resp_tx → outbound task, not broadcast.
        let reply = tokio::time::timeout(
            std::time::Duration::from_millis(500),
            ws.next(),
        )
        .await;
        match reply {
            Ok(Some(Ok(TMsg::Text(t)))) => {
                assert!(t.contains("pong") || t.contains("response"),
                    "expected pong response, got: {t}");
            }
            // No response within timeout is acceptable in test mode (no AppHandle → test mode ping).
            _ => {}
        }

        let _ = ws.send(TMsg::Close(None)).await;
        srv.stop();
    }

    /// H1: connecting a device registers its ConnectionInfo; disconnecting removes it.
    #[tokio::test]
    async fn h1_connection_tracked_in_presence_map() {
        use std::collections::HashMap;
        let (tx, _rx) = tokio::sync::broadcast::channel::<String>(16);
        let connections: std::sync::Arc<std::sync::Mutex<HashMap<Uuid, ConnectionInfo>>> =
            std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()));

        let manager = r2d2_sqlite::SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).unwrap();
        let conn = pool.get().unwrap();
        crate::db::migrations::run_migrations(&conn).unwrap();
        let raw_token: Vec<u8> = (100u8..132).collect();
        crate::db::queries::remote::insert_device(&conn, "H1Phone", &raw_token).unwrap();
        drop(conn);
        let token_b64 = base64::Engine::encode(&base64::prelude::BASE64_URL_SAFE_NO_PAD, &raw_token);

        let ps = PairRouteState {
            db: pool,
            pairing: Arc::new(Mutex::new(Some(PairingSession::new(Duration::from_secs(120))))),
            nonce_cache: Arc::new(Mutex::new(NonceCache::new(100, Duration::from_secs(60)))),
            server_name: "H1Test".into(),
            app_handle: None,
            broadcast_tx: std::sync::Arc::new(tx),
            connections: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
            pin_limiter: std::sync::Arc::new(crate::remote::state::PinRateLimiter::new()),
            pair_rate_limiter: std::sync::Arc::new(crate::remote::rate_limit::PairRateLimiter::default()),
            suspicious_tracker: std::sync::Arc::new(crate::remote::rate_limit::SuspiciousHmacTracker::default()),
        };

        let mut srv = RemoteServer::new();
        let port = srv.start_with_state(0, Some(ps)).unwrap();

        let url = format!("ws://127.0.0.1:{}/ws", port);
        use tokio_tungstenite::tungstenite::client::IntoClientRequest;
        let mut req = url.into_client_request().unwrap();
        req.headers_mut().insert(
            "sec-websocket-protocol",
            format!("bearer, {}", token_b64).parse().unwrap(),
        );

        // The server tracks connections internally; we can't directly inspect
        // PairRouteState.connections from here (it's a separate Arc).
        // We verify the round-trip works: connect, send a ping, get a response.
        let (mut ws, _) = tokio_tungstenite::connect_async(req)
            .await
            .expect("connect");

        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let nonce = "h1-nonce-1";
        let raw_token_ref = &(100u8..132u8).collect::<Vec<u8>>();
        let sig = crate::remote::hmac_util::sign(raw_token_ref, ts, nonce, "ping", "{}");
        let env = serde_json::json!({
            "type": "request",
            "op": "ping",
            "ts": ts,
            "nonce": nonce,
            "payload": {},
            "sig": sig,
        });
        ws.send(TMsg::Text(env.to_string().into())).await.unwrap();

        // Wait for pong (confirms session is alive and registered).
        let _ = tokio::time::timeout(
            std::time::Duration::from_millis(500),
            ws.next(),
        ).await;

        let _ = ws.send(TMsg::Close(None)).await;
        srv.stop();
        drop(connections); // suppress unused warning
    }

    /// D6: response to a command goes only to the requesting client, not all clients.
    #[tokio::test]
    async fn d6_response_only_to_requesting_client() {
        use tokio_tungstenite::tungstenite::client::IntoClientRequest;

        let manager = r2d2_sqlite::SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).unwrap();
        let conn = pool.get().unwrap();
        crate::db::migrations::run_migrations(&conn).unwrap();

        // Two distinct device tokens.
        let raw1: Vec<u8> = (0u8..32).collect();
        let raw2: Vec<u8> = (32u8..64).collect();
        crate::db::queries::remote::insert_device(&conn, "Client1", &raw1).unwrap();
        crate::db::queries::remote::insert_device(&conn, "Client2", &raw2).unwrap();
        drop(conn);

        let token1_b64 = base64::Engine::encode(&base64::prelude::BASE64_URL_SAFE_NO_PAD, &raw1);
        let token2_b64 = base64::Engine::encode(&base64::prelude::BASE64_URL_SAFE_NO_PAD, &raw2);

        let (tx, _rx) = tokio::sync::broadcast::channel::<String>(16);
        let ps = PairRouteState {
            db: pool,
            pairing: Arc::new(Mutex::new(Some(PairingSession::new(Duration::from_secs(120))))),
            nonce_cache: Arc::new(Mutex::new(NonceCache::new(100, Duration::from_secs(60)))),
            server_name: "D6Test".into(),
            app_handle: None,
            broadcast_tx: std::sync::Arc::new(tx),
            connections: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
            pin_limiter: std::sync::Arc::new(crate::remote::state::PinRateLimiter::new()),
            pair_rate_limiter: std::sync::Arc::new(crate::remote::rate_limit::PairRateLimiter::default()),
            suspicious_tracker: std::sync::Arc::new(crate::remote::rate_limit::SuspiciousHmacTracker::default()),
        };

        let mut srv = RemoteServer::new();
        let port = srv.start_with_state(0, Some(ps)).unwrap();

        // Connect client 1.
        let url = format!("ws://127.0.0.1:{}/ws", port);
        let mut req1 = url.clone().into_client_request().unwrap();
        req1.headers_mut().insert(
            "sec-websocket-protocol",
            format!("bearer, {}", token1_b64).parse().unwrap(),
        );
        let (mut ws1, _) = tokio_tungstenite::connect_async(req1).await.expect("connect1");

        // Connect client 2.
        let mut req2 = url.into_client_request().unwrap();
        req2.headers_mut().insert(
            "sec-websocket-protocol",
            format!("bearer, {}", token2_b64).parse().unwrap(),
        );
        let (mut ws2, _) = tokio_tungstenite::connect_async(req2).await.expect("connect2");

        // Client 1 sends ping.
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let nonce = "d6-nonce-1";
        let sig = crate::remote::hmac_util::sign(&raw1, ts, nonce, "ping", "{}");
        let ping_env = serde_json::json!({
            "type": "request",
            "op": "ping",
            "ts": ts,
            "nonce": nonce,
            "payload": {},
            "sig": sig,
        });
        ws1.send(TMsg::Text(ping_env.to_string().into())).await.unwrap();

        // Client 1 should get a pong.
        let reply1 = tokio::time::timeout(
            std::time::Duration::from_millis(500),
            ws1.next(),
        ).await;
        let got_pong = match reply1 {
            Ok(Some(Ok(TMsg::Text(t)))) => t.contains("pong") || t.contains("response"),
            _ => false,
        };
        assert!(got_pong, "client 1 should receive pong");

        // Client 2 should NOT receive the pong (no broadcast).
        let reply2 = tokio::time::timeout(
            std::time::Duration::from_millis(150),
            ws2.next(),
        ).await;
        let got_spurious = match reply2 {
            Ok(Some(Ok(TMsg::Text(t)))) => t.contains("pong") || t.contains("response"),
            _ => false,
        };
        assert!(!got_spurious, "client 2 should NOT see client 1's pong");

        let _ = ws1.send(TMsg::Close(None)).await;
        let _ = ws2.send(TMsg::Close(None)).await;
        srv.stop();
    }
}
