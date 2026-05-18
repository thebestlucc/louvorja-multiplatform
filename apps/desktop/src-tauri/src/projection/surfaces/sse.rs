use crate::commands::streaming::{
    build_music_stream_payload, build_return_stream_payload, empty_return_stream_payload,
    empty_streaming_music_payload,
};
use crate::db::models::{SlideContent, SlideContext};
use crate::projection::delta::{DeltaEvent, ProjectionDelta};
use crate::projection::hub::ProjectionHub;
use crate::projection::snapshot::ProjectionSnapshot;
use crate::projection::state::{Alert, OverlayMode};
use crate::projection::surface::ProjectionSurface;
use crate::streaming::SseBroadcaster;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Output channel of the SSE surface. Used by `materialize_snapshot_for` so
/// the HTTP `/state/*` endpoints get the same payload shape the live SSE
/// broadcaster would emit on the next change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SseChannel {
    Music,
    Bible,
    Return,
    Alert,
}

/// State cache so a single-event delta (e.g. ContextChanged alone) can still
/// produce a coherent music/return payload that mixes slide + context.
#[derive(Default)]
struct PayloadCache {
    slide: Option<SlideContent>,
    context: Option<SlideContext>,
    alert: Option<Alert>,
    overlay: OverlayMode,
    frozen: bool,
}

impl PayloadCache {
    fn replace_from_snapshot(&mut self, snapshot: &ProjectionSnapshot) {
        self.slide = snapshot.current_slide.clone();
        self.context = snapshot.context.clone();
        self.alert = snapshot.alert.clone();
        self.overlay = snapshot.overlay.clone();
        self.frozen = snapshot.frozen;
    }
}

pub struct SseSurface {
    music: Arc<SseBroadcaster>,
    bible: Arc<SseBroadcaster>,
    return_: Arc<SseBroadcaster>,
    alert: Arc<SseBroadcaster>,
    hub: Arc<ProjectionHub>,
    app_data_dir: Option<PathBuf>,
    cache: Mutex<PayloadCache>,
}

impl SseSurface {
    pub fn new(
        music: Arc<SseBroadcaster>,
        bible: Arc<SseBroadcaster>,
        return_: Arc<SseBroadcaster>,
        alert: Arc<SseBroadcaster>,
        hub: Arc<ProjectionHub>,
        app_data_dir: Option<PathBuf>,
    ) -> Arc<Self> {
        Arc::new(Self {
            music,
            bible,
            return_,
            alert,
            hub,
            app_data_dir,
            cache: Mutex::new(PayloadCache::default()),
        })
    }

    /// Connect-time materialization: build the current payload for `channel`
    /// straight from the Hub. Replaces the old `SseBroadcaster::latest_message`
    /// sticky-replay hack. Called from the sync HTTP handler via `block_on`.
    pub fn materialize_snapshot_for(&self, channel: SseChannel) -> String {
        let snapshot = tauri::async_runtime::block_on(async {
            let (s, _rx) = self.hub.attach().await;
            s
        });
        self.payload_for(
            channel,
            &snapshot.current_slide,
            &snapshot.context,
            &snapshot.alert,
            &snapshot.overlay,
            snapshot.frozen,
        )
    }

    fn payload_for(
        &self,
        channel: SseChannel,
        slide: &Option<SlideContent>,
        context: &Option<SlideContext>,
        alert: &Option<Alert>,
        overlay: &OverlayMode,
        frozen: bool,
    ) -> String {
        match channel {
            SseChannel::Music => {
                music_payload(slide, context, overlay, frozen, self.app_data_dir.as_deref())
            }
            SseChannel::Bible => bible_payload(slide, overlay, frozen),
            SseChannel::Return => {
                return_payload(slide, context, overlay, frozen, self.app_data_dir.as_deref())
            }
            SseChannel::Alert => alert_payload(alert),
        }
    }

