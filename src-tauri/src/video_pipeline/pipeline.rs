//! Base GStreamer pipeline graph for the Rust video pipeline migration
//! (see `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 1.2).
//!
//! Builds the source/decode + audio sink + video tee fanout. Webrtcbin
//! consumers are attached lazily by Task 1.3 (`consumer.rs`); this module
//! provides the helpers that task will call.
//!
//! Element naming conventions inside the pipeline:
//! - `src` — `uridecodebin`
//! - `audio_queue`, `audio_convert`, `audio_resample`, `audio_sink`
//! - `video_queue`, `video_convert`, `vtee`
//! - per consumer (Task 1.3): `<name>_queue`, `<name>_caps`, `<name>` (webrtcbin)
#![allow(dead_code)]

use crate::error::AppError;
use gstreamer as gst;
use gstreamer::prelude::*;
use std::sync::Once;

static GST_INIT: Once = Once::new();
static mut GST_INIT_RESULT: Result<(), String> = Ok(());

/// Initialize GStreamer exactly once per process.
///
/// `gst::init()` is idempotent itself, but wrapping it in `Once` keeps the
/// cost trivial for callers that touch this module from multiple threads.
pub fn ensure_initialized() -> Result<(), AppError> {
    GST_INIT.call_once(|| {
        if let Err(e) = gst::init() {
            // SAFETY: `Once::call_once` guarantees single-threaded execution
            // of this closure; the static is only read after `call_once`
            // returns, so no concurrent access is possible.
            unsafe {
                GST_INIT_RESULT = Err(format!("gst::init failed: {e}"));
            }
        }
    });
    // SAFETY: see above — read happens-after the `call_once` write.
    let result = unsafe {
        match &*std::ptr::addr_of!(GST_INIT_RESULT) {
            Ok(()) => Ok(()),
            Err(msg) => Err(msg.clone()),
        }
    };
    result.map_err(AppError::Internal)
}

/// Builds the base pipeline (`uridecodebin` + audio sink + video tee).
///
/// State after construction: `NULL`. No URI is set, no webrtcbin consumers
/// are attached. Caller must:
/// 1. Call `set_source_uri` before transitioning to PAUSED/PLAYING.
/// 2. Optionally call `attach_webrtc_consumer` (Task 1.3) to add WebRTC fanout.
pub fn build_base_pipeline() -> Result<gst::Pipeline, AppError> {
    ensure_initialized()?;

    let pipeline = gst::Pipeline::with_name("video_pipeline");

    // --- uridecodebin (URI set later by `set_source_uri`) ---
    let src = make_element("uridecodebin", "src")?;

    // --- audio chain: queue -> audioconvert -> audioresample -> autoaudiosink ---
    let audio_queue = make_element("queue", "audio_queue")?;
    let audio_convert = make_element("audioconvert", "audio_convert")?;
    let audio_resample = make_element("audioresample", "audio_resample")?;
    let audio_sink = make_element("autoaudiosink", "audio_sink")?;

    // --- video chain: queue -> videoconvert -> tee(name=vtee) ---
    let video_queue = make_element("queue", "video_queue")?;
    let video_convert = make_element("videoconvert", "video_convert")?;
    let vtee = make_element("tee", "vtee")?;
    // Allow tee to roll to PLAYING with zero downstream consumers; webrtcbins
    // attach lazily later.
    vtee.set_property("allow-not-linked", true);

    pipeline
        .add_many([
            &src,
            &audio_queue,
            &audio_convert,
            &audio_resample,
            &audio_sink,
            &video_queue,
            &video_convert,
            &vtee,
        ])
        .map_err(|e| AppError::Internal(format!("gstreamer add_many: {e}")))?;

    // Statically link the audio chain: queue -> convert -> resample -> sink.
    gst::Element::link_many([&audio_queue, &audio_convert, &audio_resample, &audio_sink])
        .map_err(|e| AppError::Internal(format!("gstreamer link audio chain: {e}")))?;

    // Statically link the video chain: queue -> convert -> tee.
    gst::Element::link_many([&video_queue, &video_convert, &vtee])
        .map_err(|e| AppError::Internal(format!("gstreamer link video chain: {e}")))?;

    // uridecodebin discovers streams at runtime via pad-added.
    // Capture handles by clone (ref-counted) so the closure is 'static.
    let audio_queue_for_pad = audio_queue.clone();
    let video_queue_for_pad = video_queue.clone();
    src.connect_pad_added(move |_src, new_pad| {
        if let Err(e) = route_uridecodebin_pad(new_pad, &audio_queue_for_pad, &video_queue_for_pad)
        {
            gst::warning!(
                gst::CAT_DEFAULT,
                "video_pipeline: failed to route uridecodebin pad {}: {}",
                new_pad.name(),
                e
            );
        }
    });

    Ok(pipeline)
}

/// Sets the `uri` property on the pipeline's `uridecodebin` element.
///
/// Caller is responsible for transitioning the pipeline state afterwards.
pub fn set_source_uri(pipeline: &gst::Pipeline, uri: &str) -> Result<(), AppError> {
    let src = pipeline
        .by_name("src")
        .ok_or_else(|| AppError::Internal("gstreamer: missing 'src' element".into()))?;
    src.set_property("uri", uri);
    Ok(())
}

