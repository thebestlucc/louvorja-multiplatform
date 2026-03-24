import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { catcher } from "../lib/catcher";

function isCdnRelativePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  const cdnPrefixes = ["/covers/", "/musics/", "/images/", "/videos/"];
  return cdnPrefixes.some((prefix) => path.startsWith(prefix));
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

/**
 * Resolves a local image path to a URL the webview can load,
 * using Tauri's asset protocol (convertFileSrc). Does NOT depend
 * on the streaming server — safe to use for backgrounds and covers.
 */
export function useImageSrc(path: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveSrc() {
      if (!path || path.trim().length === 0) {
        if (!cancelled) setSrc(null);
        return;
      }

      const normalized = path.trim().replace(/\\/g, "/");

      // Block remote URLs — images must be local
      if (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("blob:")
      ) {
        if (!cancelled) setSrc(null);
        return;
      }

      // CDN-relative paths like /covers/foo.jpg
      if (isCdnRelativePath(normalized)) {
        const [absolute, error] = await catcher(
          async () => {
            const appDir = await appDataDir();
            return await join(appDir, normalized.slice(1));
          },
          { notify: false },
        );
        if (!error && absolute && !cancelled) {
          setSrc(convertFileSrc(absolute));
        } else if (!cancelled) {
          setSrc(null);
        }
        return;
      }

      // Absolute OS paths
      if (isAbsolutePath(normalized)) {
        if (!cancelled) setSrc(convertFileSrc(normalized));
        return;
      }

      // Managed relative paths like media/images/...
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
        if (!cancelled) setSrc(convertFileSrc(absolute!));
        return;
      }

      // Unknown format
      if (!cancelled) setSrc(null);
    }

    void resolveSrc();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return src;
}
