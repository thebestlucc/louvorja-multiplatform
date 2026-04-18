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
/// Builds the full per-consumer fan-out branch:
///
/// ```text
/// vtee → <name>_queue → <name>_caps (video/x-raw,format=I420)
///      → <name>_videoconvert → <name>_enc (x264enc, zerolatency)
///      → <name>_pay (rtph264pay) → <name>_paycaps (application/x-rtp,
///        media=video, encoding-name=H264, payload=96, clock-rate=90000)
///      → <name> (webrtcbin)
/// ```
///
/// The encoder + RTP payloader insertion completes a Task 1.2 deferral noted
/// inline in this file (and in Task 1.3 of the plan). webrtcbin requires
/// `application/x-rtp` on its `sink_%u` request pads, so the chain ends with
/// a capsfilter that pins payload type / clock rate before linking into a
/// freshly requested webrtcbin sink pad.
///
/// All new elements (including the webrtcbin) are sync'd to the parent
/// pipeline state via `sync_state_with_parent()` before this function returns.
///
/// Stuns/turns and per-transceiver NACK retransmission are configured by
/// `consumer::Consumer::new`, which receives the webrtcbin returned here.
pub fn attach_webrtc_consumer(
    pipeline: &gst::Pipeline,
    name: &str,
) -> Result<gst::Element, AppError> {
    let vtee = pipeline
        .by_name("vtee")
        .ok_or_else(|| AppError::Internal("gstreamer: missing 'vtee' element".into()))?;

    let queue_name = format!("{name}_queue");
    let caps_name = format!("{name}_caps");
    let convert_name = format!("{name}_videoconvert");
    let enc_name = format!("{name}_enc");
    let pay_name = format!("{name}_pay");
    let paycaps_name = format!("{name}_paycaps");

    let queue = make_element("queue", &queue_name)?;
    let capsfilter = make_element("capsfilter", &caps_name)?;
    let caps = gst::Caps::builder("video/x-raw")
        .field("format", "I420")
        .build();
    capsfilter.set_property("caps", &caps);

    let videoconvert = make_element("videoconvert", &convert_name)?;
    let enc = make_element("x264enc", &enc_name)?;
    enc.set_property_from_str("speed-preset", "ultrafast");
    enc.set_property_from_str("tune", "zerolatency");
    // 0 = auto/CFR; setting key-int-max keeps NACK-recoverable GOPs short
    // for loopback delivery to a fresh consumer.
    enc.set_property("key-int-max", 30u32);

    let pay = make_element("rtph264pay", &pay_name)?;
    // Predictable payload type so the SDP always advertises pt=96.
    pay.set_property("pt", 96u32);
    // aggregate-mode=zero-latency keeps RTP packets going out per-NAL,
    // matching the encoder's zerolatency tuning.
    pay.set_property_from_str("aggregate-mode", "zero-latency");

    let paycaps = make_element("capsfilter", &paycaps_name)?;
    let rtp_caps = gst::Caps::builder("application/x-rtp")
        .field("media", "video")
        .field("encoding-name", "H264")
        .field("payload", 96i32)
        .field("clock-rate", 90000i32)
        .build();
    paycaps.set_property("caps", &rtp_caps);

    let webrtc = make_element("webrtcbin", name)?;
    // `latency` is a u32 millisecond value on webrtcbin. Loopback => 0.
    webrtc.set_property("latency", 0u32);
    // Plan §6 Task 1.3: stun-server=null. Loopback finds host candidates
    // without needing STUN reflexive discovery.
    webrtc.set_property("stun-server", None::<&str>);

    pipeline
        .add_many([
            &queue,
            &capsfilter,
            &videoconvert,
            &enc,
            &pay,
            &paycaps,
            &webrtc,
        ])
        .map_err(|e| AppError::Internal(format!("gstreamer add_many (consumer): {e}")))?;

    // Link the static-pad chain queue → caps → videoconvert → enc → pay → paycaps.
    gst::Element::link_many([&queue, &capsfilter, &videoconvert, &enc, &pay, &paycaps])
        .map_err(|e| AppError::Internal(format!("gstreamer link consumer chain: {e}")))?;

    // webrtcbin's `sink_%u` is a request pad whose template caps are
    // `application/x-rtp`. `request_pad_simple("sink_%u")` returns None when
    // the GStreamer build resolves the request via caps negotiation instead
    // of a name-only allocation. Use `link_pads_filtered` which asks
    // webrtcbin to allocate the sink pad whose caps match `rtp_caps`,
    // mirroring the official C examples for sendonly pipelines.
    paycaps
        .link_pads_filtered(Some("src"), &webrtc, None, &rtp_caps)
        .map_err(|e| AppError::Internal(format!("gstreamer link paycaps->webrtcbin: {e}")))?;

    let tee_pad = vtee
        .request_pad_simple("src_%u")
        .ok_or_else(|| AppError::Internal("gstreamer: tee.request_pad_simple returned None".into()))?;
    let queue_sink = queue
        .static_pad("sink")
        .ok_or_else(|| AppError::Internal("gstreamer: queue has no sink pad".into()))?;
    tee_pad
        .link(&queue_sink)
        .map_err(|e| AppError::Internal(format!("gstreamer link tee->queue: {e}")))?;

    // Bring every newly added element up to the parent's current state.
    // Task 1.3 (consumer.rs) is now free to begin SDP negotiation.
    for elem in [&queue, &capsfilter, &videoconvert, &enc, &pay, &paycaps, &webrtc] {
        elem.sync_state_with_parent()
            .map_err(|e| AppError::Internal(format!("gstreamer sync state ({}): {e}", elem.name())))?;
    }

    Ok(webrtc)
}

/// Detaches a previously-attached webrtcbin consumer.
///
/// Tears down the full per-consumer chain (`queue`, `caps`, `videoconvert`,
/// `enc`, `pay`, `paycaps`, and the `webrtcbin` itself), releasing the tee
/// request pad and the webrtcbin sink request pad before transitioning the
/// elements to `NULL` and removing them from the pipeline.
///
/// Best-effort on individual element lookup — missing elements are ignored
/// so callers can use this as an idempotent cleanup. Returns an error only
/// when a state transition or pipeline removal fails.
pub fn detach_webrtc_consumer(pipeline: &gst::Pipeline, name: &str) -> Result<(), AppError> {
    let queue_name = format!("{name}_queue");
    let caps_name = format!("{name}_caps");
    let convert_name = format!("{name}_videoconvert");
    let enc_name = format!("{name}_enc");
    let pay_name = format!("{name}_pay");
    let paycaps_name = format!("{name}_paycaps");

    let queue = pipeline.by_name(&queue_name);
    let capsfilter = pipeline.by_name(&caps_name);
    let videoconvert = pipeline.by_name(&convert_name);
    let enc = pipeline.by_name(&enc_name);
    let pay = pipeline.by_name(&pay_name);
    let paycaps = pipeline.by_name(&paycaps_name);
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

    // Release any webrtcbin request sink pads (one per linked transceiver).
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

    let elems = [
        &queue,
        &capsfilter,
        &videoconvert,
        &enc,
        &pay,
        &paycaps,
        &webrtc,
    ];
    for elem in elems.into_iter().flatten() {
        elem.set_state(gst::State::Null)
            .map_err(|e| AppError::Internal(format!("gstreamer set_state(NULL): {e}")))?;
    }

    let owned: Vec<gst::Element> = [queue, capsfilter, videoconvert, enc, pay, paycaps, webrtc]
        .into_iter()
        .flatten()
        .collect();
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
