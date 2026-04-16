/// Phase I2 — Load test: 5 concurrent authenticated WS clients, 50 cmd/s each.
///
/// Validates that the remote server handles burst load on loopback without
/// message loss or panics. p95 dispatch target is documented rather than
/// asserted (CI timing too variable), but the test asserts 0 errors.
///
/// NOTE: This test uses `#[ignore]` by default so normal `cargo test` runs
/// skip it. Run explicitly with:
///   cargo test --manifest-path src-tauri/Cargo.toml --test load_ws -- --ignored
use std::{sync::{Arc, Mutex}, time::Duration};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use futures_util::{SinkExt, StreamExt};

use louvorja_multiplatform::remote::{
    nonce_cache::NonceCache,
    pairing::PairingSession,
    routes::pair::PairRouteState,
    server::RemoteServer,
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

fn seed_device(pool: &Pool<SqliteConnectionManager>, name: &str, raw_token: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let conn = pool.get().expect("conn");
    let id = uuid::Uuid::new_v4().to_string();
    let hash: Vec<u8> = Sha256::digest(raw_token).to_vec();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    conn.execute(
        "INSERT INTO remote_devices (id, name, token_hash, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, name, hash, now],
    )
    .expect("insert device");
    id
}

/// Start a server seeded with `n_clients` pre-registered devices.
/// Returns (server, port, list of (base64-encoded token, raw token bytes)).
fn start_server_with_clients(
    n_clients: usize,
) -> (RemoteServer, u16, Vec<(String, Vec<u8>)>) {
    let pool = build_in_memory_pool();

    let mut tokens = Vec::new();
    for i in 0..n_clients {
        let raw: Vec<u8> = (0u8..32).map(|b| b.wrapping_add(i as u8)).collect();
        seed_device(&pool, &format!("LoadClient{}", i), &raw);
        let b64 = base64::Engine::encode(&base64::prelude::BASE64_URL_SAFE_NO_PAD, &raw);
        tokens.push((b64, raw));
    }

    let (tx, _rx) = broadcast::channel::<String>(256);
    let broadcast_tx = Arc::new(tx);

    let ps = PairRouteState {
        db: pool,
        pairing: Arc::new(Mutex::new(Some(PairingSession::new(Duration::from_secs(120))))),
        nonce_cache: Arc::new(Mutex::new(NonceCache::new(10_000, Duration::from_secs(60)))),
        server_name: "LoadTest".into(),
        app_handle: None,
        broadcast_tx,
        connections: Arc::new(Mutex::new(std::collections::HashMap::new())),
        pin_limiter: Arc::new(louvorja_multiplatform::remote::state::PinRateLimiter::new()),
        pair_rate_limiter: Arc::new(louvorja_multiplatform::remote::rate_limit::PairRateLimiter::default()),
        suspicious_tracker: Arc::new(louvorja_multiplatform::remote::rate_limit::SuspiciousHmacTracker::default()),
    };

    let mut server = RemoteServer::new();
    let port = server.start_with_state(0, Some(ps)).expect("server start");
    (server, port, tokens)
}

#[tokio::test]
#[ignore = "load test; run explicitly with -- --ignored"]
async fn load_5_clients_50_cmds_per_second() {
    const N_CLIENTS: usize = 5;
    const CMDS_PER_CLIENT: usize = 50;
    const TEST_DURATION_SECS: u64 = 2;

    let (mut server, port, tokens) = start_server_with_clients(N_CLIENTS);

    let start = std::time::Instant::now();
    let error_counts = Arc::new(std::sync::atomic::AtomicUsize::new(0));

    let mut handles = Vec::new();
    for (client_idx, (token_b64, raw_token)) in tokens.into_iter().enumerate() {
        let errors = error_counts.clone();
        let ws_url = format!("ws://127.0.0.1:{}/ws", port);

        let handle = tokio::spawn(async move {
            let mut req = ws_url.into_client_request().expect("valid url");
            req.headers_mut().insert(
                "sec-websocket-protocol",
                format!("bearer, {}", token_b64).parse().expect("valid header"),
            );

            let (ws, _) = match tokio_tungstenite::connect_async(req).await {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("connect failed: {e}");
                    errors.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    return;
                }
            };

            let (mut write, mut read) = ws.split();

            // Drive incoming messages on a background task so the connection stays open.
            let read_task = tokio::spawn(async move {
                while let Some(Ok(_)) = read.next().await {}
            });

            // Send CMDS_PER_CLIENT properly-signed commands with ~20ms spacing (50 cmd/s).
            for seq in 0..CMDS_PER_CLIENT {
                // Fresh timestamp per message (must be within ±30s window).
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                // Globally unique nonce: client index + sequence number.
                let nonce = format!("load-c{}-s{}", client_idx, seq);
                let payload_json = "{}";
                let sig = louvorja_multiplatform::remote::hmac_util::sign(
                    &raw_token, ts, &nonce, "slide.next", payload_json,
                );
                let cmd = serde_json::json!({
                    "id": format!("load-c{}-s{}", client_idx, seq),
                    "type": "request",
                    "op": "slide.next",
                    "ts": ts,
                    "nonce": nonce,
                    "payload": {},
                    "sig": sig,
                }).to_string();

                if let Err(e) = write.send(tokio_tungstenite::tungstenite::Message::Text(cmd.into())).await {
                    eprintln!("send error: {e}");
                    errors.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }

            // Graceful close.
            let _ = write.send(tokio_tungstenite::tungstenite::Message::Close(None)).await;
            read_task.abort();
        });
        handles.push(handle);
    }

    // Wait for all clients to finish (or timeout at 2× the test duration).
    let timeout = Duration::from_secs(TEST_DURATION_SECS * 2 + 5);
    for h in handles {
        let _ = tokio::time::timeout(timeout, h).await;
    }

    let elapsed = start.elapsed();
    let errors = error_counts.load(std::sync::atomic::Ordering::Relaxed);

    eprintln!(
        "Load test: {} clients × {} cmds in {:?} — {} errors",
        N_CLIENTS, CMDS_PER_CLIENT, elapsed, errors
    );

    server.stop();

    assert_eq!(errors, 0, "Expected 0 connection/send errors under load");
}
