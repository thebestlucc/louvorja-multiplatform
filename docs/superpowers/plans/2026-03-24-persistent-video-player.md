# Persistent Video Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-consumer video players with a single persistent master player in the main window; projector and return windows become muted followers synchronized via Tauri `video-state` broadcast events.

**Architecture:** `PersistentVideoPlayer` mounts once in `__root.tsx` and owns the real YT.Player/`<video>` element. `VideoPreviewSlot` in Playing Now physically moves that DOM node into the preview area on mount and returns it on unmount — no restart ever. Projector and return windows create their own muted players that sync to the master via `useVideoFollower`.

**Tech Stack:** React 19, TypeScript 5.8, Zustand, TanStack Router, Tauri 2 `listen`/`emit`, YouTube IFrame API, Node.js `node:test`

**Spec:** `docs/superpowers/specs/2026-03-24-persistent-video-player-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/stores/video-player-store.ts` | **Create** | Zustand store for persistent video state |
| `src/lib/video-player-registry.ts` | **Create** | DOM transplant registry (attach/detach player node) |
| `src/lib/youtube-api.ts` | **Create** | Shared `loadYouTubeAPI()` singleton + YTPlayer types |
| `src/hooks/use-video-follower.ts` | **Create** | Follower hook: syncs muted player to master `video-state` |
| `src/components/online-videos/persistent-video-player.tsx` | **Create** | Master player component + `VideoPreviewSlot` |
| `src/components/online-videos/online-video-slide.tsx` | **Modify** | Add `isFollower` prop; update projector/return/preview modes |
| `src/routes/__root.tsx` | **Modify** | Mount `<PersistentVideoPlayer>` in main layout |
| `src/routes/playing-now/index.tsx` | **Modify** | Replace `useState<VideoStateEvent>` with `useVideoPlayerStore` |
| `tests/stores/video-player-store.test.ts` | **Create** | Unit tests for the store |
| `tests/lib/video-player-registry.test.ts` | **Create** | Unit tests for the registry |
| `tsconfig.unit-tests.json` | **Modify** | Add new test + source files to includes |
| `package.json` | **Modify** | Add new test files to `test:unit` runner |

---

## Task 1: videoPlayerStore

**Files:**
- Create: `src/stores/video-player-store.ts`
- Create: `tests/stores/video-player-store.test.ts`
- Modify: `tsconfig.unit-tests.json`
- Modify: `package.json`

- [ ] **Step 1: Create the store**

```typescript
// src/stores/video-player-store.ts
import { create } from "zustand";

interface VideoPlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  videoId: string | null;
  videoSrc: string | null;
  videoSource: "youtube" | "local" | null;
  setVideoState: (partial: Partial<Omit<VideoPlayerState, "setVideoState" | "resetVideoState">>) => void;
  resetVideoState: () => void;
}

const initialState = {
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1,
  videoId: null,
  videoSrc: null,
  videoSource: null as "youtube" | "local" | null,
};

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  ...initialState,
  setVideoState: (partial) => set(partial),
  resetVideoState: () => set(initialState),
}));
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/stores/video-player-store.test.ts
import { test, describe } from "node:test";
import * as assert from "node:assert";
import { useVideoPlayerStore } from "../../src/stores/video-player-store";

describe("videoPlayerStore", () => {
  test("initial state", () => {
    const s = useVideoPlayerStore.getState();
    assert.strictEqual(s.currentTime, 0);
    assert.strictEqual(s.duration, 0);
    assert.strictEqual(s.paused, true);
    assert.strictEqual(s.videoId, null);
    assert.strictEqual(s.videoSource, null);
  });

  test("setVideoState updates partial fields", () => {
    useVideoPlayerStore.getState().resetVideoState();
    useVideoPlayerStore.getState().setVideoState({ currentTime: 42, paused: false, videoId: "abc123", videoSource: "youtube" });
    const s = useVideoPlayerStore.getState();
    assert.strictEqual(s.currentTime, 42);
    assert.strictEqual(s.paused, false);
    assert.strictEqual(s.videoId, "abc123");
    assert.strictEqual(s.videoSource, "youtube");
    assert.strictEqual(s.videoSrc, null); // unchanged
  });

  test("resetVideoState restores initial state", () => {
    useVideoPlayerStore.getState().setVideoState({ currentTime: 99, videoId: "xyz", videoSource: "local" });
    useVideoPlayerStore.getState().resetVideoState();
    const s = useVideoPlayerStore.getState();
    assert.strictEqual(s.currentTime, 0);
    assert.strictEqual(s.videoId, null);
    assert.strictEqual(s.videoSource, null);
  });
});
```

