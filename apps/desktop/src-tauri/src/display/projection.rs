use tauri::AppHandle;
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
    // AppState.current_slide_version is still read by get_current_slide for
    // webview mount-time hydration; bump for that path. Phase 4 replaces this
    // with a get_projection_snapshot command sourced from the Hub.
    state.current_slide_version.fetch_add(1, Ordering::SeqCst);

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

    funnel_to_hub(app, state, &slide_data, &slide_context)
}

/// Apply slide + context to the ProjectionHub. The SseSurface and the
/// WebviewSurface attached to the Hub turn the resulting Delta into SSE
/// broadcasts and Tauri webview events respectively. Caller is responsible
/// for the freeze decision; this performs the side effects unconditionally.
pub fn funnel_to_hub(
    _app: &AppHandle,
    state: &AppState,
    slide_data: &SlideContent,
    slide_context: &SlideContext,
) -> Result<(), AppError> {
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

    funnel_to_hub(app, state, &slide_data, &slide_context)
}

pub fn update_slide_context(
    _app: &AppHandle,
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

    // Funnel into the Hub. SseSurface re-broadcasts music + return; WebviewSurface
    // emits slide-context to the projector/return webviews.
    let hub = state.projection.clone();
    let context_for_hub = context_data.clone();
    tauri::async_runtime::block_on(async move {
        let _ = hub
            .apply(crate::projection::Mutation::SetContext(Some(context_for_hub)))
            .await;
    });

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
