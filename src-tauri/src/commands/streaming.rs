use crate::db::models::{SlideContent, SlideContext};
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::streaming::StreamingInfo;
use crate::utils::catcher::catcher;
use tauri::{AppHandle, Manager};

pub(crate) fn streaming_slide_title(slide: &SlideContent) -> String {
    slide
        .title
        .clone()
        .or_else(|| slide.label.clone())
        .unwrap_or_default()
}

pub(crate) fn is_empty_hymn_gap_slide(slide: &SlideContent) -> bool {
    matches!(slide.slide_type.as_str(), "text" | "lyrics")
        && slide
            .text
            .as_deref()
            .unwrap_or("")
            .trim()
            .is_empty()
        && slide
            .title
            .as_deref()
            .unwrap_or("")
            .trim()
            .is_empty()
        && slide
            .label
            .as_deref()
            .unwrap_or("")
            .trim()
            .is_empty()
}

pub(crate) fn streaming_slide_payload(slide: &SlideContent) -> serde_json::Value {
    let is_image = slide.slide_type == "image";
    let text_value = slide.text.as_deref().unwrap_or("");
    let video_path = slide.video_path.as_deref().unwrap_or("");
    let background_image = slide.background_image.as_deref().unwrap_or("");
    let background_color = slide.background_color.as_deref().unwrap_or("");
    let text_color = slide.text_color.as_deref().unwrap_or("");
    let audio_path = slide.audio_path.as_deref().unwrap_or("");
    let text_size = slide.text_size.unwrap_or(0);
    let video_url = slide.video_url.as_deref().unwrap_or("");
    let video_id = slide.video_id.as_deref().unwrap_or("");
    let video_source = slide.video_source.as_deref().unwrap_or("");
    let video_title = slide.video_title.as_deref().unwrap_or("");

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
        "videoUrl": video_url,
        "video_url": video_url,
        "videoId": video_id,
        "video_id": video_id,
        "videoSource": video_source,
        "video_source": video_source,
        "videoTitle": video_title,
        "video_title": video_title,
    })
}

pub(crate) fn build_music_stream_payload(
    current: &SlideContent,
    context: Option<&SlideContext>,
) -> serde_json::Value {
    let current_title = streaming_slide_title(current);
    let mut payload = streaming_slide_payload(current);

    if let Some(ctx) = context {
        if is_empty_hymn_gap_slide(current) || (!ctx.title.is_empty() && ctx.title == current_title)
        {
            if let Some(map) = payload.as_object_mut() {
                map.insert("index".to_string(), serde_json::json!(ctx.index));
                map.insert("total".to_string(), serde_json::json!(ctx.total));
                map.insert("contextTitle".to_string(), serde_json::json!(ctx.title));
                map.insert(
                    "currentSlideStartMs".to_string(),
                    serde_json::json!(ctx.current_slide_start_ms),
                );
                map.insert(
                    "nextSlideStartMs".to_string(),
                    serde_json::json!(ctx.next_slide_start_ms),
                );
                map.insert(
                    "audioDurationMs".to_string(),
                    serde_json::json!(ctx.audio_duration_ms),
                );
            }
        }
    }

    payload
}

pub(crate) fn empty_streaming_music_payload() -> serde_json::Value {
    serde_json::json!({
        "slideType": "",
        "slide_type": "",
        "type": "",
        "videoPath": "",
        "video_path": "",
        "label": "",
        "text": "",
        "title": "",
        "subtitle": "",
        "backgroundImage": "",
        "background_image": "",
        "backgroundColor": "",
        "background_color": "",
        "textColor": "",
        "text_color": "",
        "textSize": 0,
        "text_size": 0,
        "fontSize": 0,
        "index": 0,
        "total": 0,
        "contextTitle": "",
        "currentSlideStartMs": null,
        "nextSlideStartMs": null,
        "audioDurationMs": null,
        "audioPath": "",
        "audio_path": "",
        "src": "",
    })
}

