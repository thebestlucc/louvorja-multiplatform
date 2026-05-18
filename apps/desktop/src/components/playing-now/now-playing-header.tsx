import { Snowflake, MoreHorizontal, Square } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface NowPlayingHeaderProps {
  title: string;
  subtitle?: string;
  onFreezeToggle: () => void;
  frozen: boolean;
  onBlackToggle: () => void;
  isBlack: boolean;
  className?: string;
}

export function NowPlayingHeader({
  title,
  subtitle,
  onFreezeToggle,
  frozen,
  onBlackToggle,
  isBlack,
  className,
}: NowPlayingHeaderProps) {
  return (
    <div className={cn("flex h-14 shrink-0 items-center justify-between px-4", className)}>
      {/* Left: title + subtitle */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-lg font-semibold text-foreground">{title}</span>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>

      {/* Right: overlay buttons */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          aria-label="Toggle black screen"
          onClick={onBlackToggle}
          className={cn(
            isBlack && "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          )}
        >
          <Square className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1.5">Black</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          aria-label="Toggle freeze"
          onClick={onFreezeToggle}
          className={cn(
            frozen && "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          )}
        >
          <Snowflake className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1.5">Freeze</span>
        </Button>

        <Button variant="ghost" size="sm" aria-label="More options">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
