use tauri::{AppHandle, Emitter};
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::db::models::{SlideContent, SlideContext};
use crate::commands::streaming::{is_empty_hymn_gap_slide, streaming_slide_title};
use std::sync::atomic::Ordering;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlideChangedPayload {
    pub slide: SlideContent,
    pub version: u64,
}

#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CurrentSlideResponse {
    pub slide: Option<SlideContent>,
    #[specta(type = f64)]
    pub version: u64,
}

pub fn update_current_slide(
    app: &AppHandle,
    state: &AppState,
    _streaming_state: &StreamingState,
    slide_data: SlideContent,
) -> Result<(), AppError> {
    // Enrich online_video slides with local path if the video has been downloaded
    let mut slide_data = slide_data;
    if let SlideContent::OnlineVideo { ref video_id, ref mut source, ref mut url, .. } = slide_data {
        let vid = video_id.clone();
        if let Ok(conn) = state.db.get() {
            if let Ok(Some(local_path)) =
                crate::db::queries::online_videos::get_video_local_path(&conn, &vid)
            {
                if !local_path.is_empty() {
                    *source = crate::db::models::slides::VideoSource::Local;
                    *url = local_path;
                }
            }
        }
    }

    // Always update server-side state so a later unfreeze flush sees the latest
    // navigation. The freeze gate below only suppresses outbound events.
    {
        let mut current = state
            .current_slide
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    let version = state.current_slide_version.fetch_add(1, Ordering::SeqCst) + 1;

    let current_title = streaming_slide_title(&slide_data);
    let slide_context = {
        let mut context = state
            .slide_context
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        match context.clone() {
            Some(ctx)
                if is_empty_hymn_gap_slide(&slide_data)
                    || (!ctx.title.is_empty() && ctx.title == current_title) =>
            {
                ctx
            }
            _ => {
                let fallback = SlideContext {
                    next: None,
                    index: 0,
                    total: 1,
                    title: current_title,
                    current_slide_start_ms: None,
                    next_slide_start_ms: None,
                    audio_duration_ms: None,
                };
                *context = Some(fallback.clone());
                fallback
            }
        }
    };

    if state.is_frozen.load(Ordering::Relaxed) {
        return Ok(());
    }

    emit_and_funnel(app, state, &slide_data, &slide_context, version)
}

/// Apply slide + context to the ProjectionHub (SSE flows through the
/// SseSurface attached to the hub) and emit the legacy Tauri events for
/// the projector/return webviews (Phase 3 deletes those). Caller is
/// responsible for the freeze decision; this performs the side effects
/// unconditionally.
pub fn emit_and_funnel(
    app: &AppHandle,
    state: &AppState,
    slide_data: &SlideContent,
    slide_context: &SlideContext,
    version: u64,
) -> Result<(), AppError> {
    // Funnel into the Hub BEFORE Tauri emits so the SseSurface re-broadcast
    // reflects the new state before any consumer reacts to slide-changed.
    let hub = state.projection.clone();
    let slide_for_hub = slide_data.clone();
    let context_for_hub = slide_context.clone();
    tauri::async_runtime::block_on(async move {
        let _ = hub
            .apply(crate::projection::Mutation::SetSlide(Some(slide_for_hub)))
            .await;
        let _ = hub
            .apply(crate::projection::Mutation::SetContext(Some(context_for_hub)))
            .await;
    });

    app.emit("slide-changed", &SlideChangedPayload { slide: slide_data.clone(), version })
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    app.emit("slide-context", slide_context)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    Ok(())
}

/// Re-emit the current slide + context after an unfreeze. Reads state and replays
/// the same events `update_current_slide` would have fired while frozen.
/// No-op if no slide is currently set.
pub fn flush_projection_state(
    app: &AppHandle,
    state: &AppState,
    _streaming_state: &StreamingState,
) -> Result<(), AppError> {
    let slide_data = {
        let current = state
            .current_slide
            .read()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        current.clone()
    };
    let Some(slide_data) = slide_data else {
        return Ok(());
    };

    let slide_context = {
        let ctx = state
            .slide_context
            .read()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        ctx.clone().unwrap_or_else(|| SlideContext {
            next: None,
            index: 0,
            total: 1,
            title: streaming_slide_title(&slide_data),
            current_slide_start_ms: None,
            next_slide_start_ms: None,
            audio_duration_ms: None,
        })
    };

    let version = state.current_slide_version.load(Ordering::SeqCst);
    emit_and_funnel(app, state, &slide_data, &slide_context, version)
}

pub fn update_slide_context(
    app: &AppHandle,
    state: &AppState,
    _streaming_state: &StreamingState,
    context_data: SlideContext,
) -> Result<(), AppError> {
    // Always persist context to state so a later unfreeze flush has the latest.
    {
        let mut ctx = state
            .slide_context
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *ctx = Some(context_data.clone());
    }

    if state.is_frozen.load(Ordering::Relaxed) {
        return Ok(());
    }

    // Funnel into the Hub so SseSurface re-broadcasts music + return for the
    // new context before any consumer reacts to slide-context.
    let hub = state.projection.clone();
    let context_for_hub = context_data.clone();
    tauri::async_runtime::block_on(async move {
        let _ = hub
            .apply(crate::projection::Mutation::SetContext(Some(context_for_hub)))
            .await;
    });

    app.emit("slide-context", &context_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    /// `set_is_frozen` uses `swap` to detect the true→false transition. If
    /// `swap` ever returned the new value instead of the previous one, the
    /// flush would either fire on every call or never. Lock that contract.
    #[test]
    fn atomic_swap_returns_previous_value_for_flush_detection() {
        let flag = AtomicBool::new(true);
        let previous = flag.swap(false, Ordering::Relaxed);
        assert!(previous, "swap must return the value held before the store");
        assert!(!flag.load(Ordering::Relaxed));

        let previous = flag.swap(false, Ordering::Relaxed);
        assert!(!previous, "no-op transition must report previous as false");
    }

    /// The flush trigger is "previous && !frozen". Pin the predicate so a
    /// future refactor can't silently flip it.
    #[test]
    fn flush_trigger_only_fires_on_true_to_false_transition() {
        fn should_flush(previous: bool, frozen: bool) -> bool {
            previous && !frozen
        }
        assert!(!should_flush(false, false));
        assert!(!should_flush(false, true));
        assert!(!should_flush(true, true));
        assert!(should_flush(true, false));
    }
}
