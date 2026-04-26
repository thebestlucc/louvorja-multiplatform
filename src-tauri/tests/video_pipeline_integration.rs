//! Integration test for the Rust video pipeline base graph
//! (see `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 1.2).
//!
//! Generates a tiny MP4 fixture on first run (gitignored), then asserts that
//! `build_base_pipeline` reaches PLAYING within 2 seconds when fed the file.

use gstreamer as gst;
use gstreamer::prelude::*;
use louvorja_multiplatform::video_pipeline::pipeline::{
    attach_webrtc_consumer, build_base_pipeline, detach_webrtc_consumer, ensure_initialized,
    set_source_uri,
};
use std::path::PathBuf;
use std::sync::Once;
use std::time::{Duration, Instant};

static FIXTURE_INIT: Once = Once::new();
static mut FIXTURE_RESULT: Option<Result<PathBuf, String>> = None;

fn ensure_fixture() -> Result<PathBuf, String> {
    FIXTURE_INIT.call_once(|| {
        // SAFETY: `Once::call_once` guarantees single-threaded execution.
        unsafe {
            FIXTURE_RESULT = Some(generate_fixture());
        }
    });
    // SAFETY: see above.
    unsafe {
        match &*std::ptr::addr_of!(FIXTURE_RESULT) {
            Some(Ok(p)) => Ok(p.clone()),
            Some(Err(e)) => Err(e.clone()),
            None => Err("fixture init did not run".into()),
        }
    }
}

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("short.mp4")
}

fn generate_fixture() -> Result<PathBuf, String> {
    let path = fixture_path();
    if path.exists() {
        return Ok(path);
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create fixtures dir: {e}"))?;
    }

    ensure_initialized().map_err(|e| format!("gst init: {e}"))?;

    // Build a recorder muxing one short video + audio track:
    //   videotestsrc -> x264enc -> h264parse -\
    //                                          mp4mux -> filesink
    //   audiotestsrc -> avenc_aac -> aacparse -/
    //
    // Audio is required so the production pipeline (which always has a live
    // autoaudiosink) can preroll; an audio-less fixture stalls in PAUSED
    // because the sink never gets data.
    let pipeline = gst::Pipeline::with_name("fixture_recorder");

    let vsrc = make("videotestsrc", "fixture_vsrc")?;
    vsrc.set_property("num-buffers", 30i32);
    let vconvert = make("videoconvert", "fixture_vconvert")?;
    let venc = gst::ElementFactory::make("x264enc")
        .name("fixture_venc")
        .property_from_str("speed-preset", "ultrafast")
        .property_from_str("tune", "zerolatency")
        .build()
        .map_err(|e| {
            format!(
                "create 'x264enc': {e} — plugin missing. Install GStreamer's \
                 gst-plugins-ugly (e.g. `brew install gst-plugins-ugly`) or \
                 commit a pre-generated tests/fixtures/short.mp4."
            )
        })?;
    let vparse = make("h264parse", "fixture_vparse")?;

    let asrc = make("audiotestsrc", "fixture_asrc")?;
    asrc.set_property("num-buffers", 30i32);
    let aconvert = make("audioconvert", "fixture_aconvert")?;
    let aresample = make("audioresample", "fixture_aresample")?;
    let aenc = make("avenc_aac", "fixture_aenc").map_err(|e| {
        format!(
            "{e} — avenc_aac plugin missing. Install GStreamer's gst-libav \
             (e.g. `brew install gst-libav`) or commit a pre-generated \
             tests/fixtures/short.mp4."
        )
    })?;
    let aparse = make("aacparse", "fixture_aparse")?;

    let mux = make("mp4mux", "fixture_mux")?;
    let sink = make("filesink", "fixture_sink")?;
    sink.set_property("location", path.to_string_lossy().as_ref());

    pipeline
        .add_many([
            &vsrc, &vconvert, &venc, &vparse, &asrc, &aconvert, &aresample, &aenc, &aparse, &mux,
            &sink,
        ])
        .map_err(|e| format!("fixture add_many: {e}"))?;

    gst::Element::link_many([&vsrc, &vconvert, &venc, &vparse, &mux])
        .map_err(|e| format!("fixture link video chain: {e}"))?;
    gst::Element::link_many([&asrc, &aconvert, &aresample, &aenc, &aparse, &mux])
        .map_err(|e| format!("fixture link audio chain: {e}"))?;
    gst::Element::link_many([&mux, &sink])
        .map_err(|e| format!("fixture link mux->sink: {e}"))?;

    pipeline
        .set_state(gst::State::Playing)
        .map_err(|e| format!("fixture playing: {e}"))?;

    let bus = pipeline
        .bus()
        .ok_or_else(|| "fixture: pipeline has no bus".to_string())?;
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
                    return Err(format!(
                        "fixture pipeline error: {} ({:?})",
                        e.error(),
                        e.debug()
                    ));
                }
                _ => {}
            }
        }
    }
    pipeline
        .set_state(gst::State::Null)
        .map_err(|e| format!("fixture null: {e}"))?;

    if !got_eos {
        return Err("fixture pipeline did not reach EOS within 10s".into());
    }
    if !path.exists() {
        return Err(format!("fixture file was not written at {}", path.display()));
    }
    Ok(path)
}

