# Persistent Video Player Design

## Goal

Replace the current per-consumer YouTube/local video player instances with a single master player
in the main window that persists across route navigation, with projector and return windows acting
as dumb followers synchronized via Tauri events.

## Problem

Three consumers need to show the same video simultaneously:

1. **Playing Now preview** (main window) — currently unmounts/restarts on every route change
2. **Projector screen** (separate Tauri webview) — currently the master, emits video-state
3. **Return screen** (separate Tauri webview) — currently shows thumbnail only, no live video

The current architecture has no single source of truth: each window creates an independent
YT.Player that starts from 0. Navigating away from Playing Now destroys the preview player,
so returning to it shows a desynced frame.

## Architecture

### Master: Main Window

The main window holds the single authoritative player. It is the source of truth for:
- What video is currently loaded
- Current playback position
- Play/pause state
- Volume

The master player is **unmuted**. In Tauri 2, all windows run in the same OS process and share
the same audio output device — audio from the main window's player is identical to audio from
the projector window's player. There is no per-window audio routing distinction. Moving the
master from the projector window to the main window therefore has no effect on audio output.

### Followers: Projector and Return

Both are separate Tauri webviews and cannot share DOM elements with the main window.
They each maintain their own **muted** YT.Player / `<video>` element that syncs to the master
via `video-state` broadcast events. They never initiate controls — they only mirror visuals.

## Components

### 1. `videoPlayerStore` (Zustand)

**File:** `src/stores/video-player-store.ts`

Persistent cross-route state for the active video:

```ts
interface VideoPlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  videoId: string | null;              // null when no video is projected
  videoSrc: string | null;             // non-null for local files, null for YouTube
  videoSource: "youtube" | "local" | null;  // explicit discriminant — avoids ambiguity
                                            // when a local file happens to have a videoId
}
```

`videoSource` is the authoritative discriminant. Do not infer type from `videoSrc !== null`.

Replaces the local `useState<VideoStateEvent>` in `playing-now/index.tsx`. Since it is Zustand,
values survive route navigation — the seekbar in Playing Now is correct immediately on remount.

### 2. `videoPlayerRegistry` (module singleton)

**File:** `src/lib/video-player-registry.ts`

Manages the physical DOM node for the master player to enable the DOM transplant:

```ts
let hiddenHost: HTMLElement | null = null;
let playerNode: HTMLElement | null = null;
let attached = false;  // guard against double-attach

export function registerHiddenHost(el: HTMLElement): void
export function registerPlayerNode(el: HTMLElement): void
export function getPlayerNode(): HTMLElement | null          // returns null during transition
export function attachPlayerTo(target: HTMLElement): void   // no-op if playerNode is null
export function detachPlayerToHost(): void
export function clearPlayerNode(): void                     // nulls playerNode, sets attached=false
```

**Re-entrancy guard:** `attachPlayerTo` sets `attached = true`; `detachPlayerToHost` sets
`attached = false`. `attachPlayerTo` is a no-op if `attached === true` or `playerNode === null`.
This prevents React Strict Mode's double effect invocation from producing duplicate moves.
`clearPlayerNode` resets both `playerNode` and `attached` to their initial state.

`attachPlayerTo` / `detachPlayerToHost` use `container.appendChild(node)` — moving a DOM node
to a new parent does not reload it. For YouTube iframes, the `postMessage` channel is tied to
`iframe.contentWindow`, not the iframe's DOM position, so the YT.Player API continues working
after the node is moved.

### 3. `PersistentVideoPlayer`

**File:** `src/components/online-videos/persistent-video-player.tsx`

Always-mounted component placed in `__root.tsx` outside `<Outlet>`. Hidden via
`position: absolute; width: 1px; height: 1px; overflow: hidden; pointer-events: none`.

Responsibilities:
- Registers its root div as the `hiddenHost` via `registerHiddenHost`
- Listens to `slide-changed` Tauri events: when `slideType === "online_video"`, loads the
  appropriate player (YT.Player or `<video>`)
- Listens to `slide-cleared`: pauses player, resets `videoPlayerStore`, calls `clearPlayerNode`
- **Polls player state every 250ms while playing** via `setInterval` inside the component:
  reads currentTime/duration/paused/volume from the player and:
  1. Updates `videoPlayerStore` directly (not via a `listen` handler)
  2. Calls `emit("video-state", state)` to broadcast to ALL windows (projector + return)
- Listens to `video-control` events and applies them to the master player directly
- Calls `registerPlayerNode` after the player element is ready (YT `onReady` / HTML5 `canplay`)

**Important:** `videoPlayerStore` is updated **inside the polling callback**, not via
`listen("video-state")`. `PersistentVideoPlayer` never subscribes to `video-state` — doing so
would create a self-feedback loop since `emit()` broadcasts to the sender's own window too.

**Video change transition order:**
When `slide-changed` arrives with a different `videoId`/`videoSrc` than the current:
1. Call `clearPlayerNode()` — nulls registry, detaches from any slot
2. Destroy old player (call `player.destroy()` for YT, remove `<video>` element)
3. Clear interval
4. Create new player component (re-render with new videoId/src)
5. In `onReady`/`canplay`: call `registerPlayerNode` with the new element
6. If `VideoPreviewSlot` is mounted during steps 1–4, its container will be empty — this is
   the correct "loading" state. Once step 5 completes, `attachPlayerTo` is called again
   automatically by a `useEffect` that watches `getPlayerNode() !== null`.

### 4. `VideoPreviewSlot`

**File:** `src/components/online-videos/persistent-video-player.tsx` (exported)

