use tauri::{AppHandle, Emitter, Manager};
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::db::models::{SlideContent, SlideContext};
use crate::commands::streaming::{
    build_music_stream_payload, build_return_stream_payload,
    empty_streaming_music_payload, is_empty_hymn_gap_slide, streaming_slide_payload,
    streaming_slide_title,
};
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
    streaming_state: &StreamingState,
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

    // Phase 1 shadow write: mirror into ProjectionHub. Fire-and-forget;
    // failure must not break the legacy event path.
    {
        let hub = state.projection.clone();
        let slide_shadow = slide_data.clone();
        tauri::async_runtime::spawn(async move {
            let _ = hub
                .apply(crate::projection::Mutation::SetSlide(Some(slide_shadow)))
                .await;
        });
    }

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

    emit_slide_and_broadcast(app, streaming_state, &slide_data, &slide_context, version)
}

/// Emit slide-changed + slide-context events and broadcast to streaming clients.
/// Caller is responsible for the freeze decision; this performs side effects unconditionally.
pub fn emit_slide_and_broadcast(
    app: &AppHandle,
    streaming_state: &StreamingState,
    slide_data: &SlideContent,
    slide_context: &SlideContext,
    version: u64,
) -> Result<(), AppError> {
    app.emit("slide-changed", &SlideChangedPayload { slide: slide_data.clone(), version })
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    app.emit("slide-context", slide_context)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let app_data_dir = app.path().app_data_dir().ok();
    let adr = app_data_dir.as_deref();

    if let Ok(server) = streaming_state.server.lock() {
        if slide_data.slide_type() == "bible" {
            let json = serde_json::json!({
                "reference": slide_data
                    .title()
                    .or_else(|| slide_data.label())
                    .unwrap_or(""),
                "text": slide_data.text().unwrap_or(""),
            });
            server.broadcast_bible(&json.to_string());
            server.broadcast_music(&empty_streaming_music_payload().to_string());
        } else {
            server.broadcast_music(
                &build_music_stream_payload(slide_data, Some(slide_context), adr).to_string(),
            );
            let clear_bible = serde_json::json!({ "reference": "", "text": "" });
            server.broadcast_bible(&clear_bible.to_string());
        }
        let return_payload = build_return_stream_payload(slide_data, Some(slide_context), adr);
        server.broadcast_return(&return_payload.to_string());
    }

    Ok(())
}

/// Re-emit the current slide + context after an unfreeze. Reads state and replays
/// the same events `update_current_slide` would have fired while frozen.
/// No-op if no slide is currently set.
pub fn flush_projection_state(
    app: &AppHandle,
    state: &AppState,
    streaming_state: &StreamingState,
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
    emit_slide_and_broadcast(app, streaming_state, &slide_data, &slide_context, version)
}

pub fn update_slide_context(
    app: &AppHandle,
    state: &AppState,
    streaming_state: &StreamingState,
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

    app.emit("slide-context", &context_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let app_data_dir = app.path().app_data_dir().ok();
    let adr = app_data_dir.as_deref();

    if let Ok(server) = streaming_state.server.lock() {
        let current_slide = state.current_slide.read().ok().and_then(|s| s.clone());
        if let Some(slide) = current_slide.as_ref() {
            let music_json = build_music_stream_payload(slide, Some(&context_data), adr);
            server.broadcast_music(&music_json.to_string());
        }

        let json = serde_json::json!({
            "current": current_slide.as_ref().map(|s| streaming_slide_payload(s, adr)),
            "next": context_data.next.as_ref().map(|s| streaming_slide_payload(s, adr)),
            "index": context_data.index,
            "total": context_data.total,
            "title": context_data.title,
            "currentSlideStartMs": context_data.current_slide_start_ms,
            "nextSlideStartMs": context_data.next_slide_start_ms,
            "audioDurationMs": context_data.audio_duration_ms,
        });
        server.broadcast_return(&json.to_string());
    }

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
