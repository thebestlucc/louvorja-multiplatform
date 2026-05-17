use super::delta::ProjectionDelta;
use super::hub::ProjectionHub;
use super::snapshot::ProjectionSnapshot;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::sync::oneshot;

/// A Projection output adapter. The Hub owns state and emits Deltas; a Surface
/// turns Deltas into transport-specific deliveries (HTTP SSE, Tauri events,
/// webview postMessage, etc.).
///
/// All methods are sync because Surfaces typically push into already-built
/// transports (broadcasters, emit channels). Long-running work must happen
/// off-thread inside the implementation.
pub trait ProjectionSurface: Send + Sync + 'static {
    /// Replay the full state. Called once on attach, and again on every
    /// recovery (version gap or lag).
    fn hydrate(&self, snapshot: &ProjectionSnapshot);

    /// Forward a Delta whose `from_version` matches the Surface's local
    /// version. `spawn_surface` enforces the recovery rule — implementations
    /// must not track their own version.
    fn deliver(&self, delta: &ProjectionDelta);

    /// True while the Surface can receive delivery. When false, `spawn_surface`
    /// stops materializing and skips deliver calls until it flips back.
    fn is_alive(&self) -> bool;
}

/// Blanket impl so an `Arc<S>` constructed via `S::new` (e.g. `SseSurface`)
/// can be handed to `spawn_surface` while the caller keeps another clone of
/// the same Arc for direct method access (e.g. `materialize_snapshot_for`).
impl<S: ProjectionSurface> ProjectionSurface for Arc<S> {
    fn hydrate(&self, snapshot: &ProjectionSnapshot) {
        (**self).hydrate(snapshot)
    }
    fn deliver(&self, delta: &ProjectionDelta) {
        (**self).deliver(delta)
    }
    fn is_alive(&self) -> bool {
        (**self).is_alive()
    }
}

/// Returned by `spawn_surface`. Dropping cancels the background task; the
/// task observes the cancellation between deltas and exits cleanly.
pub struct SurfaceHandle {
    cancel: Option<oneshot::Sender<()>>,
}

impl Drop for SurfaceHandle {
    fn drop(&mut self) {
        if let Some(tx) = self.cancel.take() {
            let _ = tx.send(());
        }
    }
}

/// Outcome of feeding one Delta to a Surface that holds `local_version`.
/// Universal recovery rule (ADR-0003): a Delta whose `from_version` does not
/// match the Surface's local version means a delta was lost — re-hydrate.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum SurfaceStep {
    Deliver(u64),
    Rehydrate,
}

pub(super) fn next_step(local_version: u64, delta: &ProjectionDelta) -> SurfaceStep {
    if delta.from_version == local_version {
        SurfaceStep::Deliver(delta.to_version)
    } else {
        SurfaceStep::Rehydrate
    }
}

/// Attach the surface to the hub and run a background loop:
///   - hydrate from the initial Snapshot
///   - on each Delta, apply the recovery rule; if gap or lag, re-attach +
///     re-hydrate; otherwise deliver and advance local version
///   - skip deliver while `is_alive` returns false (Hub still gets consumed
///     so the broadcast channel does not fill)
///   - exit when the returned `SurfaceHandle` is dropped or the Hub closes
pub fn spawn_surface<S: ProjectionSurface>(hub: Arc<ProjectionHub>, surface: S) -> SurfaceHandle {
    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    tauri::async_runtime::spawn(async move {
        run_surface_loop(hub, surface, cancel_rx).await;
    });
    SurfaceHandle {
        cancel: Some(cancel_tx),
    }
}

