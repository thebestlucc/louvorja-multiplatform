//! Outbound event broadcast: Tauri events → WebSocket fanout.
//!
//! When the desktop app emits a Tauri event (e.g. `slide-changed`), this module
//! re-broadcasts it to all connected WebSocket clients as a `RemoteEnvelope`.
//!
//! Architecture:
//! - `RemoteServerState` holds a `broadcast::Sender<String>` (JSON-serialised envelopes).
//! - Each WS session subscribes a `broadcast::Receiver` and forwards to its socket.
//! - The `listen_and_broadcast` fn hooks Tauri `listen_any` to feed the channel.
//!
//! Note: Each connected client has its own HMAC key, so signing per-client is done
//! inside the WS handler when it receives from the broadcast channel. The broadcast
//! payload is the *unsigned* envelope JSON; each handler re-signs it.

use crate::remote::{protocol::RemoteEnvelope, state::ConnectionInfo};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use uuid::Uuid;

/// Capacity of the broadcast channel. Slow consumers lag and drop events.
pub const BROADCAST_CAPACITY: usize = 128;

/// Create a new broadcast channel pair for the remote server.
pub fn make_broadcast_channel() -> (broadcast::Sender<String>, broadcast::Receiver<String>) {
    broadcast::channel(BROADCAST_CAPACITY)
}

/// Build an unsigned `RemoteEnvelope` for an outbound server event.
/// Each WS handler will sign it with its per-device key before sending.
pub fn make_event_envelope(op: &str, payload: serde_json::Value) -> RemoteEnvelope {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    // Nonce for server events: timestamp + op hash (recipients verify freshness via ts window).
    let nonce = format!("srv-{}-{}", ts, &op[..op.len().min(8)]);
    RemoteEnvelope {
        id: None,
        kind: "event".into(),
        op: op.to_string(),
        ts,
        nonce,
        payload,
        sig: None, // set by each WS handler per-device key
    }
}

