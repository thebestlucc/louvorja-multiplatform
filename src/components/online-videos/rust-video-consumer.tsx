import { useRef } from "react";
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
 */
export function RustVideoConsumer({
  windowLabel,
  muted,
  className,
}: RustVideoConsumerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useRustVideoPipeline({ windowLabel, videoRef });

  return (
    <video
      ref={videoRef}
      data-testid="rust-video-consumer"
      playsInline
      autoPlay
      muted={muted}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}