- [ ] **Step 3: Register test in tsconfig.unit-tests.json**

In `tsconfig.unit-tests.json`, add to `includes` array:
```json
"tests/stores/video-player-store.test.ts",
"src/stores/video-player-store.ts",
```

- [ ] **Step 4: Register test in package.json test:unit script**

In `package.json`, append to the `node --test` command at the end:
```
.tmp-test-dist/tests/stores/video-player-store.test.js
```

- [ ] **Step 5: Run tests to verify pass**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
pnpm test:unit
```
Expected: all tests pass, including the 3 new `videoPlayerStore` tests.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/stores/video-player-store.ts tests/stores/video-player-store.test.ts tsconfig.unit-tests.json package.json
git commit -m "feat: add videoPlayerStore for persistent video state"
```

---

## Task 2: videoPlayerRegistry

**Files:**
- Create: `src/lib/video-player-registry.ts`
- Create: `tests/lib/video-player-registry.test.ts`
- Modify: `tsconfig.unit-tests.json`
- Modify: `package.json`

- [ ] **Step 1: Create the registry**

```typescript
// src/lib/video-player-registry.ts
// Module-level singleton — safe to share across React renders.
let hiddenHost: HTMLElement | null = null;
let playerNode: HTMLElement | null = null;
let attached = false;

/** Called once by PersistentVideoPlayer on mount to register the hidden host div. */
export function registerHiddenHost(el: HTMLElement): void {
  hiddenHost = el;
}

/**
 * Called when a new player element (YT iframe or <video>) is ready.
 * Resets `attached` so VideoPreviewSlot can attach on the next call.
 */
export function registerPlayerNode(el: HTMLElement): void {
  playerNode = el;
  attached = false;
}

/** Returns the current player node, or null if none is registered. */
export function getPlayerNode(): HTMLElement | null {
  return playerNode;
}

/**
 * Moves the player node into `target`.
 * No-op if playerNode is null or already attached (React Strict Mode guard).
 */
export function attachPlayerTo(target: HTMLElement): void {
  if (!playerNode || attached) return;
  target.appendChild(playerNode);
  attached = true;
}

/**
 * Moves the player node back to the hidden host.
 * No-op if not attached or hiddenHost is missing.
 */
export function detachPlayerToHost(): void {
  if (!playerNode || !hiddenHost || !attached) return;
  hiddenHost.appendChild(playerNode);
  attached = false;
}

/** Called when the video changes or is cleared. Nulls the node and resets state. */
export function clearPlayerNode(): void {
  playerNode = null;
  attached = false;
}
```

- [ ] **Step 2: Write tests**

```typescript
// tests/lib/video-player-registry.test.ts
import { test, describe, beforeEach } from "node:test";
import * as assert from "node:assert";
import {
  registerHiddenHost,
  registerPlayerNode,
  getPlayerNode,
  attachPlayerTo,
  detachPlayerToHost,
  clearPlayerNode,
} from "../../src/lib/video-player-registry";

// Minimal HTMLElement stub for Node.js environment
function makeEl(id: string): HTMLElement {
  return {
    id,
    _parent: null as HTMLElement | null,
    appendChild(child: HTMLElement) {
      (child as unknown as { _parent: HTMLElement | null })._parent = this as unknown as HTMLElement;
    },
  } as unknown as HTMLElement;
}

describe("videoPlayerRegistry", () => {
  beforeEach(() => {
    clearPlayerNode();
  });

  test("getPlayerNode returns null before registration", () => {
    assert.strictEqual(getPlayerNode(), null);
  });

  test("registerPlayerNode makes getPlayerNode return the element", () => {
    const el = makeEl("player");
    registerPlayerNode(el);
    assert.strictEqual(getPlayerNode(), el);
  });

  test("attachPlayerTo moves node to target and sets attached", () => {
    const host = makeEl("host");
    const target = makeEl("target");
    const player = makeEl("player");
    registerHiddenHost(host);
    registerPlayerNode(player);
    attachPlayerTo(target);
    assert.strictEqual((player as unknown as { _parent: HTMLElement })._parent, target);
  });

  test("attachPlayerTo is a no-op if already attached (Strict Mode guard)", () => {
    const host = makeEl("host");
    const target1 = makeEl("t1");
    const target2 = makeEl("t2");
    const player = makeEl("player");
    registerHiddenHost(host);
    registerPlayerNode(player);
    attachPlayerTo(target1);
    attachPlayerTo(target2); // should be no-op
    assert.strictEqual((player as unknown as { _parent: HTMLElement })._parent, target1);
  });

  test("detachPlayerToHost moves node back to host", () => {
    const host = makeEl("host");
    const target = makeEl("target");
    const player = makeEl("player");
    registerHiddenHost(host);
    registerPlayerNode(player);
    attachPlayerTo(target);
    detachPlayerToHost();
    assert.strictEqual((player as unknown as { _parent: HTMLElement })._parent, host);
  });

  test("clearPlayerNode nulls the node", () => {
    registerPlayerNode(makeEl("player"));
    clearPlayerNode();
    assert.strictEqual(getPlayerNode(), null);
  });
});
```

