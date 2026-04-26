//! Per-window WebRTC consumer state machine
//! (see `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 1.3).
//!
//! Each consumer owns one `webrtcbin` element attached to the shared video
//! pipeline. It drives the SDP/ICE handshake on the Rust side and forwards
//! offers + local ICE candidates through a [`SignalingChannel`] that a
//! Tauri-aware caller (Task 4.1) wires to actual frontend events.
//!
//! The lifecycle is:
//! 1. [`ConsumerRegistry::subscribe`] adds a webrtcbin via
//!    `pipeline::attach_webrtc_consumer`, configures NACK, and connects the
//!    `on-negotiation-needed` and `on-ice-candidate` signals.
//! 2. webrtcbin auto-starts negotiation; the offer flows out through
//!    [`SignalingChannel::emit_offer`]. The frontend answers via
//!    [`ConsumerRegistry::dispatch_answer`].
//! 3. Local ICE candidates flow out through [`SignalingChannel::emit_ice`].
//!    Remote candidates arrive through [`ConsumerRegistry::dispatch_ice`].
//! 4. [`ConsumerRegistry::unsubscribe`] tears the consumer down via
//!    `pipeline::detach_webrtc_consumer`.
//!
//! All public methods return `Result<_, AppError>`. GStreamer errors are
//! mapped to `AppError::Internal` since they are programmer-facing details
//! (signal failure, malformed SDP, etc.) rather than user-actionable.
#![allow(dead_code)]

use crate::error::AppError;
use crate::video_pipeline::pipeline::{attach_webrtc_consumer, detach_webrtc_consumer};
use crate::video_pipeline::signaling::{
    AnswerPayload, IcePayload, OfferPayload, SignalingChannel,
};
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_sdp as gst_sdp;
use gstreamer_webrtc as gst_webrtc;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// One per Tauri window/consumer; owns the webrtcbin + signaling wiring.
pub struct Consumer {
    window_label: String,
    webrtcbin: gst::Element,
    /// Kept for cloning into outbound emit calls (e.g. inside dispatch_answer
    /// completion callbacks). The trait object outlives this struct.
    signaling: Arc<dyn SignalingChannel>,
}

impl Consumer {
    /// Create a new consumer.
    ///
    /// Attaches a webrtcbin + encoder/payloader chain to `pipeline` (via
    /// `attach_webrtc_consumer`), configures per-transceiver NACK after the
    /// transceiver appears, and wires the negotiation-needed and ICE
    /// candidate signals to forward through `signaling`.
    ///
    /// The new branch is sync'd to the parent pipeline state by
    /// `attach_webrtc_consumer`, so an immediate or in-flight transition to
    /// PLAYING will trigger negotiation as soon as the upstream `tee`
    /// produces caps.
    pub fn new(
        pipeline: &gst::Pipeline,
        window_label: String,
        signaling: Arc<dyn SignalingChannel>,
    ) -> Result<Self, AppError> {
        let webrtcbin = attach_webrtc_consumer(pipeline, &window_label)?;

        // Per-transceiver NACK: webrtcbin (>= 1.18) exposes `do-nack` as a
        // property on each `GstWebRTCRTPTransceiver`. Transceivers are
        // created lazily — for the inbound side, one appears when the sink
        // pad is requested (already done by `attach_webrtc_consumer`).
        // `on-new-transceiver` fires for any future transceivers (e.g. those
        // negotiated through SDP).
        Self::enable_existing_nack(&webrtcbin);
        Self::wire_new_transceiver_nack(&webrtcbin);

        // Wire the negotiation + ICE outbound signaling.
        Self::connect_negotiation_needed(&webrtcbin, &window_label, signaling.clone())?;
        Self::connect_on_ice_candidate(&webrtcbin, &window_label, signaling.clone())?;

        Ok(Self {
            window_label,
            webrtcbin,
            signaling,
        })
    }

    /// Tauri window label identifier for this consumer.
    pub fn window_label(&self) -> &str {
        &self.window_label
    }