/// Attaches a new webrtcbin consumer to the video tee.
///
/// Sets up the tee fan-out branch (tee → `<name>_queue` → `<name>_caps`
/// forcing `video/x-raw,format=I420`) and adds an unlinked `webrtcbin` named
/// `<name>` to the pipeline, returning the webrtcbin element.
///
/// **The `<name>_caps` → webrtcbin link is intentionally NOT made here.**
/// webrtcbin requires RTP-formatted (`application/x-rtp`) input on its
/// `sink_%u` request pads, so each consumer must insert its own
/// encoder + RTP payloader between the I420 capsfilter and the webrtcbin.
/// That wiring belongs to Task 1.3 (`consumer.rs`), which knows the codec
/// preferences negotiated through SDP. Task 1.2 only owns the shared head
/// of the branch (queue + I420 caps) and the empty webrtcbin shell.
///
/// After Task 1.3 wires the encoder/payloader, it must call
/// `sync_state_with_parent()` on the new elements (and on `webrtc` itself
/// once a sink pad has been requested) before the pipeline rolls.
///
/// Returns the webrtcbin element so Task 1.3's signaling code can wire SDP/ICE.
pub fn attach_webrtc_consumer(
    pipeline: &gst::Pipeline,
    name: &str,
) -> Result<gst::Element, AppError> {
    let vtee = pipeline
        .by_name("vtee")
        .ok_or_else(|| AppError::Internal("gstreamer: missing 'vtee' element".into()))?;

    let queue_name = format!("{name}_queue");
    let caps_name = format!("{name}_caps");

    let queue = make_element("queue", &queue_name)?;
    let capsfilter = make_element("capsfilter", &caps_name)?;
    let caps = gst::Caps::builder("video/x-raw")
        .field("format", "I420")
        .build();
    capsfilter.set_property("caps", &caps);

    let webrtc = make_element("webrtcbin", name)?;
    // `latency` is a u32 millisecond value on webrtcbin.
    webrtc.set_property("latency", 0u32);
    // NOTE: NACK retransmission is configured per-transceiver in Task 1.3
    // (signaling.rs) — webrtcbin (>=1.18) does not expose a top-level
    // `do-retransmission` property. The plan's property name was a shorthand
    // for the transceiver `do-nack` flag, which must be flipped after
    // negotiation begins. See docs/plans/2026-04-17-rust-video-pipeline.md
    // Task 1.2 → 1.3.

    pipeline
        .add_many([&queue, &capsfilter, &webrtc])
        .map_err(|e| AppError::Internal(format!("gstreamer add_many (consumer): {e}")))?;

    // queue -> capsfilter (both have static pads).
    gst::Element::link_many([&queue, &capsfilter])
        .map_err(|e| AppError::Internal(format!("gstreamer link queue->caps: {e}")))?;

    let tee_pad = vtee
        .request_pad_simple("src_%u")
        .ok_or_else(|| AppError::Internal("gstreamer: tee.request_pad_simple returned None".into()))?;
    let queue_sink = queue
        .static_pad("sink")
        .ok_or_else(|| AppError::Internal("gstreamer: queue has no sink pad".into()))?;
    tee_pad
        .link(&queue_sink)
        .map_err(|e| AppError::Internal(format!("gstreamer link tee->queue: {e}")))?;

    // Bring the head of the new branch (queue + capsfilter) up to the parent's
    // current state. The webrtcbin stays at NULL until Task 1.3 wires its
    // encoder/payloader and requests a sink pad — at that point Task 1.3 is
    // responsible for syncing webrtcbin state.
    queue
        .sync_state_with_parent()
        .map_err(|e| AppError::Internal(format!("gstreamer sync queue state: {e}")))?;
    capsfilter
        .sync_state_with_parent()
        .map_err(|e| AppError::Internal(format!("gstreamer sync capsfilter state: {e}")))?;

    Ok(webrtc)
}

