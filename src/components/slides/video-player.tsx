import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  fit?: "contain" | "cover";
  className?: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export function VideoPlayer({
  src,
  autoPlay = false,
  loop = false,
  muted = false,
  controls = false,
  fit = "contain",
  className,
  onEnded,
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [src]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        controls={controls}
        playsInline
        preload="metadata"
        className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")}
        onLoadedData={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError("1");
        }}
        onEnded={onEnded}
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      />

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        </div>
      )}

      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-xl text-destructive-foreground">
          !
        </div>
      )}
    </div>
  );
}