    fn broadcast_slide_set(&self) {
        let cache = self.cache.lock().unwrap();
        let slide = cache.slide.clone();
        let context = cache.context.clone();
        let overlay = cache.overlay.clone();
        let frozen = cache.frozen;
        drop(cache);
        let adr = self.app_data_dir.as_deref();
        self.music
            .broadcast(&music_payload(&slide, &context, &overlay, frozen, adr));
        self.bible.broadcast(&bible_payload(&slide, &overlay, frozen));
        self.return_
            .broadcast(&return_payload(&slide, &context, &overlay, frozen, adr));
    }

    fn broadcast_alert(&self) {
        let cache = self.cache.lock().unwrap();
        let alert = cache.alert.clone();
        drop(cache);
        self.alert.broadcast(&alert_payload(&alert));
    }
}

impl ProjectionSurface for SseSurface {
    fn hydrate(&self, snapshot: &ProjectionSnapshot) {
        self.cache.lock().unwrap().replace_from_snapshot(snapshot);
        self.broadcast_slide_set();
        self.broadcast_alert();
    }

    fn deliver(&self, delta: &ProjectionDelta) {
        let mut slide_touched = false;
        let mut alert_touched = false;
        {
            let mut cache = self.cache.lock().unwrap();
            for event in &delta.events {
                match event {
                    DeltaEvent::SlideChanged { slide } => {
                        cache.slide = slide.clone();
                        slide_touched = true;
                    }
                    DeltaEvent::ContextChanged { context } => {
                        cache.context = context.clone();
                        slide_touched = true;
                    }
                    DeltaEvent::AlertChanged { alert } => {
                        cache.alert = alert.clone();
                        alert_touched = true;
                    }
                    DeltaEvent::OverlayChanged { overlay } => {
                        cache.overlay = overlay.clone();
                        slide_touched = true;
                    }
                    DeltaEvent::FreezeChanged { frozen } => {
                        cache.frozen = *frozen;
                        slide_touched = true;
                    }
                }
            }
        }
        if slide_touched {
            self.broadcast_slide_set();
        }
        if alert_touched {
            self.broadcast_alert();
        }
    }

    fn is_alive(&self) -> bool {
        self.music.has_subscribers()
            || self.bible.has_subscribers()
            || self.return_.has_subscribers()
            || self.alert.has_subscribers()
    }
}

fn music_payload(
    slide: &Option<SlideContent>,
    context: &Option<SlideContext>,
    overlay: &OverlayMode,
    frozen: bool,
    app_data_dir: Option<&std::path::Path>,
) -> String {
    let mut payload = match slide {
        Some(s) if s.slide_type() == "bible" => empty_streaming_music_payload(),
        Some(s) => build_music_stream_payload(s, context.as_ref(), app_data_dir),
        None => empty_streaming_music_payload(),
    };
    inject_overlay_freeze(&mut payload, overlay, frozen);
    payload.to_string()
}

fn bible_payload(slide: &Option<SlideContent>, overlay: &OverlayMode, frozen: bool) -> String {
    let mut payload = match slide {
        Some(s) if s.slide_type() == "bible" => serde_json::json!({
            "reference": s.title().or_else(|| s.label()).unwrap_or(""),
            "text": s.text().unwrap_or(""),
        }),
        _ => serde_json::json!({ "reference": "", "text": "" }),
    };
    inject_overlay_freeze(&mut payload, overlay, frozen);
    payload.to_string()
}

fn return_payload(
    slide: &Option<SlideContent>,
    context: &Option<SlideContext>,
    overlay: &OverlayMode,
    frozen: bool,
    app_data_dir: Option<&std::path::Path>,
) -> String {
    let mut payload = match slide {
        Some(s) => build_return_stream_payload(s, context.as_ref(), app_data_dir),
        None => empty_return_stream_payload(),
    };
    inject_overlay_freeze(&mut payload, overlay, frozen);
    payload.to_string()
}

fn overlay_label(overlay: &OverlayMode) -> &'static str {
    match overlay {
        OverlayMode::None => "none",
        OverlayMode::Black => "black",
        OverlayMode::Logo => "logo",
    }
}

fn inject_overlay_freeze(payload: &mut serde_json::Value, overlay: &OverlayMode, frozen: bool) {
    if let Some(map) = payload.as_object_mut() {
        map.insert("overlay".to_string(), serde_json::json!(overlay_label(overlay)));
        map.insert("frozen".to_string(), serde_json::json!(frozen));
    }
}

