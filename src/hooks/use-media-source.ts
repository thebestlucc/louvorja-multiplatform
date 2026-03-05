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

      const trimmed = path.trim();
      if (
        trimmed.startsWith("data:")
        || trimmed.startsWith("blob:")
        || trimmed.startsWith("http://")
        || trimmed.startsWith("https://")
      ) {
        if (!cancelled) {
          setResolvedPath(trimmed);
        }
        return;
      }

      if (mediaSourceCache.has(trimmed)) {
        if (!cancelled) {
          setResolvedPath(mediaSourceCache.get(trimmed) ?? null);
        }
        return;
      }

      if (isAbsolutePath(trimmed)) {
        const fileUrl = convertFileSrc(trimmed);
        mediaSourceCache.set(trimmed, fileUrl);
        if (!cancelled) {
          setResolvedPath(fileUrl);
        }
        return;
      }

      if (trimmed.startsWith("media/")) {
        const [appDir, error] = await catcher(appDataDir(), { notify: false });
        if (!error && appDir) {
          const absolutePath = await join(appDir, trimmed);
          const fileUrl = convertFileSrc(absolutePath);
          mediaSourceCache.set(trimmed, fileUrl);
          if (!cancelled) {
            setResolvedPath(fileUrl);
          }
          return;
        }

        if (!cancelled) {
          setResolvedPath(trimmed);
        }
        return;
      }

      if (!cancelled) {
        setResolvedPath(trimmed);
      }
    };

    void resolvePath();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return resolvedPath;
}