async fn run_surface_loop<S: ProjectionSurface>(
    hub: Arc<ProjectionHub>,
    surface: S,
    mut cancel_rx: oneshot::Receiver<()>,
) {
    let (mut snapshot, mut rx) = hub.attach().await;
    if surface.is_alive() {
        surface.hydrate(&snapshot);
    }
    let mut local_version = snapshot.version;

    loop {
        tokio::select! {
            _ = &mut cancel_rx => break,
            result = rx.recv() => {
                match result {
                    Ok(delta) => {
                        if !surface.is_alive() {
                            local_version = delta.to_version;
                            continue;
                        }
                        match next_step(local_version, &delta) {
                            SurfaceStep::Deliver(new_version) => {
                                surface.deliver(&delta);
                                local_version = new_version;
                            }
                            SurfaceStep::Rehydrate => {
                                let (s, r) = hub.attach().await;
                                snapshot = s;
                                rx = r;
                                surface.hydrate(&snapshot);
                                local_version = snapshot.version;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        let (s, r) = hub.attach().await;
                        snapshot = s;
                        rx = r;
                        surface.hydrate(&snapshot);
                        local_version = snapshot.version;
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::delta::DeltaEvent;
    use crate::projection::mutation::Mutation;
    use crate::projection::state::OverlayMode;
    use std::sync::Mutex;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    /// Recording surface. Captures every hydrate/deliver call for assertions
    /// and toggles `is_alive` via an external flag.
    struct RecordingSurface {
        hydrates: Arc<Mutex<Vec<u64>>>,
        deliveries: Arc<Mutex<Vec<ProjectionDelta>>>,
        alive: Arc<AtomicBool>,
    }

    impl ProjectionSurface for RecordingSurface {
        fn hydrate(&self, snapshot: &ProjectionSnapshot) {
            self.hydrates.lock().unwrap().push(snapshot.version);
        }
        fn deliver(&self, delta: &ProjectionDelta) {
            self.deliveries.lock().unwrap().push(delta.clone());
        }
        fn is_alive(&self) -> bool {
            self.alive.load(Ordering::SeqCst)
        }
    }

    fn make_recorder(alive: bool) -> (
        RecordingSurface,
        Arc<Mutex<Vec<u64>>>,
        Arc<Mutex<Vec<ProjectionDelta>>>,
        Arc<AtomicBool>,
    ) {
        let hydrates = Arc::new(Mutex::new(Vec::new()));
        let deliveries = Arc::new(Mutex::new(Vec::new()));
        let alive = Arc::new(AtomicBool::new(alive));
        let surface = RecordingSurface {
            hydrates: hydrates.clone(),
            deliveries: deliveries.clone(),
            alive: alive.clone(),
        };
        (surface, hydrates, deliveries, alive)
    }

    /// Helper: spin briefly so the spawned tokio task has a chance to run.
    async fn yield_for(ms: u64) {
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }

    #[test]
    fn next_step_delivers_when_versions_match() {
        let delta = ProjectionDelta {
            from_version: 7,
            to_version: 8,
            events: vec![DeltaEvent::FreezeChanged { frozen: true }],
        };
        assert_eq!(next_step(7, &delta), SurfaceStep::Deliver(8));
    }

    #[test]
    fn next_step_rehydrates_on_version_gap() {
        let delta = ProjectionDelta {
            from_version: 9,
            to_version: 10,
            events: vec![DeltaEvent::FreezeChanged { frozen: true }],
        };
        // local thought it was at 7 but the delta arrived from 9 → gap.
        assert_eq!(next_step(7, &delta), SurfaceStep::Rehydrate);
    }

    #[tokio::test]
    async fn spawn_surface_hydrates_then_delivers_each_apply() {
        let hub = ProjectionHub::new();
        let (surface, hydrates, deliveries, _alive) = make_recorder(true);
        let _handle = spawn_surface(hub.clone(), surface);

        yield_for(20).await;
        assert_eq!(hydrates.lock().unwrap().as_slice(), &[0]);

        hub.apply(Mutation::SetOverlay(OverlayMode::Black)).await.unwrap();
        hub.apply(Mutation::SetOverlay(OverlayMode::Logo)).await.unwrap();
        yield_for(20).await;

        let d = deliveries.lock().unwrap();
        assert_eq!(d.len(), 2);
        assert_eq!(d[0].to_version, 1);
        assert_eq!(d[1].to_version, 2);
    }

    #[tokio::test]
    async fn spawn_surface_skips_deliver_when_not_alive() {
        let hub = ProjectionHub::new();
        let (surface, _hydrates, deliveries, alive) = make_recorder(false);
        let _handle = spawn_surface(hub.clone(), surface);

        yield_for(20).await;
        hub.apply(Mutation::SetOverlay(OverlayMode::Black)).await.unwrap();
        yield_for(20).await;

        assert!(deliveries.lock().unwrap().is_empty(),
            "no deliver while is_alive=false");

        alive.store(true, Ordering::SeqCst);
        hub.apply(Mutation::SetOverlay(OverlayMode::Logo)).await.unwrap();
        yield_for(20).await;
        assert_eq!(deliveries.lock().unwrap().len(), 1,
            "deliver resumes when is_alive=true");
    }

    #[tokio::test]
    async fn dropping_handle_stops_the_loop() {
        let hub = ProjectionHub::new();
        let (surface, _h, deliveries, _alive) = make_recorder(true);
        let handle = spawn_surface(hub.clone(), surface);
        yield_for(20).await;

        drop(handle);
        // Give cancel a moment to propagate.
        yield_for(20).await;

        let before = deliveries.lock().unwrap().len();
        hub.apply(Mutation::SetOverlay(OverlayMode::Black)).await.unwrap();
        yield_for(20).await;
        let after = deliveries.lock().unwrap().len();
        assert_eq!(before, after, "no deliveries after handle dropped");
    }
}
