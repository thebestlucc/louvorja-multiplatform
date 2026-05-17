use crate::db::models::display::OverlayState;
use crate::db::models::{SlideContent, SlideContext};
use crate::display::projection::SlideChangedPayload;
use crate::projection::delta::{DeltaEvent, ProjectionDelta};
use crate::projection::snapshot::ProjectionSnapshot;
use crate::projection::state::{Alert, OverlayMode};
use crate::projection::surface::ProjectionSurface;
use crate::state::AlertState;
use std::sync::{Arc, Mutex};
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

#[derive(Clone, Default)]
struct Cache {
    version: u64,
    slide: Option<SlideContent>,
    context: Option<SlideContext>,
    overlay: OverlayMode,
    alert: Option<Alert>,
}

pub struct WebviewSurface {
    emitter: Arc<dyn EventEmitter>,
    cache: Mutex<Cache>,
}

impl WebviewSurface {
    pub fn new(app: AppHandle) -> Arc<Self> {
        Arc::new(Self {
            emitter: Arc::new(AppHandleEmitter(app)),
            cache: Mutex::new(Cache::default()),
        })
    }

    #[cfg(test)]
    fn with_emitter(emitter: Arc<dyn EventEmitter>) -> Arc<Self> {
        Arc::new(Self {
            emitter,
            cache: Mutex::new(Cache::default()),
        })
    }
}

impl ProjectionSurface for WebviewSurface {
    fn hydrate(&self, snapshot: &ProjectionSnapshot) {
        let cache = {
            let mut c = self.cache.lock().unwrap();
            c.version = snapshot.version;
            c.slide = snapshot.current_slide.clone();
            c.context = snapshot.context.clone();
            c.overlay = snapshot.overlay.clone();
            c.alert = snapshot.alert.clone();
            c.clone()
        };
        emit_slide_or_cleared(self.emitter.as_ref(), &cache);
        emit_slide_context(self.emitter.as_ref(), &cache);
        emit_overlay_changed(self.emitter.as_ref(), &cache);
    }

    fn deliver(&self, delta: &ProjectionDelta) {
        let mut slide_touched = false;
        let mut context_touched = false;
        let mut overlay_or_alert_touched = false;
        let cache = {
            let mut c = self.cache.lock().unwrap();
            c.version = delta.to_version;
            for event in &delta.events {
                match event {
                    DeltaEvent::SlideChanged { slide } => {
                        c.slide = slide.clone();
                        slide_touched = true;
                    }
                    DeltaEvent::ContextChanged { context } => {
                        c.context = context.clone();
                        context_touched = true;
                    }
                    DeltaEvent::OverlayChanged { overlay } => {
                        c.overlay = overlay.clone();
                        overlay_or_alert_touched = true;
                    }
                    DeltaEvent::AlertChanged { alert } => {
                        c.alert = alert.clone();
                        overlay_or_alert_touched = true;
                    }
                    DeltaEvent::FreezeChanged { .. } => {}
                }
            }
            c.clone()
        };
        if slide_touched {
            emit_slide_or_cleared(self.emitter.as_ref(), &cache);
        }
        if context_touched {
            emit_slide_context(self.emitter.as_ref(), &cache);
        }
        if overlay_or_alert_touched {
            emit_overlay_changed(self.emitter.as_ref(), &cache);
        }
    }

    fn is_alive(&self) -> bool {
        true
    }
}

fn emit_slide_or_cleared(emitter: &dyn EventEmitter, cache: &Cache) {
    match cache.slide.as_ref() {
        Some(slide) => {
            let payload = SlideChangedPayload {
                slide: slide.clone(),
                version: cache.version,
            };
            emitter.emit(
                "slide-changed",
                serde_json::to_value(payload).unwrap_or(serde_json::Value::Null),
            );
        }
        None => {
            emitter.emit(
                "slide-cleared",
                serde_json::json!({ "version": cache.version }),
            );
        }
    }
}

fn emit_slide_context(emitter: &dyn EventEmitter, cache: &Cache) {
    let payload = serde_json::to_value(&cache.context).unwrap_or(serde_json::Value::Null);
    emitter.emit("slide-context", payload);
}

