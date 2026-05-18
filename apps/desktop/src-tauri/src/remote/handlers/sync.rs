//! `state.sync` handler — hydrates the requesting WS client only.
//!
//! Pre-Phase-6 this handler emitted Tauri events (`slide-changed`,
//! `audio-status`) which the `events.rs` listener fanned out to every
//! connected WS client — meaning one client reconnecting woke every
//! other client too.
//!
//! Now: projection state envelopes (`slide.changed`, `overlay.changed`,
//! `alert.changed`, `freeze.changed`) are constructed here, signed with
//! the requesting device's HMAC key, and sent only on `ctx.resp_tx`.
//! Audio status still uses the legacy Tauri-emit → broadcast path (the
//! desktop frontend's `useAudioStore` also listens to the same event;
//! switching audio to per-session needs a frontend-side adjustment).

use crate::error::AppError;
use crate::projection::OverlayMode;
use crate::remote::dispatcher::DispatcherCtx;
use crate::remote::hmac_util;
use crate::remote::protocol::RemoteEnvelope;
use crate::state::{AppState, AudioState};
use tauri::{Emitter, Manager};

pub async fn sync_state(ctx: &DispatcherCtx) -> Result<serde_json::Value, AppError> {
    let app = &ctx.app;

    // ── 1. Projection state — per-session signed envelopes via resp_tx ─────
    if let Some(app_state) = app.try_state::<AppState>() {
        let (snapshot, _rx) = app_state.projection.attach().await;

        if let Some(slide) = &snapshot.current_slide {
            send_signed(
                ctx,
                "slide.changed",
                serde_json::json!({ "slide": slide, "version": snapshot.version }),
            );
        }

        let (black, logo) = bools_of(&snapshot.overlay);
        send_signed(
            ctx,
            "overlay.changed",
            serde_json::json!({ "blackScreen": black, "logoScreen": logo }),
        );

        let alert_payload = match &snapshot.alert {
            Some(a) => serde_json::json!({
                "text": a.text,
                "isVisible": true,
                "isTicker": a.is_ticker,
            }),
            None => serde_json::json!({
                "text": "",
                "isVisible": false,
                "isTicker": false,
            }),
        };
        send_signed(ctx, "alert.changed", alert_payload);

        send_signed(
            ctx,
            "freeze.changed",
            serde_json::json!({ "frozen": snapshot.frozen }),
        );
    }

    // ── 2. Audio status — still broadcasts via Tauri emit (frontend listens too)
    if let Some(audio) = app.try_state::<AudioState>() {
        emit_audio_status(app, &audio);
    }

    Ok(serde_json::json!({}))
}

fn bools_of(mode: &OverlayMode) -> (bool, bool) {
    match mode {
        OverlayMode::Black => (true, false),
        OverlayMode::Logo => (false, true),
        OverlayMode::None => (false, false),
    }
}

fn send_signed(ctx: &DispatcherCtx, op: &str, payload: serde_json::Value) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let nonce = format!("sync-{}-{}", ts, &op[..op.len().min(8)]);
    let payload_str = serde_json::to_string(&payload).unwrap_or_default();
    let sig = hmac_util::sign(&ctx.device_token, ts, &nonce, op, &payload_str);
    let env = RemoteEnvelope {
        id: None,
        kind: "event".into(),
        op: op.to_string(),
        ts,
        nonce,
        payload,
        sig: Some(sig),
    };
    if let Ok(json) = serde_json::to_string(&env) {
        let _ = ctx.resp_tx.send(json);
    }
}

fn emit_audio_status(app: &tauri::AppHandle, audio: &AudioState) {
    let Ok(player) = audio.player.read() else { return };
    use serde::Serialize;

    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    struct Snap {
        position_ms: u64,
        duration_ms: Option<u64>,
        is_playing: bool,
        is_paused: bool,
        volume: f32,
        current_file: Option<String>,
    }

    let snap = Snap {
        position_ms: player.position_ms(),
        duration_ms: player.duration_ms(),
        is_playing: player.is_playing(),
        is_paused: player.is_paused(),
        volume: player.volume(),
        current_file: player.current_file(),
    };
    drop(player);
    let _ = app.emit("audio-status", snap);
}
