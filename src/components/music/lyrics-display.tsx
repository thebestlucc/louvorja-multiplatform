import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

interface LyricsDisplayProps {
  lyrics: string;
  activeStanza: number;
  onStanzaClick?: (index: number) => void;
}

export function LyricsDisplay({ lyrics, activeStanza, onStanzaClick }: LyricsDisplayProps) {
  const stanzas = lyrics.split("\n\n").filter((s) => s.trim().length > 0);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeStanza]);

  if (stanzas.length === 0) {
    return <p className="text-sm text-muted-foreground">No lyrics available</p>;
  }

  return (
    <div className="space-y-3">
      {stanzas.map((stanza, i) => (
        <div
          key={i}
          ref={i === activeStanza ? activeRef : undefined}
          className={cn(
            "cursor-pointer rounded-md border p-3 text-sm transition-colors",
            i === activeStanza
              ? "border-primary bg-primary/10 text-foreground"
              : "border-transparent text-muted-foreground hover:bg-surface-hover",
          )}
          onClick={() => onStanzaClick?.(i)}
        >
          <p className="whitespace-pre-line">{stanza.trim()}</p>
        </div>
      ))}
    </div>
  );
}
