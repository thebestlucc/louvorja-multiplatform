// Custom YouTube embed wrapper using direct iframe + postMessage.
//
// We no longer load https://www.youtube.com/iframe_api because its
// www-widgetapi.js hits readonly-property errors inside Tauri/WKWebView
// that no amount of defensive patching has reliably bypassed.
//
// This wrapper talks to the YouTube `/embed/` iframe directly via the
// postMessage control protocol. It exposes the same `YTPlayer` shape the
// rest of the app already consumes.

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
  mute?(): void;
  unMute?(): void;
  isMuted?(): boolean;
}

// -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export interface YTPlayerConfig {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: YTPlayerState; target: YTPlayer }) => void;
    onError?: (e: { data: number; target: YTPlayer }) => void;
  };
}

declare global {
  interface Window {
    YT: { Player: new (el: HTMLElement | string, cfg: YTPlayerConfig) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ── Singleton loader (installs our shim on first call) ────────────────────────

let installed = false;

export function loadYouTubeAPI(): Promise<void> {
  if (!installed) {
    installed = true;
    window.YT = { Player: EmbedPlayer as unknown as new (el: HTMLElement | string, cfg: YTPlayerConfig) => YTPlayer };
  }
  return Promise.resolve();
}

// ── Embed player implementation ───────────────────────────────────────────────

function resolveHost(el: HTMLElement | string): HTMLElement | null {
  if (typeof el === "string") return document.getElementById(el);
  return el ?? null;
}

type EmbedInfo = { playerVars: Record<string, string | number>; origin: string };

function buildSrc(videoId: string, info: EmbedInfo): string {
  const params = new URLSearchParams({
    enablejsapi: "1",
    playsinline: "1",
    autoplay: String(info.playerVars.autoplay ?? 1),
    controls: String(info.playerVars.controls ?? 0),
    rel: String(info.playerVars.rel ?? 0),
    modestbranding: String(info.playerVars.modestbranding ?? 1),
    iv_load_policy: String(info.playerVars.iv_load_policy ?? 3),
    disablekb: String(info.playerVars.disablekb ?? 1),
    mute: String(info.playerVars.mute ?? 0),
    origin: info.origin,
    widget_referrer: info.origin,
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

class EmbedPlayer implements YTPlayer {
  private iframe: HTMLIFrameElement;
  private events: NonNullable<YTPlayerConfig["events"]>;
  private state: YTPlayerState = -1;
  private currentTime = 0;
  private duration = 0;
  private volume = 100;
  private muted = false;
  private destroyed = false;
  private messageHandler: (e: MessageEvent) => void;
  private readyFired = false;
  private videoId: string;

  constructor(el: HTMLElement | string, cfg: YTPlayerConfig) {
    const host = resolveHost(el);
    if (!host) throw new Error("EmbedPlayer: host element not found");

    this.videoId = cfg.videoId ?? "";
    this.events = cfg.events ?? {};
    const playerVars = cfg.playerVars ?? {};
    this.muted = playerVars.mute === 1 || playerVars.mute === "1";

    const iframe = document.createElement("iframe");
    iframe.width = String(cfg.width ?? "100%");
    iframe.height = String(cfg.height ?? "100%");
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.border = "0";
    iframe.src = buildSrc(this.videoId, {
      playerVars,
      origin: (playerVars.origin as string) || window.location.origin,
    });

    // Append iframe as a child of the host so the host's CSS (scale, overflow,
    // etc.) applies via `[&>iframe]` selectors. The original YT.Player API
    // replaces the host, but every call site in this repo uses CSS that
    // assumes the iframe is a descendant, so append instead.
    host.appendChild(iframe);
    this.iframe = iframe;

    this.messageHandler = (e: MessageEvent) => this.onMessage(e);
    window.addEventListener("message", this.messageHandler);

    iframe.addEventListener("load", () => {
      if (this.destroyed) return;
      this.post({ event: "listening", id: this.videoId, channel: "widget" });
      this.post({ event: "command", func: "addEventListener", args: ["onStateChange"] });
      this.post({ event: "command", func: "addEventListener", args: ["onError"] });
      // Ready once the iframe loads — YT.Player's real onReady fires after API
      // handshake; for our needs "iframe loaded + listening posted" is ready enough.
      if (!this.readyFired) {
        this.readyFired = true;
        try { this.events.onReady?.({ target: this }); } catch (_) { /* ignore */ }
      }
    });

    // Poll currentTime / duration / volume because embed events are sparse.
    this.startPoll();
  }

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private startPoll() {
    this.pollTimer = setInterval(() => {
      if (this.destroyed) return;
      this.post({ event: "command", func: "getCurrentTime", args: [] });
      this.post({ event: "command", func: "getDuration", args: [] });
      this.post({ event: "command", func: "getVolume", args: [] });
    }, 500);
  }

  private post(msg: Record<string, unknown>) {
    try {
      this.iframe.contentWindow?.postMessage(JSON.stringify(msg), "*");
    } catch (_) { /* ignore */ }
  }

  private onMessage(e: MessageEvent) {
    if (this.destroyed) return;
    if (e.source !== this.iframe.contentWindow) return;
    let data: Record<string, unknown>;
    try {
      data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (!data || typeof data !== "object") return;
    const event = data.event as string | undefined;
    const info = data.info;

    if (event === "onStateChange") {
      const next = (typeof info === "number" ? info : -1) as YTPlayerState;
      this.state = next;
      try { this.events.onStateChange?.({ data: next, target: this }); } catch (_) { /* ignore */ }
    } else if (event === "onError") {
      const code = typeof info === "number" ? info : 0;
      try { this.events.onError?.({ data: code, target: this }); } catch (_) { /* ignore */ }
    } else if (event === "infoDelivery" && info && typeof info === "object") {
      const i = info as Record<string, unknown>;
      if (typeof i.currentTime === "number") this.currentTime = i.currentTime;
      if (typeof i.duration === "number") this.duration = i.duration;
      if (typeof i.volume === "number") this.volume = i.volume;
      if (typeof i.muted === "boolean") this.muted = i.muted;
      if (typeof i.playerState === "number") this.state = i.playerState as YTPlayerState;
    }
  }

  // ── YTPlayer interface ──────────────────────────────────────────────────────

  playVideo(): void { this.post({ event: "command", func: "playVideo", args: [] }); }
  pauseVideo(): void { this.post({ event: "command", func: "pauseVideo", args: [] }); }
  seekTo(seconds: number, allowSeekAhead: boolean): void {
    this.post({ event: "command", func: "seekTo", args: [seconds, allowSeekAhead] });
  }
  setVolume(volume: number): void {
    this.volume = volume;
    this.post({ event: "command", func: "setVolume", args: [volume] });
  }
  getVolume(): number { return this.volume; }
  getCurrentTime(): number { return this.currentTime; }
  getDuration(): number { return this.duration; }
  getPlayerState(): YTPlayerState { return this.state; }
  getIframe(): HTMLIFrameElement { return this.iframe; }
  mute(): void {
    this.muted = true;
    this.post({ event: "command", func: "mute", args: [] });
  }
  unMute(): void {
    this.muted = false;
    this.post({ event: "command", func: "unMute", args: [] });
  }
  isMuted(): boolean { return this.muted; }

  destroy(): void {
    this.destroyed = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    window.removeEventListener("message", this.messageHandler);
    try { this.iframe.remove(); } catch (_) { /* ignore */ }
  }
}
