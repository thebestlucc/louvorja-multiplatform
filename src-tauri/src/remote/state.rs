use crate::remote::nonce_cache::NonceCache;
use crate::remote::pairing::PairingSession;
use crate::remote::server::RemoteServer;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use uuid::Uuid;

pub struct RemoteServerState {
    pub server_handle: Arc<Mutex<Option<RemoteServer>>>,
    pub pairing: Arc<Mutex<Option<PairingSession>>>,
    pub nonce_cache: Arc<Mutex<NonceCache>>,
    pub connections: Arc<Mutex<HashMap<Uuid, ()>>>,
}

impl Default for RemoteServerState {
    fn default() -> Self {
        Self {
            server_handle: Arc::new(Mutex::new(None)),
            pairing: Arc::new(Mutex::new(None)),
            // 1024 nonces, 60-second TTL
            nonce_cache: Arc::new(Mutex::new(NonceCache::new(1024, Duration::from_secs(60)))),
            connections: Arc::new(Mutex::new(HashMap::new())),
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