    /// Apply an SDP answer received from the frontend.
    ///
    /// Parses the SDP via `gst-sdp` and emits `set-remote-description` on
    /// the webrtcbin. Returns an error if the SDP is empty, unparseable, or
    /// the GStreamer signal call fails.
    pub fn accept_answer(&self, sdp: &str) -> Result<(), AppError> {
        if sdp.is_empty() {
            return Err(AppError::Internal(
                "consumer.accept_answer: sdp is empty".into(),
            ));
        }

        let msg = gst_sdp::SDPMessage::parse_buffer(sdp.as_bytes())
            .map_err(|e| AppError::Internal(format!("consumer.accept_answer parse: {e}")))?;
        let desc = gst_webrtc::WebRTCSessionDescription::new(gst_webrtc::WebRTCSDPType::Answer, msg);

        // Fire-and-forget promise — we don't block on completion. webrtcbin
        // logs internally if set-remote-description fails post-accept.
        let promise = gst::Promise::new();
        self.webrtcbin
            .emit_by_name::<()>("set-remote-description", &[&desc, &promise]);
        Ok(())
    }

    /// Add a remote ICE candidate received from the frontend.
    ///
    /// Empty candidate strings are treated as the end-of-candidates marker
    /// (RFC 8838); webrtcbin understands this when the empty string is
    /// passed through, so we forward it as-is.
    pub fn accept_ice(&self, candidate: &str, sdp_m_line_index: u32) -> Result<(), AppError> {
        self.webrtcbin
            .emit_by_name::<()>("add-ice-candidate", &[&sdp_m_line_index, &candidate]);
        Ok(())
    }

    /// Remove the consumer cleanly from the pipeline.
    ///
    /// Delegates to `pipeline::detach_webrtc_consumer`, which releases the
    /// tee request pad, sets the per-consumer chain to NULL, and removes the
    /// elements from the pipeline.
    pub fn disconnect(self, pipeline: &gst::Pipeline) -> Result<(), AppError> {
        detach_webrtc_consumer(pipeline, &self.window_label)
    }

    /// Set `do-nack=true` on a transceiver, but only if the property exists.
    ///
    /// `do-nack` was added on `GstWebRTCRTPTransceiver` in GStreamer 1.20;
    /// older runtimes silently lack the property. `set_property` panics on
    /// unknown property names, so we guard with `find_property` first.
    fn try_set_do_nack(transceiver: &gst_webrtc::WebRTCRTPTransceiver) {
        if transceiver.find_property("do-nack").is_some() {
            transceiver.set_property("do-nack", true);
        }
    }

    fn enable_existing_nack(webrtcbin: &gst::Element) {
        // Walk transceivers via the indexed `get-transceiver` action signal —
        // the returned GArray from `get-transceivers` does not map cleanly to
        // a typed Rust Vec across gstreamer-rs versions. Stop at the first
        // None; webrtcbin returns NULL once the index is past the end.
        let mut i: i32 = 0;
        loop {
            let t: Option<gst_webrtc::WebRTCRTPTransceiver> = webrtcbin
                .emit_by_name::<Option<gst_webrtc::WebRTCRTPTransceiver>>(
                    "get-transceiver",
                    &[&i],
                );
            match t {
                Some(t) => {
                    Self::try_set_do_nack(&t);
                    i += 1;
                }
                None => break,
            }
        }
    }

    fn wire_new_transceiver_nack(webrtcbin: &gst::Element) {
        webrtcbin.connect("on-new-transceiver", false, |values| {
            // values[0] = webrtcbin (Element), values[1] = transceiver (Object)
            if let Some(t) = values
                .get(1)
                .and_then(|v| v.get::<gst_webrtc::WebRTCRTPTransceiver>().ok())
            {
                Self::try_set_do_nack(&t);
            }
            None
        });
    }

