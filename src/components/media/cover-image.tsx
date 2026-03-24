import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useImageSrc } from "../../hooks/use-image-src";

interface CoverImageProps {
  path?: string | null;
  title: string;
  className?: string;
  fallback?: ReactNode;
}

export function CoverImage({ path, title, className, fallback }: CoverImageProps) {
  const src = useImageSrc(path);
  const [failed, setFailed] = useState(false);

  // Reset error state when the path changes
  useEffect(() => {
    setFailed(false);
  }, [path]);

  const initials = useMemo(() => {
    const words = title
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (words.length === 0) return "NA";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }, [title]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted",
          className,
        )}
      >
        {fallback ?? (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            <span className="mt-1 text-[10px] font-semibold tracking-wide">{initials}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      className={cn("h-16 w-16 shrink-0 rounded-md object-cover", className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