- [ ] **Step 3: Register test in tsconfig.unit-tests.json**

Add to `includes`:
```json
"tests/lib/video-player-registry.test.ts",
"src/lib/video-player-registry.ts",
```

- [ ] **Step 4: Register in package.json**

Append to the `node --test` command:
```
.tmp-test-dist/tests/lib/video-player-registry.test.js
```

- [ ] **Step 5: Run tests**

```bash
pnpm test:unit
```
Expected: all tests pass.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/video-player-registry.ts tests/lib/video-player-registry.test.ts tsconfig.unit-tests.json package.json
git commit -m "feat: add videoPlayerRegistry for DOM transplant"
```

---

## Task 3: Shared YouTube API module

The `loadYouTubeAPI()` function and YTPlayer types live in `online-video-slide.tsx` today. Extract them so `PersistentVideoPlayer` and `online-video-slide.tsx` share the same singleton.

**Files:**
- Create: `src/lib/youtube-api.ts`
- Modify: `src/components/online-videos/online-video-slide.tsx` (remove duplicated code, import from new module)

- [ ] **Step 1: Create the shared module**

```typescript
// src/lib/youtube-api.ts

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
```

- [ ] **Step 2: Update online-video-slide.tsx imports**

Remove the entire "YouTube IFrame API types" and "YouTube API singleton loader" sections (lines 8–63 in the original file). Replace with:

```typescript
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer, YTPlayerState, YTPlayerConfig } from "../../lib/youtube-api";
```

Remove the `declare global { interface Window { YT ... } }` block (it now lives in `youtube-api.ts`).

Keep `VideoControlEvent` and `VideoStateEvent` exported from `online-video-slide.tsx` — they're imported by `playing-now/index.tsx` and other files already.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/youtube-api.ts src/components/online-videos/online-video-slide.tsx
git commit -m "refactor: extract YouTube API loader and types to shared module"
```

---

## Task 4: useVideoFollower hook

**Files:**
- Create: `src/hooks/use-video-follower.ts`

No automated test — this hook depends on Tauri `listen()` which is not available in the Node.js test environment. Verify by running the app manually after Task 7.

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-video-follower.ts
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import type { YTPlayer } from "../lib/youtube-api";
import type { VideoStateEvent } from "../components/online-videos/online-video-slide";

/**
 * Keeps a muted follower player (projector or return window) synchronized with
 * the master player in the main window.
 *
 * @param playerRef  Ref to the YTPlayer or HTMLVideoElement managed by the caller.
 * @param playerKind "youtube" or "local" — explicit discriminant because YTPlayer
 *                   is an interface (no instanceof check possible).
 * @returns          A ref containing the latest received VideoStateEvent.
 *                   The caller should use this in onReady / canplay to seek to the
 *                   correct position when the player first becomes ready.
 */
export function useVideoFollower(
  playerRef: RefObject<YTPlayer | HTMLVideoElement | null>,
  playerKind: "youtube" | "local",
): RefObject<VideoStateEvent | null> {
  const lastStateRef = useRef<VideoStateEvent | null>(null);

  useEffect(() => {
    const unsub = listen<VideoStateEvent>("video-state", (e) => {
      lastStateRef.current = e.payload;
      const p = playerRef.current;
      if (!p) return;

      const { paused, currentTime } = e.payload;

      if (playerKind === "youtube") {
        const yp = p as YTPlayer;
        const state = yp.getPlayerState();
        if (paused && state === 1) yp.pauseVideo();
        else if (!paused && state !== 1) yp.playVideo();
        if (Math.abs(yp.getCurrentTime() - currentTime) > 0.5) {
          yp.seekTo(currentTime, true);
        }
      } else {
        const v = p as HTMLVideoElement;
        if (paused && !v.paused) v.pause();
        else if (!paused && v.paused) void v.play().catch(() => {});
        if (Math.abs(v.currentTime - currentTime) > 0.5) {
          v.currentTime = currentTime;
        }
      }
    }).catch(() => () => {});

    return () => {
      void unsub.then((fn) => fn());
    };
  }, [playerRef, playerKind]);

  return lastStateRef;
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-video-follower.ts
git commit -m "feat: add useVideoFollower hook for projector/return sync"
```

---

## Task 5: PersistentVideoPlayer + VideoPreviewSlot

This is the master player component. It lives in `__root.tsx`, owns the real YT.Player / `<video>` element, polls state, broadcasts `video-state` to all windows, and handles `video-control` events.

**Files:**
- Create: `src/components/online-videos/persistent-video-player.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/online-videos/persistent-video-player.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer } from "../../lib/youtube-api";
import { useMediaSource } from "../../hooks/use-media-source";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import {
  registerHiddenHost,
  registerPlayerNode,
  clearPlayerNode,
  attachPlayerTo,
  detachPlayerToHost,
  getPlayerNode,
} from "../../lib/video-player-registry";
import type { SlideContent } from "../../lib/bindings";
import type { VideoControlEvent, VideoStateEvent } from "./online-video-slide";
import { cn } from "../../lib/utils";

