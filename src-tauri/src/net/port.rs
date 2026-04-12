use std::net::TcpListener;

/// Binds a listener on 0.0.0.0 preferring `preferred`; falls back to OS-assigned.
/// Returns the bound listener and the actual port.
pub fn bind_preferred(preferred: u16) -> std::io::Result<(TcpListener, u16)> {
    let listener = TcpListener::bind(("0.0.0.0", preferred))
        .or_else(|_| TcpListener::bind(("0.0.0.0", 0)))?;
    let port = listener.local_addr()?.port();
    Ok((listener, port))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn binds_to_preferred_when_free() {
        let (l, port) = bind_preferred(0).unwrap();
        assert!(port >= 1024);
        drop(l);
    }
    #[test]
    fn falls_back_when_preferred_taken() {
        let (hog, hog_port) = bind_preferred(0).unwrap();
        let (_other, other_port) = bind_preferred(hog_port).unwrap();
        assert_ne!(hog_port, other_port);
        drop(hog);
    }
}
