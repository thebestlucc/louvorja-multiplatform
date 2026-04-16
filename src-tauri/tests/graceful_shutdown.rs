/// Phase I4 — Graceful shutdown test.
///
/// Verifies that RemoteServer::stop() terminates the server thread within
/// 2 seconds — preventing orphan threads after app exit.
///
/// The production shutdown path (in lib.rs) calls srv.stop() inside a
/// `std::thread::spawn` on `CloseRequested` for the main window, matching
/// the pattern proven correct here.
use std::{sync::{Arc, Mutex}, time::Duration};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use tokio::sync::broadcast;

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

/// Starts the server and verifies stop() joins within the deadline.
#[test]
fn stop_joins_server_thread_within_2_seconds() {
    let pool = build_in_memory_pool();
    let (tx, _rx) = broadcast::channel::<String>(16);
    let broadcast_tx = Arc::new(tx);

    let ps = PairRouteState {
        db: pool,
        pairing: Arc::new(Mutex::new(Some(PairingSession::new(Duration::from_secs(120))))),
        nonce_cache: Arc::new(Mutex::new(NonceCache::new(64, Duration::from_secs(60)))),
        server_name: "ShutdownTest".into(),
        app_handle: None,
        broadcast_tx,
        connections: Arc::new(Mutex::new(std::collections::HashMap::new())),
        pin_limiter: Arc::new(louvorja_multiplatform::remote::state::PinRateLimiter::new()),
        pair_rate_limiter: Arc::new(louvorja_multiplatform::remote::rate_limit::PairRateLimiter::default()),
        suspicious_tracker: Arc::new(louvorja_multiplatform::remote::rate_limit::SuspiciousHmacTracker::default()),
    };

    let mut server = RemoteServer::new();
    let port = server.start_with_state(0, Some(ps)).expect("server start");
    assert!(port > 0);
    assert!(server.is_running());

    // Time the stop() call — it must join within 2 seconds.
    let start = std::time::Instant::now();
    server.stop();
    let elapsed = start.elapsed();

    assert!(
        !server.is_running(),
        "server should not be running after stop()"
    );
    assert!(
        elapsed < Duration::from_secs(2),
        "stop() took {elapsed:?} — must join within 2 s to prevent orphan threads on app exit"
    );
}

/// Verifies that stopping a never-started server is a no-op (safe to call
/// in the shutdown handler even if the user never started remote).
#[test]
fn stop_never_started_is_noop_and_fast() {
    let mut server = RemoteServer::new();
    let start = std::time::Instant::now();
    server.stop(); // must not block
    let elapsed = start.elapsed();
    assert!(!server.is_running());
    assert!(elapsed < Duration::from_millis(100), "noop stop took too long: {elapsed:?}");
}

/// Verifies that multiple stop() calls are idempotent.
#[test]
fn double_stop_is_safe() {
    let mut server = RemoteServer::new();
    let port = server.start(0).expect("start");
    assert!(port > 0);
    server.stop();
    server.stop(); // second call must not panic
    assert!(!server.is_running());
}
