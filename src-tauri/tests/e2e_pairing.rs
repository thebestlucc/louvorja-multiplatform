/// Phase I1 — End-to-end pairing integration test.
///
/// Starts the remote server, completes a full pairing flow via HTTP, then
/// verifies that a WS upgrade with the issued device token succeeds.
///
/// This test does NOT require a Tauri AppHandle — it wires the server
/// directly using the public `RemoteServer` + route state API.
use std::time::Duration;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use louvorja_multiplatform::remote::{
    pairing::PairingSession,
    routes::pair::PairRouteState,
    server::RemoteServer,
    nonce_cache::NonceCache,
};

fn build_in_memory_pool() -> Pool<SqliteConnectionManager> {
    let manager = SqliteConnectionManager::memory();
    let pool = Pool::new(manager).expect("pool");
    let conn = pool.get().expect("conn");
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS remote_devices (
            id           TEXT    PRIMARY KEY,
            name         TEXT    NOT NULL,
            token_hash   BLOB    NOT NULL,
            created_at   INTEGER NOT NULL,
            last_seen_at INTEGER,
            revoked_at   INTEGER
        );",
    )
    .expect("migration");
    pool
}

#[test]
fn full_pairing_flow_issues_device_token() {
    let pool = build_in_memory_pool();
    let pairing = std::sync::Arc::new(std::sync::Mutex::new(None::<PairingSession>));
    let nonce_cache = std::sync::Arc::new(std::sync::Mutex::new(NonceCache::new(60, Duration::from_secs(60))));
    let broadcast_tx = std::sync::Arc::new(tokio::sync::broadcast::channel::<String>(64).0);

    let pair_state = PairRouteState {
        db: pool.clone(),
        pairing: pairing.clone(),
        nonce_cache,
        server_name: "TestServer".to_string(),
        app_handle: None,
        broadcast_tx,
        connections: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        pin_limiter: std::sync::Arc::new(louvorja_multiplatform::remote::state::PinRateLimiter::new()),
        pair_rate_limiter: std::sync::Arc::new(louvorja_multiplatform::remote::rate_limit::PairRateLimiter::default()),
        suspicious_tracker: std::sync::Arc::new(louvorja_multiplatform::remote::rate_limit::SuspiciousHmacTracker::default()),
    };

    let mut server = RemoteServer::new();
    let port = server
        .start_with_state(0, Some(pair_state))
        .expect("server start");
    assert!(port > 0, "server must bind a port");
    assert!(server.is_running());

    // Set up a pairing session.
    let session = PairingSession::new(Duration::from_secs(120));
    let token = session.token.clone();
    *pairing.lock().unwrap() = Some(session);

    // POST /pair/complete with the one-time token.
    let body = serde_json::json!({
        "token": token,
        "deviceName": "Test Phone",
    });
    let url = format!("http://127.0.0.1:{}/pair/complete", port);
    let resp = ureq::post(&url)
        .set("Content-Type", "application/json")
        .send_json(&body)
        .expect("pair/complete request");

    assert_eq!(resp.status(), 200);
    let json: serde_json::Value = resp.into_json().expect("json body");
    let device_token = json["deviceToken"].as_str().expect("deviceToken field");
    assert!(!device_token.is_empty(), "device token must not be empty");

    // Verify the device was persisted.
    let conn = pool.get().expect("conn");
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM remote_devices WHERE revoked_at IS NULL", [], |r| r.get(0))
        .expect("query");
    assert_eq!(count, 1, "one device should be registered");

    // WebSocket connect with device token via Sec-WebSocket-Protocol: bearer, <token>.
    // Browsers cannot set custom headers on WS upgrades, so the subprotocol header is
    // the designated carrier for the bearer token.
    let ws_url = format!("ws://127.0.0.1:{}/ws", port);
    let mut req = tungstenite::client::IntoClientRequest::into_client_request(ws_url.as_str())
        .expect("valid ws url");
    req.headers_mut().insert(
        "sec-websocket-protocol",
        format!("bearer, {}", device_token).parse().expect("valid header value"),
    );
    match tungstenite::connect(req) {
        Ok((_socket, response)) => {
            assert_eq!(response.status(), 101, "WS upgrade must succeed");
        }
        Err(tungstenite::Error::Http(resp)) => {
            panic!("WS rejected with status {}: expected 101", resp.status());
        }
        Err(e) => {
            panic!("WS connection error: {e}");
        }
    }

    server.stop();
    assert!(!server.is_running());
}

#[test]
fn pairing_with_wrong_token_is_rejected() {
    let pool = build_in_memory_pool();
    let pairing = std::sync::Arc::new(std::sync::Mutex::new(None::<PairingSession>));
    let nonce_cache = std::sync::Arc::new(std::sync::Mutex::new(NonceCache::new(60, Duration::from_secs(60))));
    let broadcast_tx = std::sync::Arc::new(tokio::sync::broadcast::channel::<String>(64).0);

    let pair_state = PairRouteState {
        db: pool.clone(),
        pairing: pairing.clone(),
        nonce_cache,
        server_name: "TestServer".to_string(),
        app_handle: None,
        broadcast_tx,
        connections: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        pin_limiter: std::sync::Arc::new(louvorja_multiplatform::remote::state::PinRateLimiter::new()),
        pair_rate_limiter: std::sync::Arc::new(louvorja_multiplatform::remote::rate_limit::PairRateLimiter::default()),
        suspicious_tracker: std::sync::Arc::new(louvorja_multiplatform::remote::rate_limit::SuspiciousHmacTracker::default()),
    };

    let mut server = RemoteServer::new();
    let port = server.start_with_state(0, Some(pair_state)).expect("start");

    // Set a valid session but submit a wrong token.
    let session = PairingSession::new(Duration::from_secs(120));
    *pairing.lock().unwrap() = Some(session);

    let body = serde_json::json!({
        "token": "wrong-token-that-should-fail",
        "deviceName": "Attacker",
    });
    let url = format!("http://127.0.0.1:{}/pair/complete", port);
    let result = ureq::post(&url)
        .set("Content-Type", "application/json")
        .send_json(&body);

    match result {
        Ok(resp) => assert_ne!(resp.status() as u16, 200u16, "wrong token must not return 200"),
        Err(ureq::Error::Status(status, _)) => {
            assert!(
                status == 401 || status == 403 || status == 400,
                "expected 4xx, got {status}"
            );
        }
        Err(e) => panic!("unexpected error: {e}"),
    }

    server.stop();
}
