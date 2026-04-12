use base64::{Engine, prelude::BASE64_STANDARD_NO_PAD};
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Sign a message composed of timestamp, nonce, op, and JSON payload.
/// Returns a base64-standard-no-pad encoded HMAC-SHA256 signature.
pub fn sign(key: &[u8], ts: i64, nonce: &str, op: &str, payload_json: &str) -> String {
    let msg = format!("{}|{}|{}|{}", ts, nonce, op, payload_json);
    let mut m = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    m.update(msg.as_bytes());
    BASE64_STANDARD_NO_PAD.encode(m.finalize().into_bytes())
}

/// Verify a signature using constant-time comparison to prevent timing oracles.
pub fn verify(key: &[u8], ts: i64, nonce: &str, op: &str, payload_json: &str, sig_b64: &str) -> bool {
    let expected = sign(key, ts, nonce, op, payload_json);
    use subtle::ConstantTimeEq;
    expected.as_bytes().ct_eq(sig_b64.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_verifies() {
        let s = sign(b"secret", 42, "n1", "slide.next", "{}");
        assert!(verify(b"secret", 42, "n1", "slide.next", "{}", &s));
    }

    #[test]
    fn tamper_fails() {
        let s = sign(b"secret", 42, "n1", "slide.next", "{}");
        // Different op
        assert!(!verify(b"secret", 42, "n1", "slide.prev", "{}", &s));
        // Different key
        assert!(!verify(b"secret2", 42, "n1", "slide.next", "{}", &s));
        // Different timestamp
        assert!(!verify(b"secret", 43, "n1", "slide.next", "{}", &s));
    }
}
