use crate::projection::delta::ProjectionDelta;
use crate::projection::snapshot::ProjectionSnapshot;
use crate::projection::surface::ProjectionSurface;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// Tauri event emission boundary so unit tests can substitute a recorder for
/// the live AppHandle.
pub(super) trait EventEmitter: Send + Sync + 'static {
    fn emit(&self, event: &str, payload: serde_json::Value);
}

struct AppHandleEmitter(AppHandle);

impl EventEmitter for AppHandleEmitter {
    fn emit(&self, event: &str, payload: serde_json::Value) {
        let _ = self.0.emit(event, payload);
    }
}

/// The Tauri event name carrying serialized ProjectionDelta payloads. The
/// frontend `useProjectionState` hook listens for this exact string.
const PROJECTION_DELTA_EVENT: &str = "projection-delta";

/// Surface that turns every Hub Delta into one `projection-delta` Tauri event.
/// hydrate() is intentionally a no-op: frontends fetch the snapshot via the
/// `get_projection_snapshot` command on mount, not via a pushed event.
pub struct DeltaSurface {
    emitter: Arc<dyn EventEmitter>,
}

impl DeltaSurface {
    pub fn new(app: AppHandle) -> Arc<Self> {
        Arc::new(Self {
            emitter: Arc::new(AppHandleEmitter(app)),
        })
    }

    #[cfg(test)]
    fn with_emitter(emitter: Arc<dyn EventEmitter>) -> Arc<Self> {
        Arc::new(Self { emitter })
    }
}

impl ProjectionSurface for DeltaSurface {
    fn hydrate(&self, _snapshot: &ProjectionSnapshot) {
        // Snapshots are pulled (get_projection_snapshot), not pushed. The
        // frontend's recovery rule pulls a fresh snapshot whenever a Delta's
        // from_version diverges from its local version.
    }

    fn deliver(&self, delta: &ProjectionDelta) {
        let payload = serde_json::to_value(delta).unwrap_or(serde_json::Value::Null);
        self.emitter.emit(PROJECTION_DELTA_EVENT, payload);
    }

    fn is_alive(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::delta::DeltaEvent;
    use crate::projection::state::{Alert, OverlayMode};
    use std::sync::Mutex;

    type Recorded = Vec<(String, serde_json::Value)>;

    struct RecordingEmitter {
        events: Mutex<Recorded>,
    }

    impl RecordingEmitter {
        fn new() -> Arc<Self> {
            Arc::new(Self {
                events: Mutex::new(Vec::new()),
            })
        }
        fn drain(&self) -> Recorded {
            std::mem::take(&mut *self.events.lock().unwrap())
        }
    }

    impl EventEmitter for RecordingEmitter {
        fn emit(&self, event: &str, payload: serde_json::Value) {
            self.events
                .lock()
                .unwrap()
                .push((event.to_string(), payload));
        }
    }

    fn build() -> (Arc<DeltaSurface>, Arc<RecordingEmitter>) {
        let rec = RecordingEmitter::new();
        let surface = DeltaSurface::with_emitter(rec.clone() as Arc<dyn EventEmitter>);
        (surface, rec)
    }

    fn empty_snapshot() -> ProjectionSnapshot {
        ProjectionSnapshot {
            version: 0,
            current_slide: None,
            context: None,
            overlay: OverlayMode::None,
            frozen: false,
            alert: None,
        }
    }

    #[test]
    fn hydrate_is_noop_no_events_emitted() {
        let (surface, rec) = build();
        let snap = ProjectionSnapshot {
            version: 42,
            current_slide: None,
            context: None,
            overlay: OverlayMode::Black,
            frozen: true,
            alert: Some(Alert {
                text: "x".into(),
                is_ticker: false,
            }),
        };
        surface.hydrate(&snap);
        assert!(
            rec.drain().is_empty(),
            "hydrate must not emit — frontend pulls snapshot via command"
        );
    }

    #[test]
    fn deliver_emits_one_projection_delta_event() {
        let (surface, rec) = build();
        surface.hydrate(&empty_snapshot());
        rec.drain();

        let delta = ProjectionDelta {
            from_version: 3,
            to_version: 4,
            events: vec![DeltaEvent::FreezeChanged { frozen: true }],
        };
        surface.deliver(&delta);
        let events = rec.drain();
        assert_eq!(events.len(), 1, "deliver must emit exactly one event");
        assert_eq!(events[0].0, "projection-delta");
    }

    #[test]
    fn deliver_payload_serializes_full_delta_with_camelcase_fields() {
        let (surface, rec) = build();
        let delta = ProjectionDelta {
            from_version: 5,
            to_version: 6,
            events: vec![
                DeltaEvent::OverlayChanged {
                    overlay: OverlayMode::Logo,
                },
                DeltaEvent::AlertChanged {
                    alert: Some(Alert {
                        text: "hello".into(),
                        is_ticker: true,
                    }),
                },
            ],
        };
        surface.deliver(&delta);
        let events = rec.drain();
        let payload = &events[0].1;
        assert_eq!(payload["fromVersion"], serde_json::json!(5));
        assert_eq!(payload["toVersion"], serde_json::json!(6));
        assert_eq!(
            payload["events"][0]["kind"],
            serde_json::json!("overlayChanged")
        );
        assert_eq!(payload["events"][0]["overlay"], serde_json::json!("logo"));
        assert_eq!(
            payload["events"][1]["kind"],
            serde_json::json!("alertChanged")
        );
        assert_eq!(
            payload["events"][1]["alert"]["text"],
            serde_json::json!("hello")
        );
        assert_eq!(
            payload["events"][1]["alert"]["isTicker"],
            serde_json::Value::Bool(true)
        );
    }

    #[test]
    fn deliver_with_empty_events_still_emits_one_projection_delta() {
        let (surface, rec) = build();
        // A no-op batch never reaches deliver (Hub filters before broadcast).
        // But if a Delta with events=[] ever flowed through, our contract is
        // "one delta in → one event out". Pin that.
        let delta = ProjectionDelta {
            from_version: 9,
            to_version: 9,
            events: vec![],
        };
        surface.deliver(&delta);
        assert_eq!(rec.drain().len(), 1);
    }

    #[test]
    fn is_alive_returns_true() {
        let (surface, _rec) = build();
        assert!(surface.is_alive());
    }
}
