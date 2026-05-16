import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TileItem {
  index: number;
  label: string;
  sublabel?: string;
}

export interface TileGridProps {
  tiles: TileItem[];
  activeIndex: number;
  onTileClick: (index: number) => void;
  className?: string;
}

export function TileGrid({ tiles, activeIndex, onTileClick, className }: TileGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 p-3 overflow-y-auto", className)}>
      {tiles.map((tile) => {
        const isActive = tile.index === activeIndex;
        return (
          <button
            key={tile.index}
            type="button"
            aria-label={tile.label}
            aria-pressed={isActive}
            onClick={() => onTileClick(tile.index)}
            className={cn(
              "relative rounded-lg p-3 min-h-[80px] flex flex-col justify-between cursor-pointer",
              "border transition-transform active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive
                ? "border-primary ring-1 ring-primary bg-primary/5 text-fg"
                : "border-border bg-surface-1 hover:bg-surface-2",
            )}
          >
            {/* Active badge */}
            {isActive && (
              <span
                className="absolute top-2 right-2 text-primary"
                aria-hidden="true"
              >
                <Play className="h-3 w-3 fill-primary" />
              </span>
            )}

            <span className="text-sm font-medium text-fg line-clamp-2 pr-4">{tile.label}</span>

            {tile.sublabel && (
              <span className="text-xs text-fg-muted mt-1">{tile.sublabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
