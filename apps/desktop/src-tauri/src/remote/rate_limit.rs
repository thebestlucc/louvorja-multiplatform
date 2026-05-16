//! IP-based rate limiter for `/pair/*` endpoints and suspicious-HMAC tracker.
//!
//! H7 spec:
//! - `PairRateLimiter`: token-bucket keyed by `IpAddr`, 5 tokens/60 s (refill on window expiry).
//! - `SuspiciousHmacTracker`: counts HMAC failures per `device_id`; emits
//!   `remote-device-suspicious { deviceId }` via Tauri when threshold (5) is exceeded within 60 s.

use std::{
    collections::HashMap,
    net::IpAddr,
    time::Instant,
};

// ── Token bucket ──────────────────────────────────────────────────────────────

/// A fixed-window token bucket for a single IP.
struct TokenBucket {
    /// Remaining tokens in the current window.
    tokens: u32,
    /// When the current window started.
    window_start: Instant,
}

impl TokenBucket {
    fn new(capacity: u32) -> Self {
        Self {
            tokens: capacity,
            window_start: Instant::now(),
        }
    }

    /// Returns `true` if a token was consumed (request allowed), `false` if rate-limited.
    fn take(&mut self, capacity: u32, window_secs: u64) -> bool {
        let elapsed = self.window_start.elapsed().as_secs();
        if elapsed >= window_secs {
            // New window — refill.
            self.tokens = capacity;
            self.window_start = Instant::now();
        }
        if self.tokens == 0 {
            return false;
        }
        self.tokens -= 1;
        true
    }
}

// ── PairRateLimiter ───────────────────────────────────────────────────────────

/// IP-keyed rate limiter for pairing endpoints.
/// Default: 5 requests per 60-second sliding window.
pub struct PairRateLimiter {
    buckets: std::sync::Mutex<HashMap<IpAddr, TokenBucket>>,
    capacity: u32,
    window_secs: u64,
}

impl PairRateLimiter {
    /// Create a limiter with `capacity` tokens per `window_secs`.
    pub fn new(capacity: u32, window_secs: u64) -> Self {
        Self {
            buckets: std::sync::Mutex::new(HashMap::new()),
            capacity,
            window_secs,
        }
    }

    /// Returns `true` if the request is allowed, `false` if rate-limited (→ 429).
    pub fn check(&self, ip: IpAddr) -> bool {
        let mut map = self.buckets.lock().unwrap_or_else(|e| e.into_inner());
        let cap = self.capacity;
        let win = self.window_secs;
        let bucket = map.entry(ip).or_insert_with(|| TokenBucket::new(cap));
        bucket.take(cap, win)
    }
}

impl Default for PairRateLimiter {
    fn default() -> Self {
        Self::new(5, 60)
    }
}

// ── SuspiciousHmacTracker ─────────────────────────────────────────────────────

/// Per-device HMAC failure counter.
/// When a device accumulates `threshold` failures within `window_secs`, the Tauri
/// event `remote-device-suspicious { deviceId }` is emitted and the counter resets.
pub struct SuspiciousHmacTracker {
    /// (failure_count, window_start)
    counters: std::sync::Mutex<HashMap<String, (u32, Instant)>>,
    threshold: u32,
    window_secs: u64,
}

impl SuspiciousHmacTracker {
    pub fn new(threshold: u32, window_secs: u64) -> Self {
        Self {
            counters: std::sync::Mutex::new(HashMap::new()),
            threshold,
            window_secs,
        }
    }

    /// Record one HMAC failure for `device_id`.
    /// Returns `true` if the threshold was just crossed (caller should emit the event).
    pub fn record_failure(&self, device_id: &str) -> bool {
        let mut map = self.counters.lock().unwrap_or_else(|e| e.into_inner());
        let entry = map.entry(device_id.to_string()).or_insert((0, Instant::now()));

        // Reset window if expired.
        if entry.1.elapsed().as_secs() >= self.window_secs {
            *entry = (0, Instant::now());
        }

        entry.0 += 1;
        if entry.0 >= self.threshold {
            // Reset so the event fires at most once per window.
            *entry = (0, Instant::now());
            return true;
        }
        false
    }
}

impl Default for SuspiciousHmacTracker {
    fn default() -> Self {
        Self::new(5, 60)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    #[test]
    fn rate_limiter_allows_five_then_rejects_sixth() {
        let limiter = PairRateLimiter::new(5, 60);
        let ip: IpAddr = "127.0.0.1".parse().unwrap();

        for i in 1..=5 {
            assert!(limiter.check(ip), "request {i} should be allowed");
        }
        // 6th request must be rejected.
        assert!(!limiter.check(ip), "6th request should be rate-limited (429)");
    }

    #[test]
    fn rate_limiter_different_ips_are_independent() {
        let limiter = PairRateLimiter::new(2, 60);
        let ip1: IpAddr = "10.0.0.1".parse().unwrap();
        let ip2: IpAddr = "10.0.0.2".parse().unwrap();

        assert!(limiter.check(ip1));
        assert!(limiter.check(ip1));
        assert!(!limiter.check(ip1), "ip1 exhausted");

        // ip2 still has its own bucket.
        assert!(limiter.check(ip2));
        assert!(limiter.check(ip2));
        assert!(!limiter.check(ip2), "ip2 exhausted");
    }

    #[test]
    fn suspicious_tracker_fires_at_threshold() {
        let tracker = SuspiciousHmacTracker::new(5, 60);
        let id = "device-abc";

        for i in 1..5 {
            assert!(!tracker.record_failure(id), "failure {i} should not fire yet");
        }
        // 5th failure crosses the threshold.
        assert!(tracker.record_failure(id), "5th failure should trigger suspicious event");
    }

    #[test]
    fn suspicious_tracker_resets_after_threshold() {
        let tracker = SuspiciousHmacTracker::new(3, 60);
        let id = "device-xyz";

        tracker.record_failure(id);
        tracker.record_failure(id);
        assert!(tracker.record_failure(id)); // fires

        // Counter reset — next failure should NOT fire immediately.
        assert!(!tracker.record_failure(id));
    }
}
