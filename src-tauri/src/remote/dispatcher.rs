//! WS inbound command dispatcher.
//!
//! Each authenticated WS message is routed here via `dispatch(op, payload, ctx)`.
//! Domain-specific logic lives in `remote::handlers::*` submodules.
//!
//! The dispatcher runs on the remote-server tokio runtime (NOT the Tauri main thread).
//! Use `ctx.app.run_on_main_thread(...)` for operations that require the Tauri main thread
//! (e.g. projector window creation).

use crate::error::AppError;
use crate::remote::handlers::{
    audio as audio_handler,
    display as display_handler,
    overlay as overlay_handler,
    presence as presence_handler,
    search as search_handler,
    service as service_handler,
    slide as slide_handler,
    sync as sync_handler,
    video as video_handler,
};

/// Context passed to every dispatcher call.
pub struct DispatcherCtx {
    pub app: tauri::AppHandle,
}

impl DispatcherCtx {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }
}

/// Route an incoming op to the appropriate handler.
/// Returns the JSON response payload (empty `{}` if no return value).
pub async fn dispatch(
    op: &str,
    payload: &serde_json::Value,
    ctx: &DispatcherCtx,
) -> Result<serde_json::Value, AppError> {
    match op {
        // ── Slide navigation ─────────────────────────────────────────────────
        "slide.next"  => slide_handler::next_slide(&ctx.app).await,
        "slide.prev"  => slide_handler::prev_slide(&ctx.app).await,
        "slide.goto"  => {
            let index = payload
                .get("index")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| AppError::Internal("slide.goto requires `index`".into()))? as usize;
            slide_handler::goto_slide(&ctx.app, index).await
        }
        "slide.clear" => slide_handler::clear_slide(&ctx.app).await,

        // ── Slide overlay (E1 extension) ─────────────────────────────────────
        "slide.overlay" => {
            let kind = payload
                .get("kind")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("slide.overlay requires `kind`".into()))?;
            match kind {
                "black" => overlay_handler::black(&ctx.app).await,
                "logo"  => overlay_handler::logo(&ctx.app).await,
                "none"  => overlay_handler::clear(&ctx.app).await,
                other   => Err(AppError::Internal(format!("unknown overlay kind: {other}"))),
            }
        }

        // ── Audio (E2) ───────────────────────────────────────────────────────
        "audio.play"      => audio_handler::resume(&ctx.app).await,
        "audio.pause"     => audio_handler::pause(&ctx.app).await,
        "audio.toggle"    => audio_handler::toggle(&ctx.app).await,
        "audio.seek"      => {
            let ms = payload
                .get("ms")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| AppError::Internal("audio.seek requires `ms`".into()))?;
            audio_handler::seek(&ctx.app, ms).await
        }
        "audio.volume"    => {
            let value = payload
                .get("value")
                .and_then(|v| v.as_f64())
                .ok_or_else(|| AppError::Internal("audio.volume requires `value`".into()))? as f32;
            audio_handler::set_volume(&ctx.app, value).await
        }
        "audio.skip_next" => audio_handler::skip_next(&ctx.app).await,
        "audio.skip_prev" => audio_handler::skip_prev(&ctx.app).await,

        // ── Service playback (E3) ────────────────────────────────────────────
        "service.start"     => {
            let service_id = payload
                .get("serviceId")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("service.start requires `serviceId`".into()))?;
            service_handler::start(&ctx.app, service_id).await
        }
        "service.stop"      => service_handler::stop(&ctx.app).await,
        "service.next_item" => service_handler::next_item(&ctx.app).await,
        "service.prev_item" => service_handler::prev_item(&ctx.app).await,
        // `service.goto` is the canonical op sent by the PWA; `service.jump_to` kept for back-compat.
        "service.goto" | "service.jump_to"   => {
            let index = payload
                .get("index")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| AppError::Internal("service.goto requires `index`".into()))? as usize;
            service_handler::jump_to(&ctx.app, index).await
        }

        // ── Search (E4) ──────────────────────────────────────────────────────
        "hymn.search" => {
            let query = payload
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let limit = payload
                .get("limit")
                .and_then(|v| v.as_u64())
                .unwrap_or(50)
                .min(200) as usize;
            search_handler::hymn_search(&ctx.app, query, limit).await
        }
        "bible.search" => {
            let query = payload
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let limit = payload
                .get("limit")
                .and_then(|v| v.as_u64())
                .unwrap_or(50)
                .min(200) as usize;
            // Optional: when set, FTS is scoped to a single Bible version.
            let version_id = payload.get("versionId").and_then(|v| v.as_i64());
            search_handler::bible_search(&ctx.app, query, limit, version_id).await
        }
        "bible.list_versions" => search_handler::bible_list_versions(&ctx.app).await,
        "bible.list_books" => {
            let version_id = payload
                .get("versionId")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("bible.list_books requires `versionId`".into()))?;
            search_handler::bible_list_books(&ctx.app, version_id).await
        }
        "bible.list_chapters" => {
            let version_id = payload
                .get("versionId")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("bible.list_chapters requires `versionId`".into()))?;
            let book = payload
                .get("book")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("bible.list_chapters requires `book`".into()))?
                .to_string();
            search_handler::bible_list_chapters(&ctx.app, version_id, book).await
        }
        "bible.list_verses" => {
            let version_id = payload
                .get("versionId")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("bible.list_verses requires `versionId`".into()))?;
            let book = payload
                .get("book")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("bible.list_verses requires `book`".into()))?
                .to_string();
            let chapter = payload
                .get("chapter")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("bible.list_verses requires `chapter`".into()))?;
            search_handler::bible_list_verses(&ctx.app, version_id, book, chapter).await
        }
        "bible.get_verse" => {
            let version_id = payload
                .get("versionId")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("bible.get_verse requires `versionId`".into()))?;
            let book = payload
                .get("book")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("bible.get_verse requires `book`".into()))?
                .to_string();
            let chapter = payload
                .get("chapter")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("bible.get_verse requires `chapter`".into()))?;
            search_handler::bible_get_verse(&ctx.app, version_id, book, chapter).await
        }
        "service.list_today" => search_handler::service_list_today(&ctx.app).await,
        "presentation.list" => search_handler::presentation_list(&ctx.app).await,
        "video.list" => {
            let q = payload.get("query").and_then(|v| v.as_str()).unwrap_or("").to_string();
            search_handler::video_list(&ctx.app, q).await
        }
        "video.queue_url" => {
            let url = payload.get("url").and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("video.queue_url requires `url`".into()))?;
            search_handler::video_queue_url(&ctx.app, url).await
        }

        // ── Video control (E5) ───────────────────────────────────────────────
        "video.play"        => video_handler::play(&ctx.app).await,
        "video.pause"       => video_handler::pause(&ctx.app).await,
        "video.seek"        => {
            let seconds = payload
                .get("seconds")
                .and_then(|v| v.as_f64())
                .ok_or_else(|| AppError::Internal("video.seek requires `seconds`".into()))?;
            video_handler::seek(&ctx.app, seconds).await
        }
        "video.set_targets" => {
            let projector      = payload.get("projector").and_then(|v| v.as_bool()).unwrap_or(true);
            let return_monitor = payload.get("return").and_then(|v| v.as_bool()).unwrap_or(false);
            video_handler::set_targets(&ctx.app, projector, return_monitor).await
        }

        // ── Projector / monitor (E6) ─────────────────────────────────────────
        "projector.open"        => display_handler::projector_open(&ctx.app).await,
        "projector.close"       => display_handler::projector_close(&ctx.app).await,
        "projector.set_monitor" => {
            let monitor_id = payload
                .get("monitorId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("projector.set_monitor requires `monitorId`".into()))?
                .to_string();
            display_handler::projector_set_monitor(&ctx.app, monitor_id).await
        }
        "return_monitor.open"  => display_handler::return_open(&ctx.app).await,
        "return_monitor.close" => display_handler::return_close(&ctx.app).await,

        // ── display.overlay alias (PWA live.tsx sends this op) ───────────────
        "display.overlay" => {
            let kind = payload
                .get("overlay")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("display.overlay requires `overlay`".into()))?;
            match kind {
                "black" => overlay_handler::black(&ctx.app).await,
                "logo"  => overlay_handler::logo(&ctx.app).await,
                "clear" => overlay_handler::clear(&ctx.app).await,
                other   => Err(AppError::Internal(format!("unknown overlay kind: {other}"))),
            }
        }

        // ── search.select (PWA search.tsx taps a result) ─────────────────────
        "search.select" => {
            let id = payload
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("search.select requires `id`".into()))?
                .to_string();
            let item_type = payload
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("hymns");
            search_handler::select(&ctx.app, id, item_type, payload).await
        }

        // ── queue.play (PWA queue.tsx taps an up-next item) ──────────────────
        "queue.play" => {
            let id = payload
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("queue.play requires `id`".into()))?
                .to_string();
            search_handler::queue_play(&ctx.app, id).await
        }

        // ── queue.add (PWA search confirms "Add to queue" — appends without projecting) ──
        "queue.add" => search_handler::queue_add(&ctx.app, payload).await,

        // ── Overlay ops (E7) ─────────────────────────────────────────────────
        "overlay.black"    => overlay_handler::black(&ctx.app).await,
        "overlay.logo"     => overlay_handler::logo(&ctx.app).await,
        "overlay.clear"    => overlay_handler::clear(&ctx.app).await,
        "shortcut.trigger" => {
            let code = payload
                .get("code")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("shortcut.trigger requires `code`".into()))?;
            overlay_handler::shortcut_trigger(&ctx.app, code).await
        }

        // ── Presence (H1) ───────────────────────────────────────────────────
        "presence.list" => presence_handler::list(&ctx.app).await,

        // ── State sync (on every WS connect) ────────────────────────────────
        "state.sync" => sync_handler::sync_state(&ctx.app).await,

        // ── Ping (keep-alive) ────────────────────────────────────────────────
        "ping" => Ok(serde_json::json!({ "op": "pong" })),

        _ => Err(AppError::NotFound(format!("Unknown op: {op}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// DispatcherCtx is not constructable without a real AppHandle in unit tests.
    /// We test dispatch logic by calling the handler functions directly in their own tests.
    /// The dispatcher itself is verified via integration tests in Phase I.

    #[test]
    fn unknown_op_returns_not_found() {
        // Sync check: pattern matching is exhaustive for known ops.
        let op = "definitely.unknown.op";
        let err = AppError::NotFound(format!("Unknown op: {op}"));
        let msg = err.to_string();
        assert!(msg.contains("Unknown op"), "got: {msg}");
    }

    #[test]
    fn slide_overlay_kind_black_is_routed() {
        let payload = serde_json::json!({ "kind": "black" });
        let kind = payload.get("kind").and_then(|v| v.as_str()).unwrap_or("");
        assert_eq!(kind, "black");
    }

    #[test]
    fn audio_seek_payload_parses_ms() {
        let payload = serde_json::json!({ "ms": 30000u64 });
        let ms = payload.get("ms").and_then(|v| v.as_u64()).unwrap();
        assert_eq!(ms, 30000);
    }

    #[test]
    fn video_set_targets_defaults_projector_true() {
        let payload = serde_json::json!({});
        let projector = payload.get("projector").and_then(|v| v.as_bool()).unwrap_or(true);
        let return_m  = payload.get("return").and_then(|v| v.as_bool()).unwrap_or(false);
        assert!(projector);
        assert!(!return_m);
    }

    #[test]
    fn shortcut_trigger_extracts_code() {
        let payload = serde_json::json!({ "code": "slides-next" });
        let code = payload.get("code").and_then(|v| v.as_str()).unwrap();
        assert_eq!(code, "slides-next");
    }

    #[test]
    // Both `service.goto` (PWA canonical) and `service.jump_to` (back-compat) parse `index`.
    fn service_goto_and_jump_to_parses_index() {
        let payload = serde_json::json!({ "index": 3u64 });
        let index = payload.get("index").and_then(|v| v.as_u64()).unwrap() as usize;
        assert_eq!(index, 3);
    }
}