Used inside the `playing-now-preview` render path. A simple wrapper `<div>` that moves the
master player's DOM node into the preview area when mounted and returns it to the hidden host
when unmounted:

```tsx
function VideoPreviewSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) attachPlayerTo(ref.current);  // no-op if playerNode is null
    return () => detachPlayerToHost();
  }, []);
  return <div ref={ref} className={cn("h-full w-full", className)} />;
}
```

`attachPlayerTo` is guarded — safe under React Strict Mode's double effect invocation.
If `playerNode` is null (player not yet ready or between video changes), the slot renders
empty, matching the existing "no slide" empty state. No special error handling is needed.

### 5. `useVideoFollower`

**File:** `src/hooks/use-video-follower.ts`

Hook used in the projector and return windows' player components. Keeps the local muted player
synchronized with the master's `video-state` broadcasts.

```ts
function useVideoFollower(
  playerRef: RefObject<YTPlayer | HTMLVideoElement | null>,
  playerKind: "youtube" | "local",  // explicit discriminant — YTPlayer is an interface,
                                    // instanceof checks are impossible; use this instead
  initialTime?: number,
): void
```

Behavior on each `video-state` event:
- **play/pause** — mirror via `playerKind`:
  - `"youtube"`: `player.playVideo()` / `player.pauseVideo()`
  - `"local"`: `video.play()` / `video.pause()`
- **drift correction**: if `|localTime - masterTime| > 0.5s` → seek:
  - `"youtube"`: `player.seekTo(masterTime, true)`
  - `"local"`: `video.currentTime = masterTime`

On mount with `initialTime > 2`: seek immediately in `onReady` (YouTube) / `canplay` (local)
to avoid starting from 0 when the projector/return window opens mid-video. Pass
`videoPlayerStore.getState().currentTime` as `initialTime` from the calling component.

Drift threshold of 0.5s is imperceptible for worship presentations and avoids thrashing
on small floating-point differences.

## Modified Files

### `online-video-slide.tsx`

- **`playing-now-preview` mode**: remove `LocalVideoPlayer` / `YouTubePlayer` instances
  entirely; replace with `<VideoPreviewSlot>` for both YouTube and local video.

- **`projector` mode**:
  - Add `useVideoFollower(playerRef, playerKind, initialTime)` to both `LocalVideoPlayer`
    and `YouTubePlayer` when used in projector context
  - Remove `emitTo("main", "video-state")` calls (master is now in main window)
  - Remove `listen("video-control")` handlers from projector-mode players — controls now
    go directly to the master in the main window
  - Set `muted={true}` on all projector-mode players

- **`return-current` mode**:
  - Add live `YouTubePlayer` / `LocalVideoPlayer` with `useVideoFollower` and `muted={true}`
  - **Remove the existing `listen("video-control")` handler** from `LocalVideoPlayer` when
    used in return context — the return screen is a follower and must not respond to controls
    independently (this would cause double seeks)
  - Keep existing title/badge overlay rendered on top of the video

### `__root.tsx`

- Add `<PersistentVideoPlayer>` inside the non-bare layout branch (alongside `<Outlet />`).

### `playing-now/index.tsx`

- Replace `useState<VideoStateEvent | null>` with `useVideoPlayerStore()`
- Remove `useEffect` that called `listen("video-state")`
- All `videoState.*` references become `videoPlayerStore.*` reads

## Event Flow (new)

```
Playing Now controls
  └─► emit("video-control")
         │
         ▼
PersistentVideoPlayer (in __root.tsx, main window)
  ├── applies control to master player directly
  └── polls every 250ms ──► updates videoPlayerStore (directly, not via listen)
                        └──► emit("video-state") to ALL windows
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼               ▼
               main window     projector        return
              (no listener—   useVideoFollower  useVideoFollower
               store already   syncs muted       syncs muted
               updated above)  player            player
```

`videoPlayerStore` is updated by the poll callback inside `PersistentVideoPlayer`, not by
receiving `video-state` events. The diagram arrow from `emit("video-state")` to
`main → videoPlayerStore` is intentionally absent.

## Removed Patterns

- `emitTo("main", "video-state")` from projector's `YouTubePlayer` / `LocalVideoPlayer`
- `listen("video-control")` from projector and return player components
- Local `useState<VideoStateEvent>` + `listen("video-state")` in `playing-now/index.tsx`
- Separate muted YT.Player in `playing-now-preview` mode (replaced by DOM transplant slot)

## Edge Cases

**Projector/return opens mid-video**: `useVideoFollower` receives `initialTime` from
`videoPlayerStore.getState().currentTime` and seeks in `onReady` / `canplay`. The follower
will be within one 250ms broadcast cycle of the master on first render.

**Slide cleared while on another route**: `PersistentVideoPlayer` receives `slide-cleared`,
pauses the master, calls `clearPlayerNode`. `VideoPreviewSlot` will find `playerNode === null`
on remount — renders empty, matching the "no slide" state.

**Video changed mid-session**: See transition order in `PersistentVideoPlayer` section above.
`VideoPreviewSlot` renders empty during the transition (< 1s) then auto-fills once the new
player calls `registerPlayerNode`.

**Local video + streaming server not running**: `PersistentVideoPlayer` uses `useMediaSource`
(already handles the `isRunning` guard) — no change needed.

**React Strict Mode double-effect**: `attachPlayerTo` is guarded by the `attached` flag in
the registry — the second invocation is a no-op.

## Non-Goals

- Streaming server (SSE) video sync — out of scope
- Subtitles / caption tracks synchronized across windows
- Per-window independent volume control
