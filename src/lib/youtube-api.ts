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
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytReadyCbs.splice(0).forEach((cb) => cb());
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}
