import { useQuery } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { catcher } from "../lib/catcher";

// Cache the app data directory — it never changes and resolving it is an IPC call.
// Without this, every CoverImage mount triggers a separate Tauri IPC round-trip.
let appDataDirCache: Promise<string> | null = null;
function getCachedAppDataDir(): Promise<string> {
  if (!appDataDirCache) appDataDirCache = appDataDir();
  return appDataDirCache;
}

function joinPath(base: string, relative: string): string {
  const sep = base.endsWith("/") || base.endsWith("\\") ? "" : "/";
  return `${base}${sep}${relative}`;
}

function isCdnRelativePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  const cdnPrefixes = ["/covers/", "/musics/", "/images/", "/videos/"];
  return cdnPrefixes.some((prefix) => path.startsWith(prefix));
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

/**
 * Resolves a local image path to a URL the webview can load.
 *
 * - CDN-relative paths (/covers/, /musics/, etc.) and managed paths (media/...)
 *   are served via the asset protocol (convertFileSrc) — these are always within
 *   the asset scope ($APPDATA).
 * - Absolute OS paths (user-picked files from dialogs) use convertFileSrc directly —
 *   the tauri.conf.json asset scope covers $HOME, $DESKTOP, $DOCUMENT, $PICTURE, etc.
 */
export function useImageSrc(path: string | null | undefined): string | null {
  const { data: src = null } = useQuery({
    queryKey: ["image-src", path ?? ""],
    queryFn: async () => {
      if (!path || path.trim().length === 0) return null;

      const normalized = path.trim().replace(/\\/g, "/");

      // Block remote URLs — images must be local
      if (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("blob:")
      ) {
        return null;
      }

      // CDN-relative paths like /covers/foo.jpg
      if (isCdnRelativePath(normalized)) {
        const [absolute, error] = await catcher(
          async () => {
            const appDir = await getCachedAppDataDir();
            return joinPath(appDir, normalized.slice(1));
          },
          { notify: false },
        );
        if (!error && absolute) {
          return convertFileSrc(absolute);
        }
        return null;
      }

      // Absolute OS paths — use asset protocol directly. The tauri.conf.json asset
      // scope covers $HOME, $DESKTOP, $DOCUMENT, $DOWNLOAD, $PICTURE, $VIDEO, etc.,
      // so user-picked files from file dialogs are served without needing the streaming server.
      if (isAbsolutePath(normalized)) {
        return convertFileSrc(normalized);
      }

      // Managed relative paths like media/covers/...
      if (normalized.startsWith("media/")) {
        const [absolute, error] = await catcher(
          async () => {
            const appDir = await getCachedAppDataDir();
            return joinPath(appDir, normalized);
          },
          { notify: false },
        );
        if (error) return null;
        return convertFileSrc(absolute!);
      }

      // Unknown format
      return null;
    },
    enabled: Boolean(path) && (path ?? "").trim().length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
  return src;
}
