use std::net::UdpSocket;

pub fn get_lan_ip() -> Option<String> {
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    sock.local_addr().ok().map(|a| a.ip().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn returns_some_on_lan_or_none_offline() {
        // Must not panic; may return None in sandboxed CI.
        let _ = get_lan_ip();
    }
    #[test]
    fn returned_ip_parses_as_ipaddr_when_some() {
        if let Some(s) = get_lan_ip() {
            assert!(s.parse::<std::net::IpAddr>().is_ok());
        }
    }
}
