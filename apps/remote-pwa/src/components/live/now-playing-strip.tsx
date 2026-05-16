import { cn } from "@/lib/utils";

export interface NowPlayingStripProps {
  title: string;
  subtitle?: string;
  coverUrl?: string;
  className?: string;
}

export function NowPlayingStrip({ title, subtitle, coverUrl, className }: NowPlayingStripProps) {
  return (
    <div
      className={cn(
        "h-16 flex items-center gap-3 px-4 border-b border-border bg-surface flex-shrink-0",
        className,
      )}
    >
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden bg-surface-2">
        {coverUrl ? (
          <img src={coverUrl} alt="" aria-hidden="true" className="w-full h-full object-cover" />
        ) : null}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-sm font-semibold text-fg truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-fg-muted truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
