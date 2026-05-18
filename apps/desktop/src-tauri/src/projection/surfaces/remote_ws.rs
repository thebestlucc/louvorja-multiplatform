//! Remote WS bridge ProjectionSurface.
//!
//! Adapts ProjectionHub deltas/snapshots into the WS `RemoteEnvelope`
//! protocol used by the remote-pwa. Emits unsigned envelopes onto the
//! shared broadcast channel; per-session WS tasks re-sign with the
//! connected device's HMAC key.
//!
//! Ops emitted:
//! - `slide.changed`   { slide, version }
//! - `overlay.changed` { blackScreen, logoScreen }  (legacy bool shape — see ADR)
//! - `alert.changed`   { text, isVisible, isTicker }
//! - `freeze.changed`  { frozen }

use crate::projection::delta::{DeltaEvent, ProjectionDelta};
use crate::projection::snapshot::ProjectionSnapshot;
use crate::projection::state::{Alert, OverlayMode};
use crate::projection::surface::ProjectionSurface;
use crate::remote::events::make_event_envelope;
use std::sync::Arc;
use tokio::sync::broadcast;

pub struct RemoteWsSurface {
    broadcast_tx: Arc<broadcast::Sender<String>>,
}

impl RemoteWsSurface {
    pub fn new(broadcast_tx: Arc<broadcast::Sender<String>>) -> Arc<Self> {
        Arc::new(Self { broadcast_tx })
    }

    fn send(&self, op: &str, payload: serde_json::Value) {
        let env = make_event_envelope(op, payload);
        if let Ok(json) = serde_json::to_string(&env) {
            let _ = self.broadcast_tx.send(json);
        }
    }
}

fn slide_changed_payload(
    slide: &Option<crate::db::models::SlideContent>,
    version: u64,
) -> serde_json::Value {
    serde_json::json!({ "slide": slide, "version": version })
}

fn overlay_changed_payload(overlay: &OverlayMode) -> serde_json::Value {
    let (black, logo) = match overlay {
        OverlayMode::Black => (true, false),
        OverlayMode::Logo => (false, true),
        OverlayMode::None => (false, false),
    };
    serde_json::json!({ "blackScreen": black, "logoScreen": logo })
}

fn alert_changed_payload(alert: &Option<Alert>) -> serde_json::Value {
    match alert {
        Some(a) => serde_json::json!({
            "text": a.text,
            "isVisible": true,
            "isTicker": a.is_ticker,
        }),
        None => serde_json::json!({
            "text": "",
            "isVisible": false,
            "isTicker": false,
        }),
    }
}

fn freeze_changed_payload(frozen: bool) -> serde_json::Value {
    serde_json::json!({ "frozen": frozen })
}

impl ProjectionSurface for RemoteWsSurface {
    fn hydrate(&self, snapshot: &ProjectionSnapshot) {
        self.send(
            "slide.changed",
            slide_changed_payload(&snapshot.current_slide, snapshot.version),
        );
        self.send("overlay.changed", overlay_changed_payload(&snapshot.overlay));
        self.send("alert.changed", alert_changed_payload(&snapshot.alert));
        self.send("freeze.changed", freeze_changed_payload(snapshot.frozen));
    }

    fn deliver(&self, delta: &ProjectionDelta) {
        for event in &delta.events {
            match event {
                DeltaEvent::SlideChanged { slide } => {
                    self.send(
                        "slide.changed",
                        slide_changed_payload(slide, delta.to_version),
                    );
                }
                DeltaEvent::OverlayChanged { overlay } => {
                    self.send("overlay.changed", overlay_changed_payload(overlay));
                }
                DeltaEvent::AlertChanged { alert } => {
                    self.send("alert.changed", alert_changed_payload(alert));
                }
                DeltaEvent::FreezeChanged { frozen } => {
                    self.send("freeze.changed", freeze_changed_payload(*frozen));
                }
                // ContextChanged isn't broadcast — pwa doesn't consume context
                // independently. When context changes the next slide-set carries it.
                DeltaEvent::ContextChanged { .. } => {}
            }
        }
    }

