use tauri::{AppHandle, Emitter, Manager};
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::db::models::{SlideContent, SlideContext};
use crate::commands::streaming::{
    build_music_stream_payload, build_return_stream_payload,
    empty_streaming_music_payload, is_empty_hymn_gap_slide, streaming_slide_payload,
    streaming_slide_title,
};

pub fn update_current_slide(
    app: &AppHandle,
    state: &AppState,
    streaming_state: &StreamingState,
    slide_data: SlideContent,
) -> Result<(), AppError> {
    // Enrich online_video slides with local path if the video has been downloaded
    let mut slide_data = slide_data;
    if slide_data.slide_type == "online_video" {
        if let Some(ref video_id) = slide_data.video_id.clone() {
            if let Ok(conn) = state.db.get() {
                if let Ok(Some(local_path)) =
                    crate::db::queries::online_videos::get_video_local_path(&conn, video_id)
                {
                    if !local_path.is_empty() {
                        slide_data.video_source = Some("local".to_string());
                        slide_data.video_url = Some(local_path);
                    }
                }
            }
        }
    }

    {
        let mut current = state
            .current_slide
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    app.emit("slide-changed", &slide_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

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

    app.emit("slide-context", &slide_context)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let app_data_dir = app.path().app_data_dir().ok();
    let adr = app_data_dir.as_deref();

    if let Ok(server) = streaming_state.server.lock() {
        if slide_data.slide_type == "bible" {
            let json = serde_json::json!({
                "reference": slide_data
                    .title
                    .as_deref()
                    .or(slide_data.label.as_deref())
                    .unwrap_or(""),
                "text": slide_data.text.as_deref().unwrap_or(""),
            });
            server.broadcast_bible(&json.to_string());
            server.broadcast_music(&empty_streaming_music_payload().to_string());
        } else {
            server.broadcast_music(
                &build_music_stream_payload(&slide_data, Some(&slide_context), adr).to_string(),
            );
            let clear_bible = serde_json::json!({ "reference": "", "text": "" });
            server.broadcast_bible(&clear_bible.to_string());
        }
        let return_payload = build_return_stream_payload(&slide_data, Some(&slide_context), adr);
        server.broadcast_return(&return_payload.to_string());
    }

    Ok(())
}

pub fn update_slide_context(
    app: &AppHandle,
    state: &AppState,
    streaming_state: &StreamingState,
    context_data: SlideContext,
) -> Result<(), AppError> {
    {
        let mut ctx = state
            .slide_context
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *ctx = Some(context_data.clone());
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
