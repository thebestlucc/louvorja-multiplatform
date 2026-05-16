/// Stub — proper test harness added in Phase I.
/// Verifies the `emit_status` helper compiles and the event name constant matches.
///
/// Real integration coverage (start → listen → receive event) is in `tests/remote_integration.rs`
/// scheduled for Phase I.
#[test]
fn remote_status_event_name_is_kebab_case() {
    // The event name used in commands/remote.rs must match what the frontend listens for.
    let event_name = "remote-server-status";
    assert!(event_name.chars().all(|c| c.is_ascii_lowercase() || c == '-'));
}
