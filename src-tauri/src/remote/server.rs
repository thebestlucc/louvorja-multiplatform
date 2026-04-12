use axum::{Router, routing::get};
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::runtime::Builder;
use tokio::sync::oneshot;

pub struct RemoteServer {
    pub port: u16,
    pub running: Arc<AtomicBool>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    join: Option<std::thread::JoinHandle<()>>,
}

impl RemoteServer {
    pub fn new() -> Self {
        Self {
            port: 0,
            running: Arc::new(AtomicBool::new(false)),
            shutdown_tx: None,
            join: None,
        }
    }
    pub fn is_running(&self) -> bool { self.running.load(Ordering::SeqCst) }
    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() { let _ = tx.send(()); }
        if let Some(h) = self.join.take() { let _ = h.join(); }
        self.running.store(false, Ordering::SeqCst);
        self.port = 0;
    }
}

/// Build the axum router. Phase C/D will fill in real routes.
pub fn build_router() -> Router {
    Router::new().route("/health", get(|| async { "ok" }))
}

impl RemoteServer {
    pub fn start(&mut self, preferred_port: u16) -> std::io::Result<u16> {
        if self.is_running() { return Ok(self.port); }
        let (listener, port) = crate::net::port::bind_preferred(preferred_port)?;
        listener.set_nonblocking(true)?;
        let (tx, rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(tx);
        self.port = port;
        self.running.store(true, Ordering::SeqCst);

        let running = self.running.clone();
        let handle = std::thread::Builder::new()
            .name("louvorja-remote".into())
            .spawn(move || {
                let rt = Builder::new_multi_thread().enable_all().build().unwrap();
                rt.block_on(async move {
                    let router = build_router();
                    let tokio_listener = tokio::net::TcpListener::from_std(listener).unwrap();
                    let server = axum::serve(tokio_listener, router);
                    let _ = server.with_graceful_shutdown(async { let _ = rx.await; }).await;
                    running.store(false, Ordering::SeqCst);
                });
            })?;
        self.join = Some(handle);
        Ok(port)
    }
}

impl Default for RemoteServer {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn new_is_not_running() { let s = RemoteServer::new(); assert!(!s.is_running()); }
    #[test]
    fn stop_on_never_started_is_noop() { let mut s = RemoteServer::new(); s.stop(); assert!(!s.is_running()); }
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
}
