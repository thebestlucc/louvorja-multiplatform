use super::delta::{DeltaEvent, ProjectionDelta};
use super::mutation::Mutation;
use super::snapshot::ProjectionSnapshot;
use super::state::{OverlayMode, ProjectionState};
use crate::error::AppError;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};

const BROADCAST_CAPACITY: usize = 256;

/// Single owner of Projection State. Mutates state, emits Deltas, hands out
/// Snapshots to attaching Surfaces. Does not render, does not know about
/// transports or URL schemes.
pub struct ProjectionHub {
    state: Mutex<ProjectionState>,
    tx: broadcast::Sender<ProjectionDelta>,
}

impl ProjectionHub {
    pub fn new() -> Arc<Self> {
        let (tx, _rx) = broadcast::channel(BROADCAST_CAPACITY);
        Arc::new(Self {
            state: Mutex::new(ProjectionState::new()),
            tx,
        })
    }

    /// Funnel for state change. One Mutation → at most one Delta with
    /// `Vec<DeltaEvent>`. No-op mutations (target equals current) do not
    /// bump version and do not emit.
    pub async fn apply(self: &Arc<Self>, m: Mutation) -> Result<(), AppError> {
        self.apply_batch(vec![m]).await
    }

    /// Apply a batch atomically: one version bump, one Delta carrying every
    /// Event that changed at least one field. No-op fields are filtered out;
    /// if all Mutations are no-ops, no version bump and no Delta.
    pub async fn apply_batch(self: &Arc<Self>, ms: Vec<Mutation>) -> Result<(), AppError> {
        let mut state = self.state.lock().await;
        let from_version = state.version;
        let mut events: Vec<DeltaEvent> = Vec::new();

        for m in ms {
            for event in mutation_to_events(m) {
                if apply_event_if_changed(&mut state, &event) {
                    merge_event(&mut events, event);
                }
            }
        }

        if events.is_empty() {
            return Ok(());
        }

        state.version = from_version + 1;
        let delta = ProjectionDelta {
            from_version,
            to_version: state.version,
            events,
        };
        // Receivers may have dropped; broadcast errors silently when no
        // subscribers are alive. That's expected, not a failure.
        let _ = self.tx.send(delta);
        Ok(())
    }

    /// Attach as a Surface: return a snapshot of current state and a
    /// receiver for subsequent Deltas. Atomic — the subscription is
    /// created before the state lock is released, so no Delta can be
    /// applied between snapshot and subscribe.
    #[allow(dead_code)] // Phase 2 entry point for SseSurface.
    pub async fn attach(
        self: &Arc<Self>,
    ) -> (ProjectionSnapshot, broadcast::Receiver<ProjectionDelta>) {
        let state = self.state.lock().await;
        let rx = self.tx.subscribe();
        let snapshot = ProjectionSnapshot::from_state(&state);
        (snapshot, rx)
    }
}

fn mutation_to_events(m: Mutation) -> Vec<DeltaEvent> {
    match m {
        Mutation::SetSlide(slide) => vec![DeltaEvent::SlideChanged { slide }],
        Mutation::SetOverlay(overlay) => vec![DeltaEvent::OverlayChanged { overlay }],
        Mutation::SetFreeze(frozen) => vec![DeltaEvent::FreezeChanged { frozen }],
        Mutation::SetAlert(alert) => vec![DeltaEvent::AlertChanged { alert }],
        Mutation::ClearAll => vec![
            DeltaEvent::SlideChanged { slide: None },
            DeltaEvent::OverlayChanged { overlay: OverlayMode::None },
            DeltaEvent::AlertChanged { alert: None },
        ],
    }
}

/// Apply event to state if it would change a field. Returns true when the
/// event actually changed something. Used for no-op filtering inside a batch.
fn apply_event_if_changed(state: &mut ProjectionState, event: &DeltaEvent) -> bool {
    match event {
        DeltaEvent::SlideChanged { slide } => {
            if slides_equal(&state.current_slide, slide) {
                false
            } else {
                state.current_slide = slide.clone();
                true
            }
        }
        DeltaEvent::OverlayChanged { overlay } => {
            if state.overlay == *overlay {
                false
            } else {
                state.overlay = overlay.clone();
                true
            }
        }
        DeltaEvent::FreezeChanged { frozen } => {
            if state.frozen == *frozen {
                false
            } else {
                state.frozen = *frozen;
                true
            }
        }
        DeltaEvent::AlertChanged { alert } => {
            if state.alert == *alert {
                false
            } else {
                state.alert = alert.clone();
                true
            }
        }
    }
}

/// Merge a new event into the in-progress event list for a batch: replace
/// a previous event of the same kind so the Delta carries one final value
/// per field (callers observing a batch see one coherent transition).
fn merge_event(events: &mut Vec<DeltaEvent>, new: DeltaEvent) {
    let kind = event_discriminant(&new);
    if let Some(pos) = events.iter().position(|e| event_discriminant(e) == kind) {
        events[pos] = new;
    } else {
        events.push(new);
    }
}

