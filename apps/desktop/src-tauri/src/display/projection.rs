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

    // Maintain AppState legacy mirrors for now (read by get_current_slide /
    // get_slide_context until Slice 5 removes those commands).
    {
        let mut current = state
            .current_slide
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
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

    funnel_to_hub(app, state, &slide_data, &slide_context)
}

/// Apply slide + context to the ProjectionHub. The Hub's own freeze gate
/// suppresses broadcast while frozen and emits a coalesced Delta on unfreeze;
/// callers funnel unconditionally.
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
            .apply_batch(vec![
                crate::projection::Mutation::SetSlide(Some(slide_for_hub)),
                crate::projection::Mutation::SetContext(Some(context_for_hub)),
            ])
            .await;
    });

    Ok(())
}

pub fn update_slide_context(
    _app: &AppHandle,
    state: &AppState,
    _streaming_state: &StreamingState,
    context_data: SlideContext,
) -> Result<(), AppError> {
    {
        let mut ctx = state
            .slide_context
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *ctx = Some(context_data.clone());
    }

    let hub = state.projection.clone();
    let context_for_hub = context_data.clone();
    tauri::async_runtime::block_on(async move {
        let _ = hub
            .apply(crate::projection::Mutation::SetContext(Some(context_for_hub)))
            .await;
    });

    Ok(())
}