/// Register Tauri event listeners that fanout to all connected WS clients.
///
/// Called once when the remote server starts.
/// `connections` is the shared presence map; passed so the `remote-devices-changed`
/// listener can embed the current connection list in the `presence.changed` payload.
///
/// Returns a `Vec<EventId>` so the caller can call `app.unlisten(id)` on server stop
/// to prevent listener accumulation across restarts.
pub fn listen_and_broadcast(
    app: &tauri::AppHandle,
    tx: broadcast::Sender<String>,
    connections: Arc<Mutex<HashMap<Uuid, ConnectionInfo>>>,
) -> Vec<tauri::EventId> {
    use tauri::Listener;

    let mut handles = Vec::new();

    // Helper: build an envelope, serialize it, and send to the broadcast channel.
    let send = move |op: &str, payload: serde_json::Value, tx: &broadcast::Sender<String>| {
        let env = make_event_envelope(op, payload);
        if let Ok(json) = serde_json::to_string(&env) {
            // Ignore send errors — no subscribers is fine (channel just discards).
            let _ = tx.send(json);
        }
    };

    // `slide-changed` ──────────────────────────────────────────────────────
    {
        let tx2 = tx.clone();
        handles.push(app.listen("slide-changed", move |event| {
            let payload: serde_json::Value =
                serde_json::from_str(event.payload()).unwrap_or(serde_json::Value::Null);
            send("slide.changed", payload, &tx2);
        }));
    }

    // `overlay-changed` ────────────────────────────────────────────────────
    {
        let tx2 = tx.clone();
        handles.push(app.listen("overlay-changed", move |event| {
            let payload: serde_json::Value =
                serde_json::from_str(event.payload()).unwrap_or(serde_json::Value::Null);
            send("overlay.changed", payload, &tx2);
        }));
    }

    // `audio-status` ────────────────────────────────────────────────────────
    {
        let tx2 = tx.clone();
        handles.push(app.listen("audio-status", move |event| {
            let payload: serde_json::Value =
                serde_json::from_str(event.payload()).unwrap_or(serde_json::Value::Null);
            send("audio.status", payload, &tx2);
        }));
    }

    // `remote-devices-changed` ─────────────────────────────────────────────
    {
        let tx2 = tx.clone();
        let conns2 = connections.clone();
        handles.push(app.listen("remote-devices-changed", move |_event| {
            let arr: Vec<serde_json::Value> = conns2
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .values()
                .map(|info| {
                    serde_json::json!({
                        "deviceId":    info.device_id,
                        "name":        info.name,
                        "connectedAt": info.connected_at,
                    })
                })
                .collect();
            send("presence.changed", serde_json::json!({ "connections": arr }), &tx2);
        }));
    }

    // `video-state` ────────────────────────────────────────────────────────
    {
        let tx2 = tx.clone();
        handles.push(app.listen("video-state", move |event| {
            let payload: serde_json::Value =
                serde_json::from_str(event.payload()).unwrap_or(serde_json::Value::Null);
            send("video.state", payload, &tx2);
        }));
    }

    // `projector-state-changed` ────────────────────────────────────────────
    {
        let tx2 = tx.clone();
        handles.push(app.listen("projector-state-changed", move |event| {
            let is_open: bool = serde_json::from_str(event.payload()).unwrap_or(false);
            send("projector.state", serde_json::json!({ "open": is_open }), &tx2);
        }));
    }

    // `return-state-changed` ───────────────────────────────────────────────
    {
        let tx2 = tx.clone();
        handles.push(app.listen("return-state-changed", move |event| {
            let is_open: bool = serde_json::from_str(event.payload()).unwrap_or(false);
            send("return_monitor.state", serde_json::json!({ "open": is_open }), &tx2);
        }));
    }

    // `service-state` ──────────────────────────────────────────────────────
    // Emitted by React when service playback state changes.
    // Forwards to PWA as service.state { title, activeIndex, items[] }
    {
        let tx2 = tx.clone();
        handles.push(app.listen("service-state", move |event| {
            let payload: serde_json::Value =
                serde_json::from_str(event.payload()).unwrap_or(serde_json::Value::Null);
            send("service.state", payload, &tx2);
        }));
    }

    // `queue-state` ────────────────────────────────────────────────────────
    // Emitted by React when playing queue changes.
    // Forwards to PWA as queue.state { nowPlaying, upNext[], history[] }
    {
        let tx2 = tx.clone();
        handles.push(app.listen("queue-state", move |event| {
            let payload: serde_json::Value =
                serde_json::from_str(event.payload()).unwrap_or(serde_json::Value::Null);
            send("queue.state", payload, &tx2);
        }));
    }

    handles
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn make_event_envelope_has_correct_fields() {
        let env = make_event_envelope("slide.changed", serde_json::json!({"slideIndex": 1}));
        assert_eq!(env.kind, "event");
        assert_eq!(env.op, "slide.changed");
        assert!(env.ts > 0);
        assert!(env.sig.is_none(), "unsigned at this stage");
        assert_eq!(env.payload["slideIndex"], 1);
    }

    #[test]
    fn new_event_names_are_documented() {
        // Document the new event→op mappings added as part of remote bridge fixes.
        let mappings: &[(&str, &str)] = &[
            ("projector-state-changed", "projector.state"),
            ("return-state-changed",    "return_monitor.state"),
            ("service-state",           "service.state"),
            ("queue-state",             "queue.state"),
        ];
        for (tauri_event, ws_op) in mappings {
            assert!(tauri_event.contains('-'), "Tauri events use kebab-case: {tauri_event}");
            assert!(ws_op.contains('.'), "WS ops use dot.notation: {ws_op}");
        }
    }

    #[test]
    fn broadcast_channel_fanout() {
        let (tx, mut rx1) = make_broadcast_channel();
        let mut rx2 = tx.subscribe();

        let env = make_event_envelope("slide.next", serde_json::json!({}));
        let json = serde_json::to_string(&env).unwrap();
        tx.send(json.clone()).unwrap();

        assert_eq!(rx1.try_recv().unwrap(), json);
        assert_eq!(rx2.try_recv().unwrap(), json);
    }
}
