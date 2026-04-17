// ─── YTPlayer types ──────────────────────────────────────────────────────────

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YTPlayerState;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export interface YTPlayerConfig {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: YTPlayerState; target: YTPlayer }) => void;
  };
}

declare global {
  interface Window {
    YT: { Player: new (el: HTMLElement | string, cfg: YTPlayerConfig) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ─── Singleton loader ─────────────────────────────────────────────────────────

let ytApiLoaded = false;
let ytApiReady = false;
const ytReadyCbs: Array<() => void> = [];

export function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiReady) { resolve(); return; }
    ytReadyCbs.push(resolve);
    if (!ytApiLoaded) {
      ytApiLoaded = true;

      // Tauri/WKWebView workaround: YouTube's www-widgetapi.js tries to assign
      // to readonly properties. Pre-define them as writable + configurable.
      for (const prop of ["YT", "YTConfig"] as const) {
        if (!(prop in window) || !Object.getOwnPropertyDescriptor(window, prop)?.writable) {
          Object.defineProperty(window, prop, {
            value: (window as Record<string, unknown>)[prop] ?? undefined,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      }

      // www-widgetapi.js (loaded by YouTube's iframe_api) tries to set
      // document.domain which is readonly in WKWebView. Patch it as a no-op
      // so the script doesn't crash during eval.
      try {
        Object.defineProperty(document, "domain", {
          get: () => "",
          set: () => { /* no-op — WKWebView doesn't allow setting document.domain */ },
          configurable: true,
        });
      } catch (_) { /* ignore */ }

      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytReadyCbs.splice(0).forEach((cb) => cb());
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => {
        // If script fails to load, resolve with a warning so callers don't hang
        console.warn("[youtube-api] iframe_api script failed to load");
        ytReadyCbs.splice(0).forEach((cb) => cb());
      };
      document.head.appendChild(tag);
    }
  });
}
