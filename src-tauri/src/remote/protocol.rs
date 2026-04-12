//! Shared WS message envelope — serialised to/from JSON for every WS message.
//! Rust and TypeScript share this type via tauri-specta.
//!
//! The `payload` field is dynamically typed (`serde_json::Value`) because each
//! op carries different data. On the TypeScript side this maps to `unknown`.

use serde::{Deserialize, Serialize};

/// WS message envelope shared between the Rust server and the PWA.
///
/// Note: `specta::Type` is NOT derived because `serde_json::Value` has no static
/// TS shape. The corresponding TypeScript interface is defined manually in
/// `remote-pwa/src/lib/ws-client.ts`.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEnvelope {
    pub id: Option<String>,
    /// "request" | "event" | "response"
    #[serde(rename = "type")]
    pub kind: String,
    pub op: String,
    pub ts: i64,
    pub nonce: String,
    /// Dynamic JSON payload — op-specific.
    pub payload: serde_json::Value,
    pub sig: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_json() {
        let e = RemoteEnvelope {
            id: None,
            kind: "event".into(),
            op: "slide.changed".into(),
            ts: 1,
            nonce: "n".into(),
            payload: serde_json::json!({"i": 1}),
            sig: None,
        };
        let s = serde_json::to_string(&e).unwrap();
        let d: RemoteEnvelope = serde_json::from_str(&s).unwrap();
        assert_eq!(d.op, "slide.changed");
        assert_eq!(d.kind, "event");
        assert_eq!(d.ts, 1);
        assert_eq!(d.payload["i"], 1);
    }

    #[test]
    fn type_field_renamed() {
        let e = RemoteEnvelope {
            id: Some("abc".into()),
            kind: "request".into(),
            op: "slide.next".into(),
            ts: 999,
            nonce: "n2".into(),
            payload: serde_json::json!({}),
            sig: Some("sig123".into()),
        };
        let s = serde_json::to_string(&e).unwrap();
        // "type" not "kind" in JSON
        assert!(s.contains("\"type\":\"request\""));
        assert!(s.contains("\"op\":\"slide.next\""));
        assert!(s.contains("\"sig\":\"sig123\""));
    }
}