pub(crate) fn build_return_stream_payload(
    current: &SlideContent,
    context: Option<&SlideContext>,
) -> serde_json::Value {
    let current_title = streaming_slide_title(current);
    if let Some(ctx) = context {
        if is_empty_hymn_gap_slide(current) || (!ctx.title.is_empty() && ctx.title == current_title)
        {
            return serde_json::json!({
                "current": streaming_slide_payload(current),
                "next": ctx.next.as_ref().map(streaming_slide_payload),
                "index": ctx.index,
                "total": ctx.total,
                "title": ctx.title,
                "currentSlideStartMs": ctx.current_slide_start_ms,
                "nextSlideStartMs": ctx.next_slide_start_ms,
                "audioDurationMs": ctx.audio_duration_ms,
            });
        }
    }

    serde_json::json!({
        "current": streaming_slide_payload(current),
        "next": null,
        "index": 0,
        "total": 1,
        "title": current_title,
        "currentSlideStartMs": null,
        "nextSlideStartMs": null,
        "audioDurationMs": null,
    })
}

pub(crate) fn empty_return_stream_payload() -> serde_json::Value {
    serde_json::json!({
        "current": null,
        "next": null,
        "index": 0,
        "total": 0,
        "title": "",
        "currentSlideStartMs": null,
        "nextSlideStartMs": null,
        "audioDurationMs": null,
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
            let music_json = build_music_stream_payload(&slide_data, slide_context.as_ref());
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

    let music_json = empty_streaming_music_payload();
    server.broadcast_music(&music_json.to_string());

    let bible_json = serde_json::json!({
        "reference": "",
        "text": "",
    });
    server.broadcast_bible(&bible_json.to_string());

    let return_json = empty_return_stream_payload();
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

    let (current_slide, err) = catcher(app_state.current_slide.read());
    if let Some(e) = err {
        return Err(e);
    }
    let current_slide = current_slide.unwrap().clone();

    let (slide_context, err) = catcher(app_state.slide_context.read());
    if let Some(e) = err {
        return Err(e);
    }
    let slide_context = slide_context.unwrap().clone();

    let (server, err) = catcher(state.server.lock());
    if let Some(e) = err {
        return Err(e);
    }
    let mut server = server.unwrap();

    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    server.set_media_root(app_data_dir.join("media"));
    let info = server.start(port).map_err(AppError::Internal)?;

    sync_streaming_projection_state(&server, current_slide, slide_context);
    Ok(info)
}

#[tauri::command]
#[specta::specta]
pub fn stop_streaming_server(state: tauri::State<'_, StreamingState>) -> Result<(), AppError> {
    let (server, err) = catcher(state.server.lock());
    if let Some(e) = err {
        return Err(e);
    }
    let mut server = server.unwrap();
    server.stop();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_streaming_status(
    state: tauri::State<'_, StreamingState>,
) -> Result<StreamingInfo, AppError> {
    let (server, err) = catcher(state.server.lock());
    if let Some(e) = err {
        return Err(e);
    }
    let server = server.unwrap();
    server.get_status().map_err(AppError::Internal)
}

#[tauri::command]
#[specta::specta]
pub fn set_streaming_broadcast(
    enabled: bool,
    state: tauri::State<'_, StreamingState>,
    app_state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (current_slide, err) = catcher(app_state.current_slide.read());
    if let Some(e) = err {
        return Err(e);
    }
    let current_slide = current_slide.unwrap().clone();

    let (slide_context, err) = catcher(app_state.slide_context.read());
    if let Some(e) = err {
        return Err(e);
    }
    let slide_context = slide_context.unwrap().clone();

    let (server, err) = catcher(state.server.lock());
    if let Some(e) = err {
        return Err(e);
    }
    let server = server.unwrap();

    server.set_broadcast_enabled(enabled);
    if enabled {
        sync_streaming_projection_state(&server, current_slide, slide_context);
    }
    Ok(())
}