    fn is_alive(&self) -> bool {
        self.broadcast_tx.receiver_count() > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::slides::{BackgroundConfig, BackgroundKind};
    use crate::db::models::SlideContent;
    use crate::projection::hub::ProjectionHub;
    use crate::projection::mutation::Mutation;

    fn lyrics(text: &str) -> SlideContent {
        SlideContent::Lyrics {
            text: text.to_string(),
            label: None,
            background: BackgroundConfig {
                kind: BackgroundKind::Solid,
                color: Some("#000".into()),
                ..Default::default()
            },
            text_color: None,
            text_size: None,
        }
    }

    fn build() -> (Arc<RemoteWsSurface>, Arc<ProjectionHub>, Arc<broadcast::Sender<String>>) {
        let (tx, _rx) = broadcast::channel::<String>(128);
        let tx = Arc::new(tx);
        let hub = ProjectionHub::new();
        let surface = RemoteWsSurface::new(tx.clone());
        (surface, hub, tx)
    }

    fn drain_ops(rx: &mut broadcast::Receiver<String>) -> Vec<(String, serde_json::Value)> {
        let mut out = Vec::new();
        while let Ok(json) = rx.try_recv() {
            let env: serde_json::Value = serde_json::from_str(&json).unwrap();
            let op = env["op"].as_str().unwrap().to_string();
            let payload = env["payload"].clone();
            out.push((op, payload));
        }
        out
    }

    #[test]
    fn deliver_slide_changed_sends_slide_envelope_with_to_version() {
        let (surface, _hub, tx) = build();
        let mut rx = tx.subscribe();
        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 1,
            events: vec![DeltaEvent::SlideChanged {
                slide: Some(lyrics("v")),
            }],
        };
        surface.deliver(&delta);

        let ops = drain_ops(&mut rx);
        let (_, payload) = ops
            .iter()
            .find(|(o, _)| o == "slide.changed")
            .expect("slide.changed envelope");
        assert_eq!(payload["version"], serde_json::json!(1));
        assert!(payload["slide"].is_object(), "slide must be object: {payload:?}");
    }

    #[test]
    fn deliver_overlay_black_sends_legacy_bool_payload() {
        let (surface, _hub, tx) = build();
        let mut rx = tx.subscribe();
        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 1,
            events: vec![DeltaEvent::OverlayChanged {
                overlay: OverlayMode::Black,
            }],
        };
        surface.deliver(&delta);

        let ops = drain_ops(&mut rx);
        let (_, payload) = ops.iter().find(|(o, _)| o == "overlay.changed").unwrap();
        assert_eq!(payload["blackScreen"], serde_json::json!(true));
        assert_eq!(payload["logoScreen"], serde_json::json!(false));
    }

    #[test]
    fn deliver_alert_sends_alert_changed_envelope() {
        let (surface, _hub, tx) = build();
        let mut rx = tx.subscribe();
        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 1,
            events: vec![DeltaEvent::AlertChanged {
                alert: Some(Alert {
                    text: "hi".into(),
                    is_ticker: true,
                }),
            }],
        };
        surface.deliver(&delta);

        let ops = drain_ops(&mut rx);
        let (_, payload) = ops.iter().find(|(o, _)| o == "alert.changed").unwrap();
        assert_eq!(payload["text"], serde_json::json!("hi"));
        assert_eq!(payload["isVisible"], serde_json::json!(true));
        assert_eq!(payload["isTicker"], serde_json::json!(true));
    }

    #[test]
    fn deliver_freeze_sends_freeze_changed_envelope() {
        let (surface, _hub, tx) = build();
        let mut rx = tx.subscribe();
        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 1,
            events: vec![DeltaEvent::FreezeChanged { frozen: true }],
        };
        surface.deliver(&delta);

        let ops = drain_ops(&mut rx);
        let (_, payload) = ops.iter().find(|(o, _)| o == "freeze.changed").unwrap();
        assert_eq!(payload["frozen"], serde_json::json!(true));
    }

    #[test]
    fn is_alive_tracks_broadcast_subscribers() {
        let (surface, _hub, tx) = build();
        assert!(!surface.is_alive(), "no subscribers yet");
        let _rx = tx.subscribe();
        assert!(surface.is_alive(), "with subscriber");
    }

    #[tokio::test]
    async fn hydrate_sends_slide_overlay_alert_freeze_envelopes() {
        let (surface, hub, tx) = build();
        let mut rx = tx.subscribe();
        hub.apply(Mutation::SetSlide(Some(lyrics("verse")))).await.unwrap();
        let (snapshot, _delta_rx) = hub.attach().await;
        surface.hydrate(&snapshot);

        let ops: Vec<String> = drain_ops(&mut rx).into_iter().map(|(o, _)| o).collect();
        assert!(ops.contains(&"slide.changed".to_string()),    "missing slide.changed: {ops:?}");
        assert!(ops.contains(&"overlay.changed".to_string()),  "missing overlay.changed: {ops:?}");
        assert!(ops.contains(&"alert.changed".to_string()),    "missing alert.changed: {ops:?}");
        assert!(ops.contains(&"freeze.changed".to_string()),   "missing freeze.changed: {ops:?}");
    }
}
