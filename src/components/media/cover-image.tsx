import { useEffect, useMemo, useState, type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { catcher } from "../../lib/catcher";

interface CoverImageProps {
  path?: string | null;
  title: string;
  className?: string;
  fallback?: ReactNode;
}

function isAbsolutePath(path: string): boolean {
  // Matches /path or C:\path or C:/path
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

export function CoverImage({ path, title, className, fallback }: CoverImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    async function resolveSrc() {
      if (!path || path.trim().length === 0) {
        if (!cancelled) setSrc(null);
        return;
      }

      // Normalize separators for consistent checks
      const normalized = path.trim().replace(/\\/g, "/");

      if (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("blob:")
      ) {
        // Covers must come from managed/local media paths only.
        if (!cancelled) setSrc(null);
        return;
      }

      if (isAbsolutePath(normalized)) {
        if (!cancelled) setSrc(convertFileSrc(normalized));
        return;
      }

      if (normalized.startsWith("media/")) {
        const [absolute, error] = await catcher(
          async () => {
            const appDir = await appDataDir();
            return await join(appDir, normalized);
          },
          { notify: false },
        );

        if (error) {
          if (!cancelled) setSrc(null);
          return;
        }

        if (!cancelled) setSrc(convertFileSrc(absolute));
        return;
      }

      // Fallback: if it's not a known prefix but could be a filename in media root
      // Or just use as-is if it's already a valid URI we didn't catch
      if (!cancelled) setSrc(normalized);
    }

    void resolveSrc();
    return () => {
      cancelled = true;
    };
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