// ─── VideoPreviewSlot ─────────────────────────────────────────────────────────

/**
 * Rendered inside Playing Now's preview area.
 * Moves the master player's DOM node INTO this slot on mount,
 * and BACK to the hidden host on unmount.
 * The player keeps playing through route changes — no restart.
 */
export function VideoPreviewSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Re-run when the player node becomes available after a video change
    const tryAttach = () => {
      if (ref.current && getPlayerNode()) {
        attachPlayerTo(ref.current);
      }
    };

    tryAttach();
    // Poll briefly to handle the gap between VideoPreviewSlot mounting and
    // the player finishing initialization (< 1s for YouTube onReady)
    const timer = setInterval(() => {
      if (getPlayerNode()) {
        tryAttach();
        clearInterval(timer);
      }
    }, 100);

    return () => {
      clearInterval(timer);
      detachPlayerToHost();
    };
  }, []);

  return <div ref={ref} className={cn("h-full w-full", className)} />;
}

// ─── PersistentVideoPlayer ────────────────────────────────────────────────────

/**
 * Always-mounted master player. Place in __root.tsx outside <Outlet>.
 * Hidden via a 1×1px absolute div. Owns the real player element that
 * VideoPreviewSlot transplants into the Playing Now preview area.
 */
export function PersistentVideoPlayer() {
  const hiddenHostRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeSlide, setActiveSlide] = useState<SlideContent | null>(null);

  // Resolve local video URL via streaming server (same hook used elsewhere)
  const localVideoSrc = useMediaSource(
    activeSlide?.videoSource === "local" ? (activeSlide.videoUrl ?? null) : null
  );

  // Register the hidden host div once
  useEffect(() => {
    if (hiddenHostRef.current) {
      registerHiddenHost(hiddenHostRef.current);
    }
  }, []);

  // Helper: broadcast current player state to all windows + update Zustand store
  const broadcastState = useCallback((snap: VideoStateEvent, meta: { videoId: string | null; videoSrc: string | null; videoSource: "youtube" | "local" | null }) => {
    useVideoPlayerStore.getState().setVideoState({ ...snap, ...meta });
    void emit("video-state", snap).catch(() => {});
  }, []);

  // Listen to slide-changed
  useEffect(() => {
    const unsub = listen<SlideContent>("slide-changed", (e) => {
      const slide = e.payload;
      if (slide.slideType === "online_video") {
        setActiveSlide(slide);
      } else {
        // Non-video slide projected: pause but keep player alive
        ytPlayerRef.current?.pauseVideo();
        if (videoRef.current) videoRef.current.pause();
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen to slide-cleared: fully reset
  useEffect(() => {
    const unsub = listen("slide-cleared", () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;

      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
        ytPlayerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.remove();
        videoRef.current = null;
      }
      clearPlayerNode();
      useVideoPlayerStore.getState().resetVideoState();
      setActiveSlide(null);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen to video-control: apply to master player
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const { action, value } = e.payload;

      if (ytPlayerRef.current) {
        const p = ytPlayerRef.current;
        if (action === "play") p.playVideo();
        else if (action === "pause") p.pauseVideo();
        else if (action === "seek" && value !== undefined) p.seekTo(value, true);
        else if (action === "volume" && value !== undefined) p.setVolume(Math.round(value * 100));
      }

      if (videoRef.current) {
        const v = videoRef.current;
        if (action === "play") void v.play().catch(() => {});
        else if (action === "pause") v.pause();
        else if (action === "seek" && value !== undefined) v.currentTime = value;
        else if (action === "volume" && value !== undefined) v.volume = value;
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // ── YouTube player lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    const videoId = activeSlide?.videoSource !== "local" ? (activeSlide?.videoId ?? null) : null;
    if (!videoId || !hiddenHostRef.current) return;

    let destroyed = false;

    // Clean up any previous YouTube player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
    }
    clearPlayerNode();

    // Create container div imperatively (React must not manage this node)
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;";
    hiddenHostRef.current.appendChild(container);
    const uid = `yt-master-${Math.random().toString(36).slice(2)}`;
    container.id = uid;

    void loadYouTubeAPI().then(() => {
      if (destroyed || !container.isConnected) return;

      const player = new window.YT.Player(uid, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1, controls: 0, rel: 0,
          modestbranding: 1, showinfo: 0,
          disablekb: 1, iv_load_policy: 3, cc_load_policy: 0,
          mute: 0, // master is unmuted — it is the audio source
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (destroyed) return;
            ytPlayerRef.current = target;
            registerPlayerNode(target.getIframe());

            // Start polling every 250ms
            pollTimerRef.current = setInterval(() => {
              const snap: VideoStateEvent = {
                paused: target.getPlayerState() !== 1,
                currentTime: target.getCurrentTime(),
                duration: target.getDuration(),
                volume: target.getVolume() / 100,
              };
              broadcastState(snap, { videoId, videoSrc: null, videoSource: "youtube" });
            }, 250);
          },
          onStateChange: ({ data, target }) => {
            if (destroyed) return;
            // Emit immediately on pause/stop so followers react without waiting for the poll
            if (data !== 1) {
              broadcastState(
                {
                  paused: true,
                  currentTime: target.getCurrentTime(),
                  duration: target.getDuration(),
                  volume: target.getVolume() / 100,
                },
                { videoId, videoSrc: null, videoSource: "youtube" },
              );
            }
          },
        },
      });
      ytPlayerRef.current = player;
    });

    return () => {
      destroyed = true;
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      try { ytPlayerRef.current?.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
      clearPlayerNode();
      container.remove();
    };
  }, [activeSlide?.videoId, activeSlide?.videoSource, broadcastState]);

  // ── Local video player lifecycle ──────────────────────────────────────────

  useEffect(() => {
    if (!localVideoSrc || !hiddenHostRef.current) return;

    // Clean up previous local player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.remove();
      videoRef.current = null;
    }
    clearPlayerNode();

    // Create <video> imperatively
    const video = document.createElement("video");
    video.style.cssText = "width:100%;height:100%;object-fit:contain;";
    video.src = localVideoSrc;
    video.playsInline = true;
    hiddenHostRef.current.appendChild(video);
    videoRef.current = video;

    const startPoll = () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = setInterval(() => {
        const snap: VideoStateEvent = {
          paused: video.paused,
          currentTime: video.currentTime,
          duration: isFinite(video.duration) ? video.duration : 0,
          volume: video.volume,
        };
        broadcastState(snap, { videoId: null, videoSrc: localVideoSrc, videoSource: "local" });
      }, 250);
    };

    const onCanPlay = () => {
      registerPlayerNode(video);
      void video.play().catch(() => {});
      startPoll();
    };

    const onPause = () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      broadcastState(
        { paused: true, currentTime: video.currentTime, duration: isFinite(video.duration) ? video.duration : 0, volume: video.volume },
        { videoId: null, videoSrc: localVideoSrc, videoSource: "local" },
      );
    };

    if (video.readyState >= 3) {
      onCanPlay();
    } else {
      video.addEventListener("canplay", onCanPlay, { once: true });
    }
    video.addEventListener("pause", onPause);

    return () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      video.removeEventListener("pause", onPause);
      video.pause();
      video.src = "";
      video.remove();
      videoRef.current = null;
      clearPlayerNode();
    };
  }, [localVideoSrc, broadcastState]);

  return (
    <div
      ref={hiddenHostRef}
      aria-hidden
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 0,
      }}
    />
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/online-videos/persistent-video-player.tsx
git commit -m "feat: add PersistentVideoPlayer and VideoPreviewSlot"
```

---

## Task 6: Mount PersistentVideoPlayer in __root.tsx

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add import**

At the top of `src/routes/__root.tsx`, add:

```typescript
import { PersistentVideoPlayer } from "../components/online-videos/persistent-video-player";
```

- [ ] **Step 2: Mount in the main layout**

Inside `RootLayout`, in the non-bare-route JSX return (the `<div className="flex h-screen...">` branch), add `<PersistentVideoPlayer />` just before the closing `</div>` (after `<AppToaster />`):

```tsx
// after <AppToaster />
<PersistentVideoPlayer />
```

The full end of the return should look like:
```tsx
      <PackSyncProgressDialog />
      <UpdateNotification />
      <AppToaster />
      <PersistentVideoPlayer />
    </div>
  );