fn event_discriminant(e: &DeltaEvent) -> u8 {
    match e {
        DeltaEvent::SlideChanged { .. } => 0,
        DeltaEvent::OverlayChanged { .. } => 1,
        DeltaEvent::FreezeChanged { .. } => 2,
        DeltaEvent::AlertChanged { .. } => 3,
    }
}

/// SlideContent does not derive PartialEq (BackgroundConfig and friends are
/// complex). For no-op detection, compare serialized form. Cheap enough for
/// the projection mutation path (single slide per mutation, rare relative
/// to render).
fn slides_equal(
    a: &Option<crate::db::models::SlideContent>,
    b: &Option<crate::db::models::SlideContent>,
) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(x), Some(y)) => serde_json::to_value(x).ok() == serde_json::to_value(y).ok(),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::slides::{BackgroundConfig, BackgroundKind};
    use crate::db::models::SlideContent;
    use crate::projection::state::Alert;

    fn lyrics(text: &str) -> SlideContent {
        SlideContent::Lyrics {
            text: text.to_string(),
            label: None,
            background: BackgroundConfig {
                kind: BackgroundKind::Solid,
                color: Some("#000".to_string()),
                ..Default::default()
            },
            text_color: None,
            text_size: None,
        }
    }

    #[tokio::test]
    async fn apply_bumps_version_and_emits_delta() {
        let hub = ProjectionHub::new();
        let (snapshot, mut rx) = hub.attach().await;
        assert_eq!(snapshot.version, 0);

        hub.apply(Mutation::SetFreeze(true)).await.unwrap();

        let delta = rx.recv().await.expect("delta should arrive");
        assert_eq!(delta.from_version, 0);
        assert_eq!(delta.to_version, 1);
        assert_eq!(delta.events.len(), 1);
        match &delta.events[0] {
            DeltaEvent::FreezeChanged { frozen } => assert!(*frozen),
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[tokio::test]
    async fn noop_mutation_does_not_bump_version_or_emit() {
        let hub = ProjectionHub::new();
        let (_snapshot, mut rx) = hub.attach().await;

        // Fresh hub: frozen is already false. SetFreeze(false) is a no-op.
        hub.apply(Mutation::SetFreeze(false)).await.unwrap();

        let (snapshot, _rx2) = hub.attach().await;
        assert_eq!(snapshot.version, 0, "version must not bump on no-op");
        assert!(
            rx.try_recv().is_err(),
            "no Delta must be emitted for a no-op"
        );
    }

    #[tokio::test]
    async fn apply_batch_emits_single_delta_with_merged_events() {
        let hub = ProjectionHub::new();
        let (_snapshot, mut rx) = hub.attach().await;

        hub.apply_batch(vec![
            Mutation::SetFreeze(true),
            Mutation::SetSlide(Some(lyrics("verse 1"))),
            Mutation::SetOverlay(OverlayMode::Black),
        ])
        .await
        .unwrap();

        let delta = rx.recv().await.expect("one delta expected");
        assert_eq!(delta.from_version, 0);
        assert_eq!(delta.to_version, 1, "batch must bump version exactly once");
        assert_eq!(delta.events.len(), 3);
        assert!(
            rx.try_recv().is_err(),
            "batch must produce exactly one Delta"
        );
    }

    #[tokio::test]
    async fn apply_batch_merges_repeated_event_kinds() {
        let hub = ProjectionHub::new();
        let (_snapshot, mut rx) = hub.attach().await;

        // Two SetFreeze in one batch: final value wins, single FreezeChanged
        // event in the Delta.
        hub.apply_batch(vec![Mutation::SetFreeze(true), Mutation::SetFreeze(false)])
            .await
            .unwrap();

        // First mutation flips false→true, second flips true→false. Both
        // change state, but the merged Delta carries one FreezeChanged with
        // the final value (false). Net effect on state: also false. Since
        // batch did make at least one transition, version bumps.
        let delta = rx.recv().await.expect("delta should arrive");
        assert_eq!(delta.to_version, 1);
        assert_eq!(delta.events.len(), 1);
        match &delta.events[0] {
            DeltaEvent::FreezeChanged { frozen } => {
                assert!(!*frozen, "merged event must carry final value")
            }
            other => panic!("unexpected event: {:?}", other),
        }
    }

    #[tokio::test]
    async fn attach_returns_current_state_and_live_receiver() {
        let hub = ProjectionHub::new();
        hub.apply(Mutation::SetAlert(Some(Alert {
            text: "hello".into(),
            is_ticker: false,
        })))
        .await
        .unwrap();

        let (snapshot, mut rx) = hub.attach().await;
        assert_eq!(snapshot.version, 1);
        assert_eq!(snapshot.alert.as_ref().unwrap().text, "hello");

        hub.apply(Mutation::SetFreeze(true)).await.unwrap();
        let delta = rx.recv().await.unwrap();
        assert_eq!(delta.from_version, 1);
        assert_eq!(delta.to_version, 2);
    }

    #[tokio::test]
    async fn recovery_rule_detects_version_gap() {
        let hub = ProjectionHub::new();
        let (snapshot, mut rx) = hub.attach().await;
        let mut local_version = snapshot.version;

        hub.apply(Mutation::SetFreeze(true)).await.unwrap();
        let delta1 = rx.recv().await.unwrap();
        // Apply locally.
        assert_eq!(delta1.from_version, local_version);
        local_version = delta1.to_version;

        // Simulate a dropped delta: hub applies but local doesn't consume.
        hub.apply(Mutation::SetOverlay(OverlayMode::Logo))
            .await
            .unwrap();
        let _dropped = rx.recv().await.unwrap();

        hub.apply(Mutation::SetSlide(Some(lyrics("v2"))))
            .await
            .unwrap();
        let delta3 = rx.recv().await.unwrap();

        // Local missed delta2. delta3.from_version != local_version → gap detected.
        assert_ne!(
            delta3.from_version, local_version,
            "version gap must be detectable to trigger re-hydrate"
        );
    }

    #[tokio::test]
    async fn clear_all_resets_slide_overlay_and_alert() {
        let hub = ProjectionHub::new();
        hub.apply_batch(vec![
            Mutation::SetSlide(Some(lyrics("v1"))),
            Mutation::SetOverlay(OverlayMode::Black),
            Mutation::SetAlert(Some(Alert {
                text: "alert".into(),
                is_ticker: true,
            })),
            Mutation::SetFreeze(true),
        ])
        .await
        .unwrap();

        hub.apply(Mutation::ClearAll).await.unwrap();

        let (snapshot, _rx) = hub.attach().await;
        assert!(snapshot.current_slide.is_none());
        assert_eq!(snapshot.overlay, OverlayMode::None);
        assert!(snapshot.alert.is_none());
        assert!(snapshot.frozen, "ClearAll must NOT touch frozen");
    }

    /// Compile-time mutual exclusion: OverlayMode can hold exactly one
    /// variant. The previous two-bool representation could not encode this.
    #[test]
    fn overlay_mode_is_mutually_exclusive_by_construction() {
        let modes = [OverlayMode::None, OverlayMode::Black, OverlayMode::Logo];
        for m in &modes {
            let equal_count = modes.iter().filter(|other| *other == m).count();
            assert_eq!(equal_count, 1);
        }
    }

    /// Compare serialized value to fixture parsed as JSON value. Whitespace
    /// and field ordering differences inside the file don't matter — only
    /// structural equality. The fixture is the cross-process contract.
    fn assert_matches_fixture<T: serde::Serialize>(value: &T, fixture: &str) {
        let actual: serde_json::Value = serde_json::to_value(value).unwrap();
        let expected: serde_json::Value = serde_json::from_str(fixture)
            .expect("fixture must be valid JSON");
        assert_eq!(
            actual, expected,
            "\nactual:\n{}\n\nexpected:\n{}\n",
            serde_json::to_string_pretty(&actual).unwrap(),
            serde_json::to_string_pretty(&expected).unwrap()
        );
    }

    #[test]
    fn snapshot_empty_matches_fixture() {
        let snapshot = ProjectionSnapshot {
            version: 0,
            current_slide: None,
            overlay: OverlayMode::None,
            frozen: false,
            alert: None,
        };
        assert_matches_fixture(
            &snapshot,
            include_str!("fixtures/snapshots/empty.json"),
        );
    }

    #[test]
    fn snapshot_slide_hymn_matches_fixture() {
        let snapshot = ProjectionSnapshot {
            version: 5,
            current_slide: Some(SlideContent::Lyrics {
                text: "Amazing grace, how sweet the sound".to_string(),
                label: Some("verse 1".to_string()),
                background: BackgroundConfig {
                    kind: BackgroundKind::Solid,
                    color: Some("#000000".to_string()),
                    ..Default::default()
                },
                text_color: None,
                text_size: None,
            }),
            overlay: OverlayMode::None,
            frozen: false,
            alert: None,
        };
        assert_matches_fixture(
            &snapshot,
            include_str!("fixtures/snapshots/slide-hymn.json"),
        );
    }

    #[test]
    fn delta_slide_changed_matches_fixture() {
        let delta = ProjectionDelta {
            from_version: 4,
            to_version: 5,
            events: vec![DeltaEvent::SlideChanged {
                slide: Some(SlideContent::Lyrics {
                    text: "Amazing grace, how sweet the sound".to_string(),
                    label: Some("verse 1".to_string()),
                    background: BackgroundConfig {
                        kind: BackgroundKind::Solid,
                        color: Some("#000000".to_string()),
                        ..Default::default()
                    },
                    text_color: None,
                    text_size: None,
                })
            }],
        };
        assert_matches_fixture(
            &delta,
            include_str!("fixtures/deltas/slide-changed.json"),
        );
    }

    #[test]
    fn delta_batch_clear_all_matches_fixture() {
        let delta = ProjectionDelta {
            from_version: 5,
            to_version: 6,
            events: vec![
                DeltaEvent::SlideChanged { slide: None },
                DeltaEvent::OverlayChanged { overlay: OverlayMode::None },
                DeltaEvent::AlertChanged { alert: None },
            ],
        };
        assert_matches_fixture(
            &delta,
            include_str!("fixtures/deltas/batch-clear-all.json"),
        );
    }
}
