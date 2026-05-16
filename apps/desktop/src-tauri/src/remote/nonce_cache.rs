use lru::LruCache;
use std::num::NonZeroUsize;
use std::time::{Duration, Instant};

pub struct NonceCache {
    inner: LruCache<String, Instant>,
    ttl: Duration,
}

impl NonceCache {
    pub fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            inner: LruCache::new(NonZeroUsize::new(capacity).expect("capacity must be > 0")),
            ttl,
        }
    }

    /// Returns `true` if the nonce was NOT seen before (and registers it).
    /// Returns `false` if this is a replay.
    pub fn check_and_store(&mut self, nonce: &str) -> bool {
        self.prune();
        if self.inner.contains(nonce) {
            return false;
        }
        self.inner.put(nonce.to_string(), Instant::now());
        true
    }

    fn prune(&mut self) {
        let expired: Vec<String> = self
            .inner
            .iter()
            .filter(|(_, ts)| ts.elapsed() > self.ttl)
            .map(|(k, _)| k.clone())
            .collect();
        for k in expired {
            self.inner.pop(&k);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_use_ok_replay_fails() {
        let mut c = NonceCache::new(100, Duration::from_secs(60));
        assert!(c.check_and_store("n1"));
        assert!(!c.check_and_store("n1"));
    }

    #[test]
    fn expired_nonce_becomes_usable() {
        let mut c = NonceCache::new(100, Duration::from_millis(1));
        assert!(c.check_and_store("n1"));
        std::thread::sleep(Duration::from_millis(5));
        assert!(c.check_and_store("n1"));
    }
}
