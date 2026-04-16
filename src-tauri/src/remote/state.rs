use crate::remote::events;
use crate::remote::nonce_cache::NonceCache;
use crate::remote::pairing::PairingSession;
use crate::remote::rate_limit::{PairRateLimiter, SuspiciousHmacTracker};
use crate::remote::server::RemoteServer;
use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Simple in-memory rate limiter for PIN pairing attempts.
/// Allows 5 attempts, then locks out for 5 minutes.
pub struct PinRateLimiter {
    attempts: AtomicU8,
    lockout_until: AtomicI64,
}

impl PinRateLimiter {
    pub fn new() -> Self {
        Self {
            attempts: AtomicU8::new(0),
            lockout_until: AtomicI64::new(0),
        }
    }

    /// Returns true if allowed, false if rate limited.
    pub fn check(&self) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let lockout = self.lockout_until.load(Ordering::SeqCst);
        if now < lockout {
            return false;
        }
        let attempts = self.attempts.fetch_add(1, Ordering::SeqCst);
        if attempts >= 5 {
            self.lockout_until.store(now + 300, Ordering::SeqCst);
            false
        } else {
            true
        }
    }

    pub fn reset(&self) {
        self.attempts.store(0, Ordering::SeqCst);
        self.lockout_until.store(0, Ordering::SeqCst);
    }
}

impl Default for PinRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

/// Metadata kept for each connected WS session.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    pub device_id: String,
    pub name: String,
    /// Unix seconds when the connection was established.
    pub connected_at: i64,
}

pub struct RemoteServerState {
    pub server_handle: Arc<Mutex<Option<RemoteServer>>>,
    pub pairing: Arc<Mutex<Option<PairingSession>>>,
    pub nonce_cache: Arc<Mutex<NonceCache>>,
    pub connections: Arc<Mutex<HashMap<Uuid, ConnectionInfo>>>,
    /// Broadcast channel for Tauri → WS fanout. All WS sessions subscribe a receiver.
    pub broadcast_tx: Arc<broadcast::Sender<String>>,
    /// Tauri event listener IDs registered when the remote server starts.
    /// Used with `app.unlisten(id)` on `stop_remote_server` to prevent listener accumulation across restarts.
    pub listener_handles: Arc<Mutex<Vec<tauri::EventId>>>,
    /// Rate limiter for PIN pairing attempts to prevent brute-force attacks.
    pub pin_limiter: Arc<PinRateLimiter>,
    /// H7: IP-based rate limiter for /pair/* endpoints (5 req/min per IP).
    pub pair_rate_limiter: Arc<PairRateLimiter>,
    /// H7: Tracks per-device HMAC failures; emits suspicious event at threshold.
    pub suspicious_tracker: Arc<SuspiciousHmacTracker>,
}

impl Default for RemoteServerState {
    fn default() -> Self {
        let (tx, _rx) = events::make_broadcast_channel();
        Self {
            server_handle: Arc::new(Mutex::new(None)),
            pairing: Arc::new(Mutex::new(None)),
            // 1024 nonces, 60-second TTL
            nonce_cache: Arc::new(Mutex::new(NonceCache::new(1024, Duration::from_secs(60)))),
            connections: Arc::new(Mutex::new(HashMap::new())),
            broadcast_tx: Arc::new(tx),
            listener_handles: Arc::new(Mutex::new(Vec::new())),
            pin_limiter: Arc::new(PinRateLimiter::new()),
            pair_rate_limiter: Arc::new(PairRateLimiter::default()),
            suspicious_tracker: Arc::new(SuspiciousHmacTracker::default()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn state_is_default_constructible() {
        let _ = RemoteServerState::default();
    }
}