```

`PersistentVideoPlayer` renders a 1×1px hidden div — it has no visual impact on layout.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: mount PersistentVideoPlayer in root layout"
```

---

## Task 7: Update online-video-slide.tsx

Three changes in one file:
1. `playing-now-preview` mode → use `VideoPreviewSlot` (no more local YT.Player)
2. `projector` mode → add `isFollower` / `muted` to both players
3. `return-current` mode → add live YouTubePlayer follower (currently shows thumbnail)
4. Update `LocalVideoPlayer` and `YouTubePlayer` to accept and respect `isFollower` prop

**Files:**
- Modify: `src/components/online-videos/online-video-slide.tsx`

- [ ] **Step 1: Add VideoPreviewSlot import**

```typescript
import { VideoPreviewSlot } from "./persistent-video-player";
```

- [ ] **Step 2: Add `isFollower` prop to LocalVideoPlayer**

Change the signature from:
```tsx
function LocalVideoPlayer({ src, title, className, muted }: { src: string; title: string; className?: string; muted?: boolean })
```
to:
```tsx
function LocalVideoPlayer({ src, title, className, muted, isFollower = false }: {
  src: string; title: string; className?: string; muted?: boolean; isFollower?: boolean;
})
```

When `isFollower === true`:
- Skip the autoplay-on-canplay `useEffect`
- Skip the `listen("video-control")` `useEffect`
- Skip the `emitTo("main", "video-state")` `useEffect`
- Add follower sync via `useVideoFollower`

