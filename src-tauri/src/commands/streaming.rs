use crate::db::models::{SlideContent, SlideContext};
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::streaming::StreamingInfo;
use tauri::{AppHandle, Manager};

fn streaming_slide_title(slide: &SlideContent) -> String {
    slide
        .title
        .clone()
        .or_else(|| slide.label.clone())
        .unwrap_or_default()
}

fn streaming_slide_payload(slide: &SlideContent) -> serde_json::Value {
    let is_image = slide.slide_type == "image";
    let text_value = slide.text.as_deref().unwrap_or("");
    let video_path = slide.video_path.as_deref().unwrap_or("");
    let background_image = slide.background_image.as_deref().unwrap_or("");
    let background_color = slide.background_color.as_deref().unwrap_or("");
    let text_color = slide.text_color.as_deref().unwrap_or("");
    let audio_path = slide.audio_path.as_deref().unwrap_or("");
    let text_size = slide.text_size.unwrap_or(0);

    serde_json::json!({
        "slideType": slide.slide_type,
        "slide_type": slide.slide_type,
        "type": slide.slide_type,
        "videoPath": video_path,
        "video_path": video_path,
        "label": slide.label.as_deref().unwrap_or(""),
        "text": text_value,
        "title": slide.title.as_deref().unwrap_or(""),
        "subtitle": slide.subtitle.as_deref().unwrap_or(""),
        "backgroundImage": background_image,
        "background_image": background_image,
        "backgroundColor": background_color,
        "background_color": background_color,
        "textColor": text_color,
        "text_color": text_color,
        "textSize": text_size,
        "text_size": text_size,
        "fontSize": text_size,
        "audioPath": audio_path,
        "audio_path": audio_path,
        "src": if is_image { text_value } else { "" },
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
                "slideType": "",
                "videoPath": "",
                "label": "",
                "text": "",
                "title": "",
                "subtitle": "",
                "backgroundImage": "",
                "backgroundColor": "",
                "textColor": "",
                "textSize": 0,
                "audioPath": "",
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
                "slideType": slide_data.slide_type,
                "videoPath": slide_data.video_path.as_deref().unwrap_or(""),
                "label": slide_data.label.as_deref().unwrap_or(""),
                "text": slide_data.text.as_deref().unwrap_or(""),
                "title": slide_data.title.as_deref().unwrap_or(""),
                "subtitle": slide_data.subtitle.as_deref().unwrap_or(""),
                "backgroundImage": slide_data.background_image.as_deref().unwrap_or(""),
                "backgroundColor": slide_data.background_color.as_deref().unwrap_or(""),
                "textColor": slide_data.text_color.as_deref().unwrap_or(""),
                "textSize": slide_data.text_size.unwrap_or(0),
                "audioPath": slide_data.audio_path.as_deref().unwrap_or(""),
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
        "slideType": "",
        "videoPath": "",
        "label": "",
        "text": "",
        "title": "",
        "subtitle": "",
        "backgroundImage": "",
        "backgroundColor": "",
        "textColor": "",
        "textSize": 0,
        "audioPath": "",
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
#[specta::specta]
pub fn start_streaming_server(
    port: Option<u16>,
    app: AppHandle,
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
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to resolve app data directory: {}", e)))?;
    server.set_media_root(app_data_dir.join("media"));
    let info = server.start(port).map_err(AppError::Internal)?;

    sync_streaming_projection_state(&server, current_slide, slide_context);
    Ok(info)
}

#[tauri::command]
#[specta::specta]
pub fn stop_streaming_server(state: tauri::State<'_, StreamingState>) -> Result<(), AppError> {
    let mut server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    server.stop();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_streaming_status(
    state: tauri::State<'_, StreamingState>,
) -> Result<StreamingInfo, AppError> {
    let server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    server.get_status().map_err(AppError::Internal)
}

#[tauri::command]
#[specta::specta]
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
