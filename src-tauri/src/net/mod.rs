//! Shared networking utilities (LAN IP, port picking, connection counter).

pub mod lan_ip;
pub use lan_ip::get_lan_ip;

pub mod port;

pub mod connection_counter;
pub use connection_counter::{ConnectionCounter, ConnGuard};

#[cfg(test)]
mod tests {
    #[test]
    fn module_loads() { /* compile-only assertion */ }
}