    fn connect_negotiation_needed(
        webrtcbin: &gst::Element,
        window_label: &str,
        signaling: Arc<dyn SignalingChannel>,
    ) -> Result<(), AppError> {
        // We need to clone the webrtcbin handle into the signal callback so
        // it can fire the create-offer action signal. `gst::Element` is a
        // ref-counted GObject, cloning is cheap.
        let webrtcbin_for_cb = webrtcbin.clone();
        let label_for_cb = window_label.to_string();

        webrtcbin.connect("on-negotiation-needed", false, move |_values| {
            let bin = webrtcbin_for_cb.clone();
            let label = label_for_cb.clone();
            let signaling = signaling.clone();

            // Build a Promise that handles the create-offer reply.
            let promise = gst::Promise::with_change_func(move |reply| {
                let reply = match reply {
                    Ok(Some(r)) => r,
                    Ok(None) => {
                        gst::warning!(
                            gst::CAT_DEFAULT,
                            "video_pipeline: create-offer returned no reply for '{label}'"
                        );
                        return;
                    }
                    Err(e) => {
                        gst::warning!(
                            gst::CAT_DEFAULT,
                            "video_pipeline: create-offer failed for '{label}': {e:?}"
                        );
                        return;
                    }
                };

                let offer = match reply
                    .value("offer")
                    .ok()
                    .and_then(|v| v.get::<gst_webrtc::WebRTCSessionDescription>().ok())
                {
                    Some(o) => o,
                    None => {
                        gst::warning!(
                            gst::CAT_DEFAULT,
                            "video_pipeline: create-offer reply missing 'offer' field for '{label}'"
                        );
                        return;
                    }
                };

                // Apply the offer locally so webrtcbin transitions into
                // have-local-offer and starts gathering ICE candidates.
                let set_promise = gst::Promise::new();
                bin.emit_by_name::<()>("set-local-description", &[&offer, &set_promise]);

                // Forward the SDP to the signaling channel.
                let sdp = offer.sdp().as_text().unwrap_or_default();
                signaling.emit_offer(OfferPayload {
                    window_label: label.clone(),
                    sdp,
                });
            });

            webrtcbin_for_cb.emit_by_name::<()>("create-offer", &[&None::<gst::Structure>, &promise]);
            None
        });
        Ok(())
    }

    fn connect_on_ice_candidate(
        webrtcbin: &gst::Element,
        window_label: &str,
        signaling: Arc<dyn SignalingChannel>,
    ) -> Result<(), AppError> {
        let label_for_cb = window_label.to_string();
        webrtcbin.connect("on-ice-candidate", false, move |values| {
            // values[0]=webrtcbin, values[1]=mlineindex (u32),
            // values[2]=candidate (string)
            let mlineindex = values
                .get(1)
                .and_then(|v| v.get::<u32>().ok())
                .unwrap_or(0);
            let candidate = values
                .get(2)
                .and_then(|v| v.get::<String>().ok())
                .unwrap_or_default();
            signaling.emit_ice(IcePayload {
                window_label: label_for_cb.clone(),
                candidate,
                sdp_m_line_index: mlineindex,
            });
            None
        });
        Ok(())
    }
}

/// Centralised registry of [`Consumer`] instances keyed by Tauri window label.
///
/// Task 4.1 owns one `ConsumerRegistry` inside `AppState` and routes Tauri
/// command/event traffic through it. The registry itself is `Send + Sync` and
/// internally synchronises consumer access via a `Mutex`.
pub struct ConsumerRegistry {
    consumers: Mutex<HashMap<String, Consumer>>,
}

impl Default for ConsumerRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ConsumerRegistry {
    /// Construct an empty registry.
    pub fn new() -> Self {
        Self {
            consumers: Mutex::new(HashMap::new()),
        }
    }

    /// Register a new consumer for `window_label`.
    ///
    /// If a consumer already exists for the same label it is disconnected
    /// first (the call is idempotent for the caller's perspective).
    pub fn subscribe(
        &self,
        pipeline: &gst::Pipeline,
        window_label: &str,
        signaling: Arc<dyn SignalingChannel>,
    ) -> Result<(), AppError> {
        // Disconnect any pre-existing consumer for this window.
        self.unsubscribe(pipeline, window_label)?;

        let consumer = Consumer::new(pipeline, window_label.to_string(), signaling)?;
        let mut guard = self.consumers.lock()?;
        guard.insert(window_label.to_string(), consumer);
        Ok(())
    }