fn make(factory: &str, name: &str) -> Result<gst::Element, String> {
    gst::ElementFactory::make(factory)
        .name(name)
        .build()
        .map_err(|e| format!("create '{factory}': {e}"))
}

#[test]
fn video_pipeline_reaches_playing_within_2s() {
    let fixture = ensure_fixture().expect("fixture generation");
    let built = build_base_pipeline().expect("build base pipeline");
    let pipeline = built.pipeline;
    let uri = format!("file://{}", fixture.display());
    set_source_uri(&pipeline, &uri).expect("set uri");

    pipeline
        .set_state(gst::State::Playing)
        .expect("set state PLAYING");

    let bus = pipeline.bus().expect("bus");
    let deadline = Instant::now() + Duration::from_secs(2);
    let mut reached_playing = false;
    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let timeout = gst::ClockTime::from_mseconds(remaining.as_millis().min(100) as u64);
        if let Some(msg) = bus.timed_pop(timeout) {
            match msg.view() {
                gst::MessageView::StateChanged(sc) => {
                    let from_pipeline = sc
                        .src()
                        .and_then(|s| s.clone().downcast::<gst::Pipeline>().ok())
                        .map(|p| p == pipeline)
                        .unwrap_or(false);
                    if from_pipeline && sc.current() == gst::State::Playing {
                        reached_playing = true;
                        break;
                    }
                }
                gst::MessageView::Error(e) => {
                    let _ = pipeline.set_state(gst::State::Null);
                    panic!("pipeline error: {} ({:?})", e.error(), e.debug());
                }
                gst::MessageView::Eos(_) => break,
                _ => {}
            }
        }
    }

    let _ = pipeline.set_state(gst::State::Null);
    assert!(
        reached_playing,
        "pipeline did not reach PLAYING within 2s (uri = {uri})"
    );
}

#[test]
fn video_pipeline_attach_and_detach_webrtc_consumer_round_trip() {
    let built = build_base_pipeline().expect("build base pipeline");
    let pipeline = built.pipeline;

    let webrtc = attach_webrtc_consumer(&pipeline, "rtc_test").expect("attach");
    assert_eq!(webrtc.factory().map(|f| f.name().to_string()).as_deref(), Some("webrtcbin"));
    assert!(pipeline.by_name("rtc_test").is_some());
    assert!(pipeline.by_name("rtc_test_queue").is_some());
    assert!(pipeline.by_name("rtc_test_caps").is_some());

    detach_webrtc_consumer(&pipeline, "rtc_test").expect("detach");
    assert!(pipeline.by_name("rtc_test").is_none());
    assert!(pipeline.by_name("rtc_test_queue").is_none());
    assert!(pipeline.by_name("rtc_test_caps").is_none());

    // Idempotent — second detach is a no-op.
    detach_webrtc_consumer(&pipeline, "rtc_test").expect("detach again");

    let _ = pipeline.set_state(gst::State::Null);
}
