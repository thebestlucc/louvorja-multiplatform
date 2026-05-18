use tauri::AppHandle;
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::db::models::{SlideContent, SlideContext};
use crate::commands::streaming::{is_empty_hymn_gap_slide, streaming_slide_title};

pub fn update_current_slide(
    _app: &AppHandle,
    state: &AppState,
    _streaming_state: &StreamingState,
    slide_data: SlideContent,
) -> Result<(), AppError> {
    let mut slide_data = slide_data;
    if let SlideContent::OnlineVideo { ref mut source, .. } = slide_data {
        if let crate::db::models::slides::VideoSource::Youtube { video_id } = source {
            let vid = video_id.clone();
            if let Ok(conn) = state.db.get() {
                if let Ok(Some(local_path)) =
                    crate::db::queries::online_videos::get_video_local_path(&conn, &vid)
                {
                    if !local_path.is_empty() {
                        *source = crate::db::models::slides::VideoSource::Local { url: local_path };
                    }
                }
            }
        }
    }

    // Compute the SlideContext to publish. Reuse the existing Hub context
    // when the slide's title hasn't changed (or when it's a hymn gap slide)
    // so transitions inside a song don't lose the originating navigation
    // context. Otherwise emit a fallback `{ next:None, 0/1, title }`.
    let current_title = streaming_slide_title(&slide_data);
    let hub = state.projection.clone();
    let slide_for_hub = slide_data.clone();
    tauri::async_runtime::block_on(async move {
        let (snapshot, _rx) = hub.attach().await;
        let slide_context = match snapshot.context {
            Some(ctx)
                if is_empty_hymn_gap_slide(&slide_for_hub)
                    || (!ctx.title.is_empty() && ctx.title == current_title) =>
            {
                ctx
            }
            _ => SlideContext {
                next: None,
                index: 0,
                total: 1,
                title: current_title,
                current_slide_start_ms: None,
                next_slide_start_ms: None,
                audio_duration_ms: None,
            },
        };
        let _ = hub
            .apply_batch(vec![
                crate::projection::Mutation::SetSlide(Some(slide_for_hub)),
                crate::projection::Mutation::SetContext(Some(slide_context)),
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
    let hub = state.projection.clone();
    tauri::async_runtime::block_on(async move {
        let _ = hub
            .apply(crate::projection::Mutation::SetContext(Some(context_data)))
            .await;
    });

    Ok(())
}