    /// Tear down the consumer for `window_label` if present.
    pub fn unsubscribe(&self, pipeline: &gst::Pipeline, window_label: &str) -> Result<(), AppError> {
        let removed = {
            let mut guard = self.consumers.lock()?;
            guard.remove(window_label)
        };
        if let Some(consumer) = removed {
            consumer.disconnect(pipeline)?;
        } else {
            // Idempotent — best-effort cleanup of any orphaned pipeline elements.
            detach_webrtc_consumer(pipeline, window_label)?;
        }
        Ok(())
    }

    /// Forward an SDP answer from the frontend to the matching consumer.
    pub fn dispatch_answer(&self, payload: AnswerPayload) -> Result<(), AppError> {
        let guard = self.consumers.lock()?;
        let consumer = guard.get(&payload.window_label).ok_or_else(|| {
            AppError::NotFound(format!(
                "video_pipeline: no consumer for window '{}'",
                payload.window_label
            ))
        })?;
        consumer.accept_answer(&payload.sdp)
    }

    /// Forward a remote ICE candidate from the frontend to the matching consumer.
    pub fn dispatch_ice(&self, payload: IcePayload) -> Result<(), AppError> {
        let guard = self.consumers.lock()?;
        let consumer = guard.get(&payload.window_label).ok_or_else(|| {
            AppError::NotFound(format!(
                "video_pipeline: no consumer for window '{}'",
                payload.window_label
            ))
        })?;
        consumer.accept_ice(&payload.candidate, payload.sdp_m_line_index)
    }

    /// Number of active consumers.
    pub fn len(&self) -> Result<usize, AppError> {
        Ok(self.consumers.lock()?.len())
    }

    /// True when no consumers are registered.
    pub fn is_empty(&self) -> Result<bool, AppError> {
        Ok(self.consumers.lock()?.is_empty())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::video_pipeline::pipeline::{build_base_pipeline, ensure_initialized, set_source_uri};
    use crate::video_pipeline::signaling::{MpscSignalingChannel, SignalingEvent};
    use std::path::PathBuf;
    use std::sync::mpsc::{channel, RecvTimeoutError};
    use std::sync::Once;
    use std::time::{Duration, Instant};

    /// Reuse the integration-test fixture if present; otherwise generate a
    /// tiny one inline. We do NOT depend on the integration-test module so
    /// the unit test stays runnable through `cargo test --lib`.
    static FIXTURE_INIT: Once = Once::new();
    static mut FIXTURE_RESULT: Option<Result<PathBuf, String>> = None;

    fn ensure_fixture() -> Result<PathBuf, String> {
        FIXTURE_INIT.call_once(|| {
            // SAFETY: `Once::call_once` guarantees single-threaded execution.
            unsafe {
                FIXTURE_RESULT = Some(generate_fixture());
            }
        });
        // SAFETY: see above — read happens-after the write.
        unsafe {
            match &*std::ptr::addr_of!(FIXTURE_RESULT) {
                Some(Ok(p)) => Ok(p.clone()),
                Some(Err(e)) => Err(e.clone()),
                None => Err("fixture init did not run".into()),
            }
        }
    }

    fn generate_fixture() -> Result<PathBuf, String> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("short.mp4");
        if path.exists() {
            return Ok(path);
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("create fixtures dir: {e}"))?;
        }

        ensure_initialized().map_err(|e| format!("gst init: {e}"))?;
        let pipeline = gst::Pipeline::with_name("consumer_test_fixture");

        let make = |factory: &str, name: &str| -> Result<gst::Element, String> {
            gst::ElementFactory::make(factory)
                .name(name)
                .build()
                .map_err(|e| format!("create '{factory}': {e}"))
        };

