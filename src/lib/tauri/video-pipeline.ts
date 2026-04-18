import { commands, type AppErrorResponse, type Result } from "../bindings";

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
