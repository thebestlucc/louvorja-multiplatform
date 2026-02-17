use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::streaming::StreamingInfo;
use crate::db::models::{SlideContent, SlideContext};

fn streaming_slide_title(slide: &SlideContent) -> String {
    slide
        .title
        .clone()
        .or_else(|| slide.label.clone())
        .unwrap_or_default()
}

fn streaming_slide_payload(slide: &SlideContent) -> serde_json::Value {
    serde_json::json!({
        "label": slide.label.as_deref().unwrap_or(""),
        "text": slide.text.as_deref().unwrap_or(""),
        "title": slide.title.as_deref().unwrap_or(""),
        "subtitle": slide.subtitle.as_deref().unwrap_or(""),
    })
}

fn build_return_stream_payload(
    current: &SlideContent,
    context: Option<&SlideContext>,
) -> serde_json::Value {
    let current_title = streaming_slide_title(current);
    if let Some(ctx) = context {
        if !ctx.title.is_empty() && ctx.title == current_title {
            return serde_json::json!({
                "current": streaming_slide_payload(current),
                "next": ctx.next.as_ref().map(streaming_slide_payload),
                "index": ctx.index,
                "total": ctx.total,
                "title": ctx.title,
            });
        }
    }

    serde_json::json!({
        "current": streaming_slide_payload(current),
        "next": null,
        "index": 0,
        "total": 1,
        "title": current_title,
    })
}

fn sync_streaming_projection_state(
    server: &crate::streaming::StreamingServer,
    current_slide: Option<SlideContent>,
    slide_context: Option<SlideContext>,
) {
    if let Some(slide_data) = current_slide {
        if slide_data.slide_type == "bible" {
            let music_json = serde_json::json!({
                "label": "",
                "text": "",
                "title": "",
                "subtitle": "",
            });
            server.broadcast_music(&music_json.to_string());

            let bible_json = serde_json::json!({
                "reference": slide_data
                    .title
                    .as_deref()
                    .or(slide_data.label.as_deref())
                    .unwrap_or(""),
                "text": slide_data.text.as_deref().unwrap_or(""),
            });
            server.broadcast_bible(&bible_json.to_string());
        } else {
            let music_json = serde_json::json!({
                "label": slide_data.label.as_deref().unwrap_or(""),
                "text": slide_data.text.as_deref().unwrap_or(""),
                "title": slide_data.title.as_deref().unwrap_or(""),
                "subtitle": slide_data.subtitle.as_deref().unwrap_or(""),
            });
            server.broadcast_music(&music_json.to_string());

            let bible_json = serde_json::json!({
                "reference": "",
                "text": "",
            });
            server.broadcast_bible(&bible_json.to_string());
        }

        let return_payload = build_return_stream_payload(&slide_data, slide_context.as_ref());
        server.broadcast_return(&return_payload.to_string());
        return;
    }

    let music_json = serde_json::json!({
        "label": "",
        "text": "",
        "title": "",
        "subtitle": "",
    });
    server.broadcast_music(&music_json.to_string());

    let bible_json = serde_json::json!({
        "reference": "",
        "text": "",
    });
    server.broadcast_bible(&bible_json.to_string());

    let return_json = serde_json::json!({
        "current": null,
        "next": null,
        "index": 0,
        "total": 0,
        "title": "",
    });
    server.broadcast_return(&return_json.to_string());
}

#[tauri::command]
pub fn start_streaming_server(
    port: Option<u16>,
    state: tauri::State<'_, StreamingState>,
    app_state: tauri::State<'_, AppState>,
) -> Result<StreamingInfo, AppError> {
    if let Some(value) = port {
        if !(1024..=65535).contains(&value) {
            return Err(AppError::Internal(format!(
                "Invalid port {}. Use a value between 1024 and 65535.",
                value
            )));
        }
    }

    let current_slide = app_state
        .current_slide
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .clone();
    let slide_context = app_state
        .slide_context
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .clone();

    let mut server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let info = server
        .start(port)
        .map_err(|e| AppError::Internal(e))?;

    sync_streaming_projection_state(&server, current_slide, slide_context);
    Ok(info)
}

#[tauri::command]
pub fn stop_streaming_server(
    state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    let mut server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    server.stop();
    Ok(())
}

#[tauri::command]
pub fn get_streaming_status(
    state: tauri::State<'_, StreamingState>,
) -> Result<StreamingInfo, AppError> {
    let server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    server
        .get_status()
        .map_err(|e| AppError::Internal(e))
}

#[tauri::command]
pub fn set_streaming_broadcast(
    enabled: bool,
    state: tauri::State<'_, StreamingState>,
    app_state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let current_slide = app_state
        .current_slide
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .clone();
    let slide_context = app_state
        .slide_context
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .clone();

    let server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    server.set_broadcast_enabled(enabled);
    if enabled {
        sync_streaming_projection_state(&server, current_slide, slide_context);
    }
    Ok(())
}
