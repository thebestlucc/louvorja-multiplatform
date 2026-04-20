import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { OverlayState } from "../../lib/bindings";
import { getOverlayState } from "../../lib/tauri";
import { useRustVideoPipeline } from "../../hooks/use-rust-video-pipeline";
import { cn } from "../../lib/utils";

export interface RustVideoConsumerProps {
  /** Tauri window label for this consumer (e.g. "main", "projector", "return"). */
  windowLabel: string;
  /** Mute the local `<video>` element. Followers should be muted; only one master plays audio. */
  muted: boolean;
  className?: string;
}

/**
 * Renders the live MediaStream from the Rust GStreamer → WebRTC pipeline.
 *
 * Stateless beyond the internal `<video>` ref; the connection lifecycle is
 * driven entirely by `useRustVideoPipeline`. Coexists with the legacy
 * `VideoFollowerElement` until Phase 7 cleanup.
 *
 * Hides the `<video>` element via `display:none` while a black-screen or
 * logo-screen overlay is active. The Rust pipeline keeps running and audio
 * keeps playing (it flows directly from Rust to the OS, not through the
 * MediaStream), so the overlay clears cleanly back to live video.
 */
export function RustVideoConsumer({
  windowLabel,
  muted,
  className,
}: RustVideoConsumerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useRustVideoPipeline({ windowLabel, videoRef });

  const [overlayActive, setOverlayActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Seed initial state in case the component mounts while an overlay is on.
    getOverlayState()
      .then((s) => {
        if (cancelled) return;
        setOverlayActive(!!s.blackScreen || !!s.logoScreen);
      })
      .catch(() => {});

    const unlistenPromise = listen<OverlayState>("overlay-changed", (event) => {
      setOverlayActive(!!event.payload.blackScreen || !!event.payload.logoScreen);
    });

    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn()).catch(() => {});
    };
  }, []);

  return (
    <video
      ref={videoRef}
      data-testid="rust-video-consumer"
      playsInline
      autoPlay
      muted={muted}
      className={cn("h-full w-full object-contain", className)}
      style={overlayActive ? { display: "none" } : undefined}
    />
  );
}