        let vsrc = make("videotestsrc", "fix_vsrc")?;
        vsrc.set_property("num-buffers", 30i32);
        let vconvert = make("videoconvert", "fix_vconvert")?;
        let venc = gst::ElementFactory::make("x264enc")
            .name("fix_venc")
            .property_from_str("speed-preset", "ultrafast")
            .property_from_str("tune", "zerolatency")
            .build()
            .map_err(|e| format!("create 'x264enc': {e}"))?;
        let vparse = make("h264parse", "fix_vparse")?;
        let asrc = make("audiotestsrc", "fix_asrc")?;
        asrc.set_property("num-buffers", 30i32);
        let aconvert = make("audioconvert", "fix_aconvert")?;
        let aresample = make("audioresample", "fix_aresample")?;
        let aenc = make("avenc_aac", "fix_aenc")?;
        let aparse = make("aacparse", "fix_aparse")?;
        let mux = make("mp4mux", "fix_mux")?;
        let sink = make("filesink", "fix_sink")?;
        sink.set_property("location", path.to_string_lossy().as_ref());

        pipeline
            .add_many([
                &vsrc, &vconvert, &venc, &vparse, &asrc, &aconvert, &aresample, &aenc, &aparse, &mux,
                &sink,
            ])
            .map_err(|e| format!("fixture add_many: {e}"))?;
        gst::Element::link_many([&vsrc, &vconvert, &venc, &vparse, &mux])
            .map_err(|e| format!("fixture link video: {e}"))?;
        gst::Element::link_many([&asrc, &aconvert, &aresample, &aenc, &aparse, &mux])
            .map_err(|e| format!("fixture link audio: {e}"))?;
        gst::Element::link_many([&mux, &sink]).map_err(|e| format!("fixture link mux->sink: {e}"))?;