fn alert_payload(alert: &Option<Alert>) -> String {
    match alert {
        Some(a) => serde_json::json!({
            "text": a.text,
            "isVisible": true,
            "isTicker": a.is_ticker,
        })
        .to_string(),
        None => serde_json::json!({
            "text": "",
            "isVisible": false,
            "isTicker": false,
        })
        .to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::slides::{BackgroundConfig, BackgroundKind, BibleMode};
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

    fn bible_slide(reference: &str, text: &str) -> SlideContent {
        SlideContent::Bible {
            reference: reference.to_string(),
            text: text.to_string(),
            background: BackgroundConfig {
                kind: BackgroundKind::Solid,
                color: Some("#000".into()),
                ..Default::default()
            },
            text_color: None,
            text_size: None,
            mode: BibleMode::default(),
        }
    }

    /// Build an SseSurface backed by fresh empty broadcasters and a fresh Hub.
    fn build() -> (
        Arc<SseSurface>,
        Arc<ProjectionHub>,
        Arc<SseBroadcaster>,
        Arc<SseBroadcaster>,
        Arc<SseBroadcaster>,
        Arc<SseBroadcaster>,
    ) {
        let music = Arc::new(SseBroadcaster::new());
        let bible = Arc::new(SseBroadcaster::new());
        let return_ = Arc::new(SseBroadcaster::new());
        let alert = Arc::new(SseBroadcaster::new());
        let hub = ProjectionHub::new();
        let surface = SseSurface::new(
            music.clone(),
            bible.clone(),
            return_.clone(),
            alert.clone(),
            hub.clone(),
            None,
        );
        (surface, hub, music, bible, return_, alert)
    }

    /// Subscribe to a broadcaster and collect every message it receives.
    /// Caller should drop the receiver after asserting.
    fn subscribe(bc: &Arc<SseBroadcaster>) -> std::sync::mpsc::Receiver<String> {
        let (_id, rx) = bc.subscribe();
        rx
    }

    fn collect_all(rx: &std::sync::mpsc::Receiver<String>) -> Vec<String> {
        rx.try_iter().collect()
    }

    #[test]
    fn hydrate_with_lyrics_fills_music_empties_bible() {
        let (surface, _hub, music, bible, return_, _alert) = build();
        let m_rx = subscribe(&music);
        let b_rx = subscribe(&bible);
        let r_rx = subscribe(&return_);
        let snapshot = ProjectionSnapshot {
            version: 1,
            current_slide: Some(lyrics("Amazing grace")),
            context: None,
            overlay: crate::projection::state::OverlayMode::None,
            frozen: false,
            alert: None,
        };
        surface.hydrate(&snapshot);

        let m = collect_all(&m_rx).pop().expect("music broadcast");
        assert!(m.contains("Amazing grace"), "music must contain slide text: {m}");
        let b = collect_all(&b_rx).pop().expect("bible broadcast");
        assert!(b.contains(r#""reference":"""#), "bible must be empty for non-bible slide: {b}");
        let r = collect_all(&r_rx).pop().expect("return broadcast");
        assert!(r.contains("Amazing grace"), "return must contain slide text: {r}");
    }

    #[test]
    fn hydrate_with_bible_fills_bible_empties_music() {
        let (surface, _hub, music, bible, _return, _alert) = build();
        let m_rx = subscribe(&music);
        let b_rx = subscribe(&bible);
        let snapshot = ProjectionSnapshot {
            version: 1,
            current_slide: Some(bible_slide("John 3:16", "For God so loved the world")),
            context: None,
            overlay: crate::projection::state::OverlayMode::None,
            frozen: false,
            alert: None,
        };
        surface.hydrate(&snapshot);

        let b = collect_all(&b_rx).pop().expect("bible broadcast");
        assert!(b.contains("John 3:16"), "bible must contain reference: {b}");
        assert!(b.contains("For God so loved"));
        let m = collect_all(&m_rx).pop().expect("music broadcast");
        assert!(m.contains(r#""title":"""#), "music must be empty for bible slide: {m}");
    }

    #[tokio::test]
    async fn deliver_with_slide_and_context_in_one_delta_fires_each_channel_once() {
        let (surface, hub, music, bible, return_, _alert) = build();
        // Wire surface manually via hub.attach so we can drive deliver with a
        // controlled delta — bypasses the spawn loop for deterministic count.
        let (snapshot, mut rx) = hub.attach().await;
        surface.hydrate(&snapshot);

        // Subscribe per-channel AFTER hydrate so we only count messages from
        // the batch, not the initial hydrate fan-out.
        let (_m_id, m_rx) = music.subscribe();
        let (_b_id, b_rx) = bible.subscribe();
        let (_r_id, r_rx) = return_.subscribe();

        hub.apply_batch(vec![
            Mutation::SetSlide(Some(lyrics("verse"))),
            Mutation::SetContext(Some(SlideContext {
                next: None,
                index: 1,
                total: 3,
                title: "Hymn".into(),
                current_slide_start_ms: None,
                next_slide_start_ms: None,
                audio_duration_ms: None,
            })),
        ])
        .await
        .unwrap();
        let delta = rx.recv().await.expect("delta");
        surface.deliver(&delta);

        assert_eq!(m_rx.try_iter().count(), 1, "music must fire exactly once");
        assert_eq!(b_rx.try_iter().count(), 1, "bible must fire exactly once");
        assert_eq!(r_rx.try_iter().count(), 1, "return must fire exactly once");
    }

    #[tokio::test]
    async fn deliver_overlay_change_rebroadcasts_slide_channels_with_overlay_field() {
        let (surface, hub, music, _bible, return_, _alert) = build();
        hub.apply(Mutation::SetSlide(Some(lyrics("verse")))).await.unwrap();
        let (snapshot, mut rx) = hub.attach().await;
        surface.hydrate(&snapshot);

        let (_m_id, m_rx) = music.subscribe();
        let (_r_id, r_rx) = return_.subscribe();

        hub.apply(Mutation::SetOverlay(OverlayMode::Black)).await.unwrap();
        let delta = rx.recv().await.expect("overlay delta");
        surface.deliver(&delta);

        let m = m_rx.try_iter().next().expect("music broadcast on overlay");
        assert!(m.contains(r#""overlay":"black""#), "music must include overlay=black: {m}");
        let r = r_rx.try_iter().next().expect("return broadcast on overlay");
        assert!(r.contains(r#""overlay":"black""#), "return must include overlay=black: {r}");
    }

    #[tokio::test]
    async fn deliver_freeze_change_rebroadcasts_slide_channels_with_frozen_field() {
        let (surface, hub, music, _bible, return_, _alert) = build();
        // Seed slide BEFORE attach so hydrate sees it.
        hub.apply(Mutation::SetSlide(Some(lyrics("verse")))).await.unwrap();
        let (snapshot, mut rx) = hub.attach().await;
        surface.hydrate(&snapshot);

        // Subscribe AFTER hydrate so we only count delivery-driven broadcasts.
        let (_m_id, m_rx) = music.subscribe();
        let (_r_id, r_rx) = return_.subscribe();

        hub.apply(Mutation::SetFreeze(true)).await.unwrap();
        let delta = rx.recv().await.expect("freeze delta");
        surface.deliver(&delta);

        let m = m_rx.try_iter().next().expect("music broadcast on freeze");
        assert!(m.contains(r#""frozen":true"#), "music must include frozen=true: {m}");
        let r = r_rx.try_iter().next().expect("return broadcast on freeze");
        assert!(r.contains(r#""frozen":true"#), "return must include frozen=true: {r}");
    }

    #[test]
    fn is_alive_false_when_no_subscribers() {
        let (surface, _hub, _m, _b, _r, _a) = build();
        assert!(!surface.is_alive());
    }

    #[test]
    fn is_alive_true_when_any_broadcaster_has_subscriber() {
        let (surface, _hub, _m, bible, _r, _a) = build();
        let (_id, _rx) = bible.subscribe();
        assert!(surface.is_alive());
    }
}
