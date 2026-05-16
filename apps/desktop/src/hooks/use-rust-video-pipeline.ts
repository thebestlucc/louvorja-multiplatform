import { useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { events } from "../lib/bindings";
import {
  sendAnswer,
  sendIce,
  subscribe,
  unsubscribe,
} from "../lib/tauri/video-pipeline";

interface Options {
  /** Tauri window label for this consumer (e.g. "main", "projector", "return"). */
  windowLabel: string;
  /** Ref to the `<video>` element that will receive the inbound MediaStream. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** When false, the hook is dormant: no subscribe, no listeners. Defaults to true. */
  enabled?: boolean;
}

interface Result {
  /** Current peer-connection state, useful for UI feedback / diagnostics. */
  connectionState: RTCPeerConnectionState | "idle";
}

/**
 * Subscribes a single window to the Rust GStreamer → WebRTC video pipeline.
 *
 * Lifecycle:
 *  1. On mount (if `enabled`), invoke `videoPipelineSubscribe` and register
 *     listeners for `videoPipelineOffer` / `videoPipelineIce` events.
 *  2. When an offer arrives for THIS `windowLabel`, build a fresh
 *     `RTCPeerConnection`, set the remote description, create an answer,
 *     and forward the answer back via `videoPipelineAnswer`.
 *  3. Locally generated ICE candidates are forwarded via `videoPipelineIce`.
 *     Remote ICE candidates received over the event bus are added to the PC.
 *  4. On the first `track` event, attach `event.streams[0]` to `videoRef`.
 *  5. On unmount or when disabled, close the PC and unsubscribe.
 *
 * Multiple windows share the event bus, so payloads are filtered by
 * `windowLabel` before being acted on.
 */
export function useRustVideoPipeline({
  windowLabel,
  videoRef,
  enabled = true,
}: Options): Result {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<
    RTCPeerConnectionState | "idle"
  >("idle");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];

    const closePc = () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (err) {
        console.error("[rust-video-pipeline] error closing PC", err);
      }
      pcRef.current = null;
      setConnectionState("idle");
    };

    const handleOffer = async (sdp: string) => {
      // Replace any prior connection (Rust re-offers when the encoder restarts).
      closePc();

      const pc = new RTCPeerConnection({ iceServers: [] });
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        const candidate = event.candidate;
        if (!candidate) {
          // End-of-candidates: nothing to forward to Rust.
          return;
        }
        sendIce(windowLabel, candidate.candidate, candidate.sdpMLineIndex ?? 0).catch(
          (err) => {
            console.error("[rust-video-pipeline] sendIce failed", err);
          },
        );
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        const el = videoRef.current;
        if (!el) return;
        if (el.srcObject !== stream) {
          el.srcObject = stream;
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
      };

      try {
        await pc.setRemoteDescription({ type: "offer", sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const localSdp = pc.localDescription?.sdp ?? answer.sdp ?? "";
        await sendAnswer(windowLabel, localSdp);
      } catch (err) {
        console.error("[rust-video-pipeline] offer/answer negotiation failed", err);
        closePc();
      }
    };

    const handleRemoteIce = async (candidate: string, sdpMLineIndex: number) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate({ candidate, sdpMLineIndex });
      } catch (err) {
        console.error("[rust-video-pipeline] addIceCandidate failed", err);
      }
    };

    const setup = async () => {
      try {
        const offerUnlisten = await events.videoPipelineOffer.listen((event) => {
          const payload = event.payload;
          if (payload.windowLabel !== windowLabel) return;
          handleOffer(payload.sdp).catch((err) => {
            console.error("[rust-video-pipeline] handleOffer threw", err);
          });
        });
        if (cancelled) {
          offerUnlisten();
          return;
        }
        unlisteners.push(offerUnlisten);

        const iceUnlisten = await events.videoPipelineIce.listen((event) => {
          const payload = event.payload;
          if (payload.windowLabel !== windowLabel) return;
          handleRemoteIce(payload.candidate, payload.sdpMLineIndex).catch((err) => {
            console.error("[rust-video-pipeline] handleRemoteIce threw", err);
          });
        });
        if (cancelled) {
          iceUnlisten();
          return;
        }
        unlisteners.push(iceUnlisten);

        await subscribe(windowLabel);
      } catch (err) {
        console.error("[rust-video-pipeline] setup failed", err);
      }
    };

    setup();

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          console.error("[rust-video-pipeline] unlisten failed", err);
        }
      });
      closePc();
      unsubscribe(windowLabel).catch((err) => {
        console.error("[rust-video-pipeline] unsubscribe failed", err);
      });
    };
  }, [enabled, windowLabel, videoRef]);

  return { connectionState };
}