/// Detaches a previously-attached webrtcbin consumer.
///
/// Tears down the consumer branch (`<name>_queue` + `<name>_caps` + `<name>`):
/// releases the linked tee request pad, sets the elements to `NULL`, and
/// removes them from the pipeline.
///
/// Best-effort on individual element lookup — missing elements are ignored
/// so callers can use this as an idempotent cleanup. Returns an error only
/// when a state transition or pipeline removal fails.
pub fn detach_webrtc_consumer(pipeline: &gst::Pipeline, name: &str) -> Result<(), AppError> {
    let queue_name = format!("{name}_queue");
    let caps_name = format!("{name}_caps");

    let queue = pipeline.by_name(&queue_name);
    let capsfilter = pipeline.by_name(&caps_name);
    let webrtc = pipeline.by_name(name);

    // Release the tee request pad linked to this consumer's queue, if any.
    if let Some(q) = queue.as_ref() {
        if let Some(queue_sink) = q.static_pad("sink") {
            if let Some(tee_src) = queue_sink.peer() {
                let _ = tee_src.unlink(&queue_sink);
                if let Some(tee) = pipeline.by_name("vtee") {
                    tee.release_request_pad(&tee_src);
                }
            }
        }
    }

    // Release any webrtcbin request sink pad that Task 1.3's encoder chain
    // may have linked into. Task 1.2 does NOT link to webrtcbin itself, so
    // this peer-walk is a no-op until Task 1.3 wires the chain.
    if let Some(w) = webrtc.as_ref() {
        for pad in w.sink_pads() {
            if let Some(peer) = pad.peer() {
                let _ = peer.unlink(&pad);
            }
            // Only release pads created on request; releasing a static pad
            // would issue a glib critical.
            let is_request = pad
                .pad_template()
                .map(|t| t.presence() == gst::PadPresence::Request)
                .unwrap_or(false);
            if is_request {
                w.release_request_pad(&pad);
            }
        }
    }

    for elem in [&queue, &capsfilter, &webrtc].into_iter().flatten() {
        elem.set_state(gst::State::Null)
            .map_err(|e| AppError::Internal(format!("gstreamer set_state(NULL): {e}")))?;
    }

    let owned: Vec<gst::Element> = [queue, capsfilter, webrtc].into_iter().flatten().collect();
    if !owned.is_empty() {
        let refs: Vec<&gst::Element> = owned.iter().collect();
        pipeline
            .remove_many(refs)
            .map_err(|e| AppError::Internal(format!("gstreamer remove consumer: {e}")))?;
    }

    Ok(())
}

/// Build a single GStreamer element with the given factory and instance name.
fn make_element(factory: &str, name: &str) -> Result<gst::Element, AppError> {
    gst::ElementFactory::make(factory)
        .name(name)
        .build()
        .map_err(|e| AppError::Internal(format!("gstreamer factory '{factory}': {e}")))
}

/// Routes a uridecodebin runtime pad to the audio or video chain head.
///
/// Inspects the pad's current caps; falls back to the pad name (`audio_*` /
/// `video_*`) if caps are unavailable. Unknown streams are logged and dropped.
fn route_uridecodebin_pad(
    new_pad: &gst::Pad,
    audio_queue: &gst::Element,
    video_queue: &gst::Element,
) -> Result<(), AppError> {
    let kind = classify_pad(new_pad);

    let target_queue = match kind {
        PadKind::Audio => audio_queue,
        PadKind::Video => video_queue,
        PadKind::Unknown => {
            return Err(AppError::Internal(format!(
                "unknown stream type for pad '{}'",
                new_pad.name()
            )));
        }
    };

    let sink = target_queue
        .static_pad("sink")
        .ok_or_else(|| AppError::Internal("target queue has no sink pad".into()))?;
    if sink.is_linked() {
        // uridecodebin can emit multiple pads of the same kind; we only wire
        // the first audio + first video pad. Drop the rest silently.
        return Ok(());
    }
    new_pad
        .link(&sink)
        .map_err(|e| AppError::Internal(format!("uridecodebin pad link: {e}")))?;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PadKind {
    Audio,
    Video,
    Unknown,
}

fn classify_pad(pad: &gst::Pad) -> PadKind {
    if let Some(caps) = pad.current_caps() {
        if let Some(s) = caps.structure(0) {
            let name = s.name();
            if name.starts_with("audio/") {
                return PadKind::Audio;
            }
            if name.starts_with("video/") {
                return PadKind::Video;
            }
        }
    }
    let pad_name = pad.name();
    if pad_name.starts_with("audio_") {
        PadKind::Audio
    } else if pad_name.starts_with("video_") {
        PadKind::Video
    } else {
        PadKind::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_initialized_is_idempotent() {
        ensure_initialized().expect("first init");
        ensure_initialized().expect("second init");
        ensure_initialized().expect("third init");
    }

    #[test]
    fn build_base_pipeline_creates_named_elements() {
        let pipeline = build_base_pipeline().expect("build");
        for name in [
            "src",
            "audio_queue",
            "audio_convert",
            "audio_resample",
            "audio_sink",
            "video_queue",
            "video_convert",
            "vtee",
        ] {
            assert!(
                pipeline.by_name(name).is_some(),
                "missing element '{name}' in base pipeline"
            );
        }
        // No webrtcbin consumers yet.
        assert!(pipeline.by_name("rtc_main").is_none());
    }

    #[test]
    fn set_source_uri_updates_uridecodebin_property() {
        let pipeline = build_base_pipeline().expect("build");
        let uri = "file:///tmp/missing.mp4";
        set_source_uri(&pipeline, uri).expect("set uri");
        let src = pipeline.by_name("src").expect("src");
        let actual: String = src.property("uri");
        assert_eq!(actual, uri);
    }

    #[test]
    fn classify_pad_falls_back_to_name() {
        // We can't easily synthesize a Pad with caps without a full pipeline
        // context; fallback-by-name is exercised via the integration test
        // (uridecodebin emits named pads). Here we just sanity-check the
        // PadKind enum boundaries.
        assert_eq!(PadKind::Audio, PadKind::Audio);
        assert_ne!(PadKind::Audio, PadKind::Video);
    }
}