        pipeline
            .set_state(gst::State::Playing)
            .map_err(|e| format!("fixture playing: {e}"))?;
        let bus = pipeline.bus().ok_or("fixture: no bus")?;
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut got_eos = false;
        while Instant::now() < deadline {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let timeout = gst::ClockTime::from_mseconds(remaining.as_millis().min(200) as u64);
            if let Some(msg) = bus.timed_pop(timeout) {
                match msg.view() {
                    gst::MessageView::Eos(_) => {
                        got_eos = true;
                        break;
                    }
                    gst::MessageView::Error(e) => {
                        let _ = pipeline.set_state(gst::State::Null);
                        return Err(format!("fixture error: {} ({:?})", e.error(), e.debug()));
                    }
                    _ => {}
                }
            }
        }
        let _ = pipeline.set_state(gst::State::Null);
        if !got_eos {
            return Err("fixture did not reach EOS".into());
        }
        Ok(path)
    }

    /// Integration-style smoke test: bring a real pipeline to PLAYING with a
    /// real fixture, register one consumer, and assert that an
    /// `OfferPayload` propagates through the SignalingChannel within a few
    /// seconds.
    ///
    /// The plan's "completes SDP handshake in-process" criterion is
    /// downgraded to "offer reaches the channel" because finishing the
    /// handshake requires a matching peer (a second webrtcbin can't talk to
    /// the first one in-process without a non-trivial test harness, see
    /// implementer notes in the plan's Task 1.3).
    #[test]
    fn subscribe_emits_offer_through_signaling_channel() {
        let fixture = match ensure_fixture() {
            Ok(p) => p,
            Err(e) => {
                eprintln!("skipping: fixture unavailable ({e})");
                return;
            }
        };

        let built = build_base_pipeline().expect("build base pipeline");
        let pipeline = built.pipeline;
        let uri = format!("file://{}", fixture.display());
        set_source_uri(&pipeline, &uri).expect("set uri");

        let (tx, rx) = channel();
        let signaling = Arc::new(MpscSignalingChannel::new(tx));
        let registry = ConsumerRegistry::new();

        registry
            .subscribe(&pipeline, "test_consumer", signaling)
            .expect("subscribe");
        assert_eq!(registry.len().expect("len"), 1);

        pipeline
            .set_state(gst::State::Playing)
            .expect("set state PLAYING");

        // Wait up to 5s for the offer to arrive. Negotiation triggers as
        // soon as the upstream caps reach the encoder via the tee fan-out.
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut got_offer: Option<OfferPayload> = None;
        while Instant::now() < deadline && got_offer.is_none() {
            let remaining = deadline.saturating_duration_since(Instant::now());
            match rx.recv_timeout(remaining.min(Duration::from_millis(250))) {
                Ok(SignalingEvent::Offer(p)) => {
                    got_offer = Some(p);
                    break;
                }
                Ok(SignalingEvent::Ice(_)) => {
                    // ICE candidates may arrive before the offer payload is
                    // reported — keep draining.
                    continue;
                }
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }

        let _ = pipeline.set_state(gst::State::Null);

        let offer = got_offer.expect("did not receive an offer within 5s");
        assert_eq!(offer.window_label, "test_consumer");
        assert!(offer.sdp.starts_with("v=0"), "sdp should start with v=0");
        assert!(
            offer.sdp.contains("m=video"),
            "sdp should contain a video m-line"
        );
    }

    #[test]
    fn accept_answer_rejects_empty_sdp() {
        ensure_initialized().expect("gst init");
        let built = build_base_pipeline().expect("build base pipeline");
        let pipeline = built.pipeline;
        let signaling: Arc<dyn SignalingChannel> = Arc::new(crate::video_pipeline::signaling::NoopSignalingChannel);
        let registry = ConsumerRegistry::new();
        registry
            .subscribe(&pipeline, "rtc_test_empty", signaling)
            .expect("subscribe");

        let result = registry.dispatch_answer(AnswerPayload {
            window_label: "rtc_test_empty".into(),
            sdp: String::new(),
        });
        assert!(matches!(result, Err(AppError::Internal(_))));

        registry
            .unsubscribe(&pipeline, "rtc_test_empty")
            .expect("unsubscribe");
        let _ = pipeline.set_state(gst::State::Null);
    }

    #[test]
    fn dispatch_to_unknown_window_returns_not_found() {
        ensure_initialized().expect("gst init");
        let built = build_base_pipeline().expect("build base pipeline");
        let pipeline = built.pipeline;
        let registry = ConsumerRegistry::new();

        let err = registry
            .dispatch_answer(AnswerPayload {
                window_label: "ghost".into(),
                sdp: "v=0\r\n".into(),
            })
            .expect_err("dispatch_answer should fail");
        assert!(matches!(err, AppError::NotFound(_)));

        let err = registry
            .dispatch_ice(IcePayload {
                window_label: "ghost".into(),
                candidate: "candidate:1".into(),
                sdp_m_line_index: 0,
            })
            .expect_err("dispatch_ice should fail");
        assert!(matches!(err, AppError::NotFound(_)));

        let _ = pipeline.set_state(gst::State::Null);
    }

    #[test]
    fn subscribe_replaces_previous_consumer_for_same_window() {
        ensure_initialized().expect("gst init");
        let built = build_base_pipeline().expect("build base pipeline");
        let pipeline = built.pipeline;
        let signaling: Arc<dyn SignalingChannel> =
            Arc::new(crate::video_pipeline::signaling::NoopSignalingChannel);
        let registry = ConsumerRegistry::new();

        registry
            .subscribe(&pipeline, "rtc_replace", signaling.clone())
            .expect("first subscribe");
        assert_eq!(registry.len().expect("len"), 1);
        registry
            .subscribe(&pipeline, "rtc_replace", signaling)
            .expect("second subscribe");
        assert_eq!(registry.len().expect("len"), 1);

        registry
            .unsubscribe(&pipeline, "rtc_replace")
            .expect("unsubscribe");
        assert_eq!(registry.len().expect("len"), 0);

        // Idempotent unsubscribe.
        registry
            .unsubscribe(&pipeline, "rtc_replace")
            .expect("unsubscribe again");
        let _ = pipeline.set_state(gst::State::Null);
    }
}