Replace the existing three `useEffect` blocks with:

```tsx
import { useVideoFollower } from "../../hooks/use-video-follower";

// Inside LocalVideoPlayer:
const lastStateRef = useVideoFollower(
  videoRef as React.RefObject<HTMLVideoElement | null>,
  "local",
  // hook is only active when isFollower=true
);
// Only run autoplay + emit effects when NOT a follower
useEffect(() => {
  if (isFollower) return;
  const video = videoRef.current;
  if (!video) return;
  const tryPlay = () => {
    void video.play().catch(() => {});
  };
  if (video.readyState >= 3) {
    tryPlay();
  } else {
    video.addEventListener("canplay", tryPlay, { once: true });
    return () => video.removeEventListener("canplay", tryPlay);
  }
}, [src, isFollower]);

useEffect(() => {
  if (isFollower) return;
  const unsub = listen<VideoControlEvent>("video-control", (e) => {
    const video = videoRef.current;
    if (!video) return;
    const { action, value } = e.payload;
    if (action === "play") void video.play().catch(() => {});
    else if (action === "pause") video.pause();
    else if (action === "seek" && value !== undefined) video.currentTime = value;
    else if (action === "volume" && value !== undefined) video.volume = value;
  }).catch(() => () => {});
  return () => { void unsub.then((fn) => fn()); };
}, [isFollower]);

useEffect(() => {
  if (isFollower) return;
  const video = videoRef.current;
  if (!video) return;
  const emitState = () => {
    void emitTo("main", "video-state", {
      paused: video.paused,
      currentTime: video.currentTime,
      duration: isFinite(video.duration) ? video.duration : 0,
      volume: video.volume,
    } satisfies VideoStateEvent).catch(() => {});
  };
  video.addEventListener("timeupdate", emitState);
  video.addEventListener("play", emitState);
  video.addEventListener("pause", emitState);
  video.addEventListener("volumechange", emitState);
  return () => {
    video.removeEventListener("timeupdate", emitState);
    video.removeEventListener("play", emitState);
    video.removeEventListener("pause", emitState);
    video.removeEventListener("volumechange", emitState);
  };
}, [src, isFollower]);

// When follower: seek to last known state on canplay
useEffect(() => {
  if (!isFollower) return;
  const video = videoRef.current;
  if (!video) return;
  const onCanPlay = () => {
    const last = lastStateRef.current;
    if (last && last.currentTime > 2) {
      video.currentTime = last.currentTime;
    }
    if (last && !last.paused) {
      void video.play().catch(() => {});
    }
  };
  if (video.readyState >= 3) {
    onCanPlay();
  } else {
    video.addEventListener("canplay", onCanPlay, { once: true });
    return () => video.removeEventListener("canplay", onCanPlay);
  }
}, [src, isFollower, lastStateRef]);
```

Note: `useVideoFollower` must always be called (Rules of Hooks) — its effects are simply inactive for the non-follower case because the event listener only syncs when `playerRef.current` has a player.

Actually, to keep this simpler and avoid hooks called conditionally, call `useVideoFollower` unconditionally and let it run always. The hook just won't find a player to sync when `isFollower=false` — that is harmless. But the `listen("video-state")` it registers will still fire. This is a minor waste.

