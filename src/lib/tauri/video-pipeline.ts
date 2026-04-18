import { commands, type AppErrorResponse, type MediaSource, type Result } from "../bindings";

function unwrap<T>(result: Result<T, AppErrorResponse>): T {
  if (result.status === "error") {
    const message = result.error?.message ?? "video pipeline error";
    throw new Error(message);
  }
  return result.data;
}

/**
 * Subscribe a window to the Rust video pipeline. Triggers an SDP offer
 * to flow back via the `videoPipelineOffer` typed event.
 */
export async function subscribe(windowLabel: string): Promise<null> {
  return unwrap(await commands.videoPipelineSubscribe(windowLabel));
}

/**
 * Tear down the Rust-side WebRTC consumer for the given window.
 */
export async function unsubscribe(windowLabel: string): Promise<null> {
  return unwrap(await commands.videoPipelineUnsubscribe(windowLabel));
}

/**
 * Forward an SDP answer from the frontend `RTCPeerConnection` back to Rust.
 */
export async function sendAnswer(windowLabel: string, sdp: string): Promise<null> {
  return unwrap(await commands.videoPipelineAnswer(windowLabel, sdp));
}

/**
 * Forward a local ICE candidate from the frontend `RTCPeerConnection` to Rust.
 * For the end-of-candidates sentinel, callers should pass an empty string.
 */
export async function sendIce(
  windowLabel: string,
  candidate: string,
  sdpMLineIndex: number,
): Promise<null> {
  return unwrap(await commands.videoPipelineIce(windowLabel, candidate, sdpMLineIndex));
}

/**
 * Resolve `source` to a GStreamer URI and load it on the pipeline.
 */
export async function load(source: MediaSource): Promise<null> {
  return unwrap(await commands.videoPipelineLoad(source));
}

/** Transition the pipeline to PLAYING. */
export async function play(): Promise<null> {
  return unwrap(await commands.videoPipelinePlay());
}

/** Transition the pipeline to PAUSED. */
export async function pause(): Promise<null> {
  return unwrap(await commands.videoPipelinePause());
}

/** Seek the pipeline to `secs`. */
export async function seek(secs: number): Promise<null> {
  return unwrap(await commands.videoPipelineSeek(secs));
}

/**
 * Update the playback volume (0.0–1.0). Snapshot-only until the audio chain
 * grows a `volume` element (Task 3.x).
 */
export async function setVolume(volume: number): Promise<null> {
  return unwrap(await commands.videoPipelineSetVolume(volume));
}

/** Tear down the pipeline and reset the snapshot. */
export async function unload(): Promise<null> {
  return unwrap(await commands.videoPipelineUnload());
}

/** Seek to 0 and resume PLAYING (Task 3.1). */
export async function restart(): Promise<null> {
  return unwrap(await commands.videoPipelineRestart());
}

/** Set the loop mode (Task 3.1). */
export async function setLoop(mode: "none" | "one"): Promise<null> {
  return unwrap(await commands.videoPipelineSetLoop(mode));
}
