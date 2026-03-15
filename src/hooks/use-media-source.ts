import { useEffect, useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { catcher } from "../lib/catcher";

const mediaSourceCache = new Map<string, string>();

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

export function useMediaSource(path: string | null | undefined): string | null {
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolvePath = async () => {
      if (!path || path.trim().length === 0) {
        if (!cancelled) {
          setResolvedPath(null);
        }
        return;
      }

      // Normalize separators for consistent checks
      const normalized = path.trim().replace(/\\/g, "/");

      if (
        normalized.startsWith("data:")
        || normalized.startsWith("blob:")
        || normalized.startsWith("http://")
        || normalized.startsWith("https://")
      ) {
        if (!cancelled) {
          setResolvedPath(normalized);
        }
        return;
      }

      if (mediaSourceCache.has(normalized)) {
        if (!cancelled) {
          setResolvedPath(mediaSourceCache.get(normalized) ?? null);
        }
        return;
      }

      if (isAbsolutePath(normalized)) {
        const fileUrl = convertFileSrc(normalized);
        mediaSourceCache.set(normalized, fileUrl);
        if (!cancelled) {
          setResolvedPath(fileUrl);
        }
        return;
      }

      if (normalized.startsWith("media/")) {
        const [appDir, error] = await catcher(appDataDir(), { notify: false });
        if (!error && appDir) {
          const absolutePath = await join(appDir, normalized);
          const fileUrl = convertFileSrc(absolutePath);
          mediaSourceCache.set(normalized, fileUrl);
          if (!cancelled) {
            setResolvedPath(fileUrl);
          }
          return;
        }

        if (!cancelled) {
          setResolvedPath(normalized);
        }
        return;
      }

      if (!cancelled) {
        setResolvedPath(normalized);
      }
    };

    void resolvePath();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return resolvedPath;
}