fn emit_overlay_changed(emitter: &dyn EventEmitter, cache: &Cache) {
    let state = overlay_state_from_cache(cache);
    let payload = serde_json::to_value(state).unwrap_or(serde_json::Value::Null);
    emitter.emit("overlay-changed", payload);
}

fn overlay_state_from_cache(cache: &Cache) -> OverlayState {
    let (black, logo) = match cache.overlay {
        OverlayMode::None => (false, false),
        OverlayMode::Black => (true, false),
        OverlayMode::Logo => (false, true),
    };
    let alert_state = match cache.alert.as_ref() {
        Some(a) => AlertState {
            text: a.text.clone(),
            is_visible: true,
            is_ticker: a.is_ticker,
        },
        None => AlertState::default(),
    };
    OverlayState {
        black_screen: black,
        logo_screen: logo,
        alert: Some(alert_state),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    fn build() -> (Arc<WebviewSurface>, Arc<RecordingEmitter>) {
        let rec = RecordingEmitter::new();
        let surface = WebviewSurface::with_emitter(rec.clone() as Arc<dyn EventEmitter>);
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

    fn lyrics(text: &str) -> SlideContent {
        use crate::db::models::slides::{BackgroundConfig, BackgroundKind};
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

    fn sample_context(title: &str) -> SlideContext {
        SlideContext {
            next: None,
            index: 1,
            total: 3,
            title: title.to_string(),
            current_slide_start_ms: None,
            next_slide_start_ms: None,
            audio_duration_ms: None,
        }
    }

    #[test]
    fn hydrate_empty_snapshot_emits_cleared_context_and_overlay() {
        let (surface, rec) = build();
        surface.hydrate(&empty_snapshot());
        let events = rec.drain();
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names, vec!["slide-cleared", "slide-context", "overlay-changed"]);

        // slide-cleared carries the snapshot version.
        assert_eq!(events[0].1, serde_json::json!({ "version": 0 }));
        // slide-context is null (no context in snapshot).
        assert!(events[1].1.is_null(), "slide-context payload must be null on empty snapshot: {}", events[1].1);
        // overlay-changed has flags off and an invisible empty alert.
        let overlay = &events[2].1;
        assert_eq!(overlay["blackScreen"], serde_json::Value::Bool(false));
        assert_eq!(overlay["logoScreen"], serde_json::Value::Bool(false));
        let alert = &overlay["alert"];
        assert_eq!(alert["text"], serde_json::Value::String(String::new()));
        assert_eq!(alert["isVisible"], serde_json::Value::Bool(false));
        assert_eq!(alert["isTicker"], serde_json::Value::Bool(false));
    }

    #[test]
    fn hydrate_populated_snapshot_emits_slide_changed_context_and_overlay() {
        let (surface, rec) = build();
        let snapshot = ProjectionSnapshot {
            version: 7,
            current_slide: Some(lyrics("Amazing grace")),
            context: Some(sample_context("Amazing Grace")),
            overlay: OverlayMode::Black,
            frozen: false,
            alert: Some(Alert {
                text: "service starts soon".into(),
                is_ticker: true,
            }),
        };
        surface.hydrate(&snapshot);
        let events = rec.drain();
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names, vec!["slide-changed", "slide-context", "overlay-changed"]);

        // slide-changed carries the slide + the snapshot version.
        assert_eq!(events[0].1["version"], serde_json::json!(7));
        assert!(
            events[0].1["slide"].to_string().contains("Amazing grace"),
            "slide payload must contain slide content: {}",
            events[0].1
        );
        // slide-context carries the SlideContext payload.
        assert_eq!(events[1].1["title"], serde_json::json!("Amazing Grace"));
        assert_eq!(events[1].1["index"], serde_json::json!(1));
        // overlay-changed reflects Black + visible ticker alert.
        let overlay = &events[2].1;
        assert_eq!(overlay["blackScreen"], serde_json::Value::Bool(true));
        assert_eq!(overlay["logoScreen"], serde_json::Value::Bool(false));
        let alert = &overlay["alert"];
        assert_eq!(alert["text"], serde_json::json!("service starts soon"));
        assert_eq!(alert["isVisible"], serde_json::Value::Bool(true));
        assert_eq!(alert["isTicker"], serde_json::Value::Bool(true));
    }

    #[test]
    fn deliver_with_slide_and_context_emits_slide_changed_before_context() {
        let (surface, rec) = build();
        surface.hydrate(&empty_snapshot());
        rec.drain();

        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 1,
            events: vec![
                DeltaEvent::SlideChanged { slide: Some(lyrics("v1")) },
                DeltaEvent::ContextChanged { context: Some(sample_context("Hymn")) },
            ],
        };
        surface.deliver(&delta);
        let events = rec.drain();
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(
            names,
            vec!["slide-changed", "slide-context"],
            "slide-changed must precede slide-context"
        );
        assert_eq!(events[0].1["version"], serde_json::json!(1));
        assert_eq!(events[1].1["title"], serde_json::json!("Hymn"));
    }

    #[test]
    fn deliver_overlay_and_alert_in_one_delta_emits_single_combined_overlay_changed() {
        let (surface, rec) = build();
        surface.hydrate(&empty_snapshot());
        rec.drain();

        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 1,
            events: vec![
                DeltaEvent::OverlayChanged { overlay: OverlayMode::Logo },
                DeltaEvent::AlertChanged {
                    alert: Some(Alert { text: "heads up".into(), is_ticker: false }),
                },
            ],
        };
        surface.deliver(&delta);
        let events = rec.drain();
        let names: Vec<&str> = events.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(
            names,
            vec!["overlay-changed"],
            "overlay + alert in one delta must collapse to one overlay-changed emit"
        );
        let overlay = &events[0].1;
        assert_eq!(overlay["logoScreen"], serde_json::Value::Bool(true));
        assert_eq!(overlay["blackScreen"], serde_json::Value::Bool(false));
        assert_eq!(overlay["alert"]["text"], serde_json::json!("heads up"));
        assert_eq!(overlay["alert"]["isVisible"], serde_json::Value::Bool(true));
    }

    #[test]
    fn deliver_freeze_only_emits_nothing() {
        let (surface, rec) = build();
        surface.hydrate(&empty_snapshot());
        rec.drain();

        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 1,
            events: vec![DeltaEvent::FreezeChanged { frozen: true }],
        };
        surface.deliver(&delta);
        assert!(
            rec.drain().is_empty(),
            "FreezeChanged must not emit any legacy webview event"
        );
    }

    #[test]
    fn overlay_state_from_cache_maps_modes_and_alert_correctly() {
        let mut cache = Cache::default();

        cache.overlay = OverlayMode::None;
        let s = overlay_state_from_cache(&cache);
        assert!(!s.black_screen && !s.logo_screen);
        let a = s.alert.expect("alert always Some");
        assert!(!a.is_visible, "no alert in cache → AlertState invisible");
        assert_eq!(a.text, "");
        assert!(!a.is_ticker);

        cache.overlay = OverlayMode::Black;
        let s = overlay_state_from_cache(&cache);
        assert!(s.black_screen && !s.logo_screen);

        cache.overlay = OverlayMode::Logo;
        let s = overlay_state_from_cache(&cache);
        assert!(!s.black_screen && s.logo_screen);

        cache.alert = Some(Alert { text: "hi".into(), is_ticker: true });
        let s = overlay_state_from_cache(&cache);
        let a = s.alert.expect("alert always Some");
        assert!(a.is_visible);
        assert_eq!(a.text, "hi");
        assert!(a.is_ticker);
    }

    #[test]
    fn deliver_full_delta_emits_slide_then_context_then_overlay() {
        let (surface, rec) = build();
        surface.hydrate(&empty_snapshot());
        rec.drain();

        let delta = ProjectionDelta {
            from_version: 0,
            to_version: 2,
            events: vec![
                DeltaEvent::SlideChanged { slide: Some(lyrics("v1")) },
                DeltaEvent::ContextChanged { context: Some(sample_context("H")) },
                DeltaEvent::OverlayChanged { overlay: OverlayMode::Black },
                DeltaEvent::AlertChanged {
                    alert: Some(Alert { text: "a".into(), is_ticker: false }),
                },
            ],
        };
        surface.deliver(&delta);
        let names: Vec<String> = rec
            .drain()
            .into_iter()
            .map(|(n, _)| n)
            .collect();
        assert_eq!(
            names,
            vec!["slide-changed", "slide-context", "overlay-changed"],
            "emit order must be slide-* → slide-context → overlay-changed"
        );
    }
}
