#[derive(Debug, Clone)]
pub struct RemoteConfig {
    pub preferred_port: u16,
    pub pairing_ttl_secs: u64,
    pub signature_window_secs: i64,
    pub nonce_cache_ttl_secs: u64,
}
impl Default for RemoteConfig {
    fn default() -> Self {
        Self {
            preferred_port: 7456,
            pairing_ttl_secs: 120,
            signature_window_secs: 30,
            nonce_cache_ttl_secs: 60,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_match_brief() {
        let c = RemoteConfig::default();
        assert_eq!(c.preferred_port, 7456);
        assert_eq!(c.pairing_ttl_secs, 120);
        assert_eq!(c.signature_window_secs, 30);
        assert_eq!(c.nonce_cache_ttl_secs, 60);
    }
}
