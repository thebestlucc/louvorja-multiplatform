use std::time::{Duration, Instant};
use rand::RngCore;

#[derive(Clone, Debug)]
pub struct PairingSession {
    pub token: String,   // URL-safe base64, 32 bytes
    pub pin: String,     // 6 digits
    pub created: Instant,
    pub ttl: Duration,
    pub used: bool,
}

impl PairingSession {
    pub fn new(ttl: Duration) -> Self {
        let mut raw = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut raw);
        use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};
        let token = BASE64_URL_SAFE_NO_PAD.encode(raw);
        let pin = format!("{:06}", rand::random::<u32>() % 1_000_000);
        Self {
            token,
            pin,
            created: Instant::now(),
            ttl,
            used: false,
        }
    }

    pub fn is_expired(&self) -> bool {
        self.created.elapsed() > self.ttl
    }

    pub fn is_valid(&self) -> bool {
        !self.used && !self.is_expired()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_session_is_valid() {
        let s = PairingSession::new(Duration::from_secs(10));
        assert!(s.is_valid());
        assert_eq!(s.pin.len(), 6);
        // 32 bytes url-safe no-pad ≈ 43 chars
        assert!(s.token.len() >= 40);
    }

    #[test]
    fn zero_ttl_expires_immediately() {
        // Use a tiny but non-zero sleep so elapsed() > Duration::from_nanos(1) reliably.
        let s = PairingSession::new(Duration::from_nanos(1));
        std::thread::sleep(Duration::from_millis(2));
        assert!(s.is_expired());
    }

    #[test]
    fn used_is_invalid() {
        let mut s = PairingSession::new(Duration::from_secs(10));
        s.used = true;
        assert!(!s.is_valid());
    }
}
