use axum::{Router, routing::{get, post}};
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::runtime::Builder;
use tokio::sync::{broadcast, oneshot};

use crate::remote::routes::{
    health::health_handler,
    pair::{pair_complete, pair_start, PairRouteState},
    ws::ws_handler,
};

pub struct RemoteServer {
    pub port: u16,
    pub running: Arc<AtomicBool>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    /// Holds a reference to the broadcast sender so dropping this server
    /// (on `stop()`) closes the channel and triggers graceful WS shutdown.
    _broadcast_ref: Option<broadcast::Sender<String>>,
    join: Option<std::thread::JoinHandle<()>>,
}

impl RemoteServer {
    pub fn new() -> Self {
        Self {
            port: 0,
            running: Arc::new(AtomicBool::new(false)),
            shutdown_tx: None,
            _broadcast_ref: None,
            join: None,
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn stop(&mut self) {
        // Signal HTTP server shutdown.
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        // Drop the broadcast sender clone — all WS subscribers get RecvError::Closed
        // and send a WS_GOING_AWAY close frame before exiting.
        drop(self._broadcast_ref.take());
        // Wait for the server thread to finish.
        if let Some(h) = self.join.take() {
            let _ = h.join();
        }
        self.running.store(false, Ordering::SeqCst);
        self.port = 0;
    }
}

/// Build the axum router with all remote-server routes.
/// `pair_state` is `Some` when started with full app context;
/// `None` in unit tests that only test the server lifecycle.
pub fn build_router(pair_state: Option<PairRouteState>) -> Router {
    // `/health` is always present (no state needed).
    let health_router: Router = Router::new().route("/health", get(health_handler));

    // `/ws` and `/pair/*` require full app context (DB + pairing session).
    let stateful_router: Router = if let Some(ps) = pair_state {
        Router::new()
            .route("/ws", get(ws_handler))
            .route("/pair/start", post(pair_start))
            .route("/pair/complete", post(pair_complete))
            .with_state(ps)
    } else {
        Router::new()
    };

    health_router.merge(stateful_router)
}

impl RemoteServer {
    /// Start with a minimal router (no pairing state — used in unit tests).
    pub fn start(&mut self, preferred_port: u16) -> std::io::Result<u16> {
        self.start_with_state(preferred_port, None)
    }

    /// Start with full pairing support (called from Tauri command).
    pub fn start_with_state(
        &mut self,
        preferred_port: u16,
        pair_state: Option<PairRouteState>,
    ) -> std::io::Result<u16> {
        if self.is_running() {
            return Ok(self.port);
        }
        let (listener, port) = crate::net::port::bind_preferred(preferred_port)?;
        listener.set_nonblocking(true)?;
        let (tx, rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(tx);
        self.port = port;
        self.running.store(true, Ordering::SeqCst);

        // Hold a reference to the broadcast sender so dropping this server
        // triggers graceful WS disconnect.
        if let Some(ref ps) = pair_state {
            self._broadcast_ref = Some((*ps.broadcast_tx).clone());
        }

        let running = self.running.clone();
        let handle = std::thread::Builder::new()
            .name("louvorja-remote".into())
            .spawn(move || {
                let rt = Builder::new_multi_thread().enable_all().build().unwrap();
                rt.block_on(async move {
                    let router = build_router(pair_state);
                    let tokio_listener =
                        tokio::net::TcpListener::from_std(listener).unwrap();
                    let server = axum::serve(tokio_listener, router);
                    let _ = server
                        .with_graceful_shutdown(async {
                            let _ = rx.await;
                        })
                        .await;
                    running.store(false, Ordering::SeqCst);
                });
            })?;
        self.join = Some(handle);
        Ok(port)
    }
}

impl Default for RemoteServer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_is_not_running() {
        let s = RemoteServer::new();
        assert!(!s.is_running());
    }

    #[test]
    fn stop_on_never_started_is_noop() {
        let mut s = RemoteServer::new();
        s.stop();
        assert!(!s.is_running());
    }

    #[test]
    fn start_binds_port_and_stop_releases_it() {
        let mut s = RemoteServer::new();
        let port = s.start(0).expect("start");
        assert!(port >= 1024);
        assert!(s.is_running());
        // Re-binding the same port immediately after stop should succeed.
        s.stop();
        let listener = std::net::TcpListener::bind(("127.0.0.1", port));
        assert!(listener.is_ok(), "port not released after stop");
    }

    /// D6: after `server.stop()`, any connected WS clients receive a close frame
    /// within 1 second because dropping `_broadcast_ref` triggers `RecvError::Closed`
    /// in the outbound task which sends WS_GOING_AWAY.
    #[tokio::test]
    async fn d6_stop_sends_close_to_connected_clients() {
        use crate::remote::{
            nonce_cache::NonceCache,
            pairing::PairingSession,
            routes::pair::PairRouteState,
        };
        use std::{sync::{Arc, Mutex}, time::Duration};
        use futures_util::StreamExt;
        use tokio_tungstenite::tungstenite::{Message as TMsg, client::IntoClientRequest};

        let (tx, _rx) = tokio::sync::broadcast::channel::<String>(16);
        let broadcast_tx = Arc::new(tx);

        let manager = r2d2_sqlite::SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).unwrap();
        let conn = pool.get().unwrap();
        crate::db::migrations::run_migrations(&conn).unwrap();
        // Seed a device.
        let token = b"d6-test-token-32bytes-padded0000".to_vec();
        let _id = crate::db::queries::remote::insert_device(&conn, "D6Phone", &token).unwrap();
        drop(conn);

        let ps = PairRouteState {
            db: pool,
            pairing: Arc::new(Mutex::new(Some(PairingSession::new(Duration::from_secs(120))))),
            nonce_cache: Arc::new(Mutex::new(NonceCache::new(100, Duration::from_secs(60)))),
            server_name: "D6Test".into(),
            app_handle: None,
            broadcast_tx: broadcast_tx.clone(),
        };

        let mut srv = RemoteServer::new();
        let port = srv.start_with_state(0, Some(ps)).unwrap();

        // Connect an authenticated WS client.
        let url = format!("ws://127.0.0.1:{}/ws", port);
        let mut req = url.into_client_request().unwrap();
        let token_str = String::from_utf8(token).unwrap();
        req.headers_mut().insert(
            "sec-websocket-protocol",
            format!("bearer, {}", token_str).parse().unwrap(),
        );
        let (mut ws, _) = tokio_tungstenite::connect_async(req)
            .await
            .expect("connect");

        // Trigger graceful shutdown:
        // 1. Signal the HTTP server (oneshot).
        // 2. Drop the broadcast ref so WS outbound tasks get RecvError::Closed.
        // We do NOT join the thread yet — that would block the tokio runtime
        // and prevent the WS close frame from being driven.
        {
            if let Some(tx) = srv.shutdown_tx.take() {
                let _ = tx.send(());
            }
            drop(srv._broadcast_ref.take());
        }

        // Wait up to 1 s to receive a close frame.
        let deadline = tokio::time::Instant::now() + Duration::from_secs(1);
        let got_close = loop {
            match tokio::time::timeout_at(deadline, ws.next()).await {
                Ok(Some(Ok(TMsg::Close(_)))) => break true,
                Ok(None) => break true,  // stream closed = server closed connection
                Ok(Some(Ok(_))) => continue, // other messages while waiting
                Ok(Some(Err(_))) => break true, // connection reset = server closed
                Err(_) => break false,    // timeout
            }
        };

        // Now join the server thread.
        srv.running.store(false, Ordering::SeqCst);
        if let Some(h) = srv.join.take() {
            let _ = tokio::task::spawn_blocking(move || { let _ = h.join(); }).await;
        }
        assert!(got_close, "expected close frame within 1s after server.stop()");
    }
}