Better approach: make `useVideoFollower` accept an `enabled` parameter:

```typescript
// Update src/hooks/use-video-follower.ts signature:
export function useVideoFollower(
  playerRef: RefObject<YTPlayer | HTMLVideoElement | null>,
  playerKind: "youtube" | "local",
  enabled = true,  // add this
): RefObject<VideoStateEvent | null>

// In the useEffect inside:
useEffect(() => {
  if (!enabled) return;
  // ... existing logic
}, [playerRef, playerKind, enabled]);
```

Then in `LocalVideoPlayer`:
```tsx
const lastStateRef = useVideoFollower(videoRef as RefObject<HTMLVideoElement | null>, "local", isFollower);
```

- [ ] **Step 3: Add `isFollower` prop to YouTubePlayer**

Change the signature:
```tsx
function YouTubePlayer({ videoId, title, className, muted = false, isFollower = false }: {
  videoId: string; title: string; className?: string; muted?: boolean; isFollower?: boolean;
})
```

In the `useEffect`, split behavior based on `isFollower`:

```tsx
// Inside the loadYouTubeAPI().then callback, in the events section:
events: {
  onReady: ({ target }) => {
    playerRef.current = target;
    if (isFollower) {
      // Seek to last known master position on init
      const last = lastStateRef.current;
      if (last && last.currentTime > 2) {
        target.seekTo(last.currentTime, true);
        if (!last.paused) target.playVideo();
      }
    } else {
      emitState(target);
    }
  },
  onStateChange: ({ data, target }) => {
    if (!isFollower) {
      emitState(target);
      clearInterval(pollRef.current);
      if (data === 1) {
        pollRef.current = setInterval(() => emitState(target), 250);
      }
    }
  },
},
```

Replace the `listen("video-control")` block with:
```tsx
const lastStateRef = useVideoFollower(playerRef as RefObject<YTPlayer | null>, "youtube", isFollower);

// Only attach video-control listener when NOT a follower
const unsub = !isFollower
  ? listen<VideoControlEvent>("video-control", (e) => {
      const p = playerRef.current;
      if (!p) return;
      const { action, value } = e.payload;
      if (action === "play") p.playVideo();
      else if (action === "pause") p.pauseVideo();
      else if (action === "seek" && value !== undefined) p.seekTo(value, true);
      else if (action === "volume" && value !== undefined) p.setVolume(Math.round(value * 100));
    }).catch(() => () => {})
  : Promise.resolve(() => {});
```

Also force muted for followers:
```tsx
playerVars: {
  // ...
  mute: (isFollower || muted) ? 1 : 0,
  // ...
}
```

- [ ] **Step 4: Update playing-now-preview mode**

Replace the entire `playing-now-preview` block (currently renders LocalVideoPlayer or YouTubePlayer) with:

```tsx
if (renderMode === "playing-now-preview") {
  const hasVideo = (slide.videoSource === "local" && !!slide.videoUrl) || !!slide.videoId;
  return (
    <div className={cn("h-full w-full bg-black relative overflow-hidden", className)}>
      {hasVideo ? (
        <VideoPreviewSlot className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
          {t("presentations.types.onlineVideo")}
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2 pointer-events-none">
        <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/80 truncate max-w-full">
          {slide.videoTitle ?? ""}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update projector mode to use follower**

In the `projector` renderMode block, add `isFollower` and `muted` to both players:

```tsx
{isLocalFile && localVideoSrc ? (
  <LocalVideoPlayer
    src={localVideoSrc}
    title={slide.videoTitle ?? ""}
    className="h-full w-full"
    muted
    isFollower
  />
) : slide.videoId ? (
  <YouTubePlayer
    videoId={slide.videoId}
    title={slide.videoTitle ?? slide.videoId}
    className="h-full w-full"
    muted
    isFollower
  />
) : (
  <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
    {t("presentations.types.onlineVideo")}
  </div>
)}
```

- [ ] **Step 6: Update return-current mode to add live follower video**

Replace the thumbnail `<img>` fallback with a live YouTubePlayer follower:

```tsx
if (renderMode === "return-current") {
  const isLocalVideo = slide.videoSource === "local" && !!localVideoSrc;
  return (
    <div className={cn("relative h-full w-full bg-black overflow-hidden", className)}>
      {isLocalVideo ? (
        <LocalVideoPlayer
          src={localVideoSrc!}
          title={slide.videoTitle ?? ""}
          className="h-full w-full object-contain"
          muted
          isFollower
        />
      ) : slide.videoId ? (
        <YouTubePlayer
          videoId={slide.videoId}
          title={slide.videoTitle ?? slide.videoId}
          className="h-full w-full"
          muted
          isFollower
        />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-col gap-1">
        <span className="rounded bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] text-white/70 self-start">
          {t("presentations.types.onlineVideo")}
        </span>
        <p className="text-xs text-white/80 truncate">{slide.videoTitle ?? slide.videoId ?? ""}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors. Fix any type issues (e.g., `useVideoFollower` ref type mismatches).

- [ ] **Step 8: Commit**

```bash
git add src/components/online-videos/online-video-slide.tsx src/hooks/use-video-follower.ts
git commit -m "feat: wire isFollower into video slide components, replace preview with VideoPreviewSlot"
```

---

## Task 8: Update playing-now/index.tsx

Replace local `videoState` state and its `listen("video-state")` effect with `useVideoPlayerStore`.

**Files:**
- Modify: `src/routes/playing-now/index.tsx`

- [ ] **Step 1: Add import**

```typescript
import { useVideoPlayerStore } from "../../stores/video-player-store";
```

Remove the existing import:
```typescript
import type { VideoStateEvent } from "../../components/online-videos/online-video-slide";
```
(Only remove it if `VideoStateEvent` is no longer used in this file after the changes below.)

- [ ] **Step 2: Replace local state with store**

Remove:
```typescript
const [videoState, setVideoState] = useState<VideoStateEvent | null>(null);
```

Add near the top of `PlayingNowScreen`:
```typescript
const videoCurrentTime = useVideoPlayerStore((s) => s.currentTime);
const videoDuration = useVideoPlayerStore((s) => s.duration);
const videoPaused = useVideoPlayerStore((s) => s.paused);
const videoActive = useVideoPlayerStore((s) => s.videoId !== null || s.videoSrc !== null);
```

- [ ] **Step 3: Remove the video-state listener effect**

Delete the entire `useEffect` block that called `listen<VideoStateEvent>("video-state", ...)` (approximately lines 239–244 in the original file).

- [ ] **Step 4: Update slide-cleared handler**

In the `listen("slide-cleared")` useEffect, remove:
```typescript
setVideoState(null);
```
The store is reset by `PersistentVideoPlayer` — no action needed here.

- [ ] **Step 5: Update all videoState references**

| Old | New |
|---|---|
| `videoState?.paused === false` | `!videoPaused` |
| `videoState === null` | `!videoActive` |
| `videoState?.currentTime ?? 0` | `videoCurrentTime` |
| `videoState?.duration ?? 0` | `videoDuration` |
| `videoState?.duration ?? 0) > 0 ? videoState!.duration : 100` | `videoDuration > 0 ? videoDuration : 100` |

The `isPlaying` derived value changes from:
```typescript
const isPlaying = isVideoSlide ? videoState?.paused === false : audioStatus === "playing";
```
to:
```typescript
const isPlaying = isVideoSlide ? !videoPaused : audioStatus === "playing";
```

Play/pause button `disabled` changes from:
```typescript
disabled={isVideoSlide ? (videoState === null) : ...}
```
to:
```typescript
disabled={isVideoSlide ? !videoActive : ...}
```

`handleVideoPlayPause`:
```typescript
const handleVideoPlayPause = async () => {
  const action = !videoPaused ? "pause" : "play";
  await emit("video-control", { action }).catch(() => {});
};
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/playing-now/index.tsx
git commit -m "feat: replace videoState local state with videoPlayerStore in Playing Now"
```

---

## Task 9: Manual Verification

No automated tests exist for the Tauri event-based integration. Verify manually:

- [ ] **Check 1 — Playing Now preview persists across navigation**
  1. Project a YouTube video (from Online Videos screen)
  2. Navigate to Playing Now → video plays in preview
  3. Navigate to Hymnal → come back to Playing Now
  4. Verify: video is at the correct current frame (not restarted from 0)

- [ ] **Check 2 — Playing Now controls affect all screens**
  1. With projector + return open and a video projected
  2. Press pause in Playing Now → projector and return pause within 250ms
  3. Press play → all three resume
  4. Seek to a new position → all three jump to same position

- [ ] **Check 3 — Return screen shows live video**
  1. Open return monitor
  2. Project a YouTube video
  3. Verify: return screen shows live video (not thumbnail), synced with projector

- [ ] **Check 4 — Local (downloaded) video syncs**
  1. Project a downloaded video
  2. Same checks as above but for local video

- [ ] **Check 5 — Slide cleared resets correctly**
  1. With video playing, press Stop in Playing Now
  2. Navigate away from Playing Now and back
  3. Verify: preview area shows "no slide" state, not a stale video frame

- [ ] **Final commit if all checks pass**

```bash
git add -A
git commit -m "feat: persistent video player — master-follower sync across all screens"
```
