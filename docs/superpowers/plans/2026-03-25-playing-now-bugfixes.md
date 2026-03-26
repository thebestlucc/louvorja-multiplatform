# Playing Now Post-Refactor Bugfixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 bugs found during testing of the Playing Now Phase 1 Core Refactor.

**Architecture:** The Playing Now system has two projection paths: the old path (`setCurrentSlide` → `slide-changed` event → `usePresentationStore`) and the new path (`useMediaPlayerStore.load()` → Playing Now screen). Several bugs stem from incomplete bridging between these paths. Video playback replaces the streaming server dependency with Tauri's `convertFileSrc` asset protocol.

**Tech Stack:** React 19, Zustand, Tauri 2, TypeScript, `@tauri-apps/api/core` (convertFileSrc)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/stores/audio-store.ts` | Modify | Add `useMediaPlayerStore` bridge to `syncPlaybackSlide` |
| `src/components/online-videos/persistent-video-player.tsx` | Modify | Replace `useMediaSource` with `convertFileSrc` for local videos |
| `src/hooks/use-media-source.ts` | No change | Kept for streaming server (OBS) — no longer used by PVP |
| `src/routes/bible/index.tsx` | Modify | Auto-project on single-click when `isProjecting` |
| `src/components/playing-now/preview-canvas.tsx` | Modify | Fix aspect-ratio container sizing |
| `src/components/playing-now/queue-panel.tsx` | Modify | Add "Clear Queue" button |
| `src/hooks/use-media-player.ts` | Modify | Reset queue index on stop; bridge video events to media-player-store |
| `src/components/playing-now/control-bar.tsx` | Modify | Add mode switching toggle for hymns |
| `src/stores/media-player-store.ts` | Modify | Add `setMode` action |
| `src/hooks/use-playback-coordinator.ts` | Modify | Handle mode switch by restarting audio |
| `src/locales/en.json` | Modify | Add i18n keys |
| `src/locales/pt.json` | Modify | Add i18n keys |
| `src/locales/es.json` | Modify | Add i18n keys |

---

### Task 1: Fix lyrics sync bridge (Issue E)

**Root cause:** `syncPlaybackSlide` in `audio-store.ts` updates `usePresentationStore.setActiveSlideIndex()` (old path) but never updates `useMediaPlayerStore.setActiveSlideIndex()` (new path). Playing Now shows stale slide index.

**Files:**
- Modify: `src/stores/audio-store.ts:101-116`

- [ ] **Step 1: Add media-player-store import and bridge call**

In `src/stores/audio-store.ts`, add the import at the top alongside existing store imports:

```typescript
import { useMediaPlayerStore } from "./media-player-store";
```

Then in the `syncPlaybackSlide` function (around line 107-108), add a second `setActiveSlideIndex` call right after the existing one:

```typescript
  const syncPlaybackSlide = (slideIndex: number) => {
    const state = get();
    if (slideIndex < 0 || slideIndex === state.lastSyncSlide) {
      return;
    }

    set({ lastSyncSlide: slideIndex });
    usePresentationStore.getState().setActiveSlideIndex(slideIndex);
    useMediaPlayerStore.getState().setActiveSlideIndex(slideIndex);

    const displayState = useDisplayStore.getState();
    if (
      displayState.currentProjectionType !== null
    ) {
      queueProjectedSlide(slideIndex);
    }
  };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `useMediaPlayerStore` import or usage.

- [ ] **Step 3: Commit**

```bash
git add src/stores/audio-store.ts
git commit -m "fix(sync): bridge syncPlaybackSlide to useMediaPlayerStore for Playing Now lyrics sync"
```

---

### Task 2: Replace streaming server with convertFileSrc for local video (Issues D & G)

**Root cause:** `persistent-video-player.tsx` uses `useMediaSource` hook which auto-starts the streaming server. The streaming server requires `start_streaming_server` permission only granted to `main` window. Projector/return windows get permission errors. The streaming server is architecturally intended for external consumers (OBS), not internal playback.

**Solution:** Use `convertFileSrc` from `@tauri-apps/api/core` for local video `src`. The asset protocol scope in `tauri.conf.json` already covers `$HOME/**`, `$VIDEO/**`, `$DOWNLOAD/**`, etc. CSP allows `media-src asset:`.

**Files:**
- Modify: `src/components/online-videos/persistent-video-player.tsx:1-11, 78-80, 246-342`

- [ ] **Step 1: Replace useMediaSource import with convertFileSrc**

In `persistent-video-player.tsx`, replace the `useMediaSource` import (line 10):

```typescript
// REMOVE this line:
import { useMediaSource } from "../../hooks/use-media-source";

// ADD this line:
import { convertFileSrc } from "@tauri-apps/api/core";
```

- [ ] **Step 2: Replace useMediaSource hook call with convertFileSrc**

Remove lines 78-80 (the `useMediaSource` hook call and related variables):

```typescript
// REMOVE these lines:
  const localVideoUrl = activeSlide?.videoSource === "local" ? (activeSlide.videoUrl ?? null) : null;
  const localVideoSrc = useMediaSource(localVideoUrl);
```

Replace with a synchronous `convertFileSrc` call:

```typescript
  // Use Tauri asset protocol for local video — no streaming server needed.
  const localVideoSrc = (() => {
    if (activeSlide?.videoSource !== "local" || !activeSlide.videoUrl) return null;
    const path = activeSlide.videoUrl.trim();
    if (!path) return null;
    // URLs (http/https/blob/data) pass through unchanged
    if (/^(https?:|blob:|data:)/.test(path)) return path;
    return convertFileSrc(path);
  })();
```

- [ ] **Step 3: Remove localVideoSrcRef and Effect B (async URL gap handling)**

The `localVideoSrcRef` (line 246-247) and Effect B (lines 336-342) were needed because `useMediaSource` resolved asynchronously. With synchronous `convertFileSrc`, these are unnecessary.

Remove:

```typescript
// REMOVE lines 246-247:
  const localVideoSrcRef = useRef<string | null>(null);
  localVideoSrcRef.current = localVideoSrc;

// REMOVE Effect B (lines 336-342):
  useEffect(() => {
    if (!localVideoSrc || !videoRef.current) return;
    if (videoRef.current.src === localVideoSrc) return;
    videoRef.current.src = localVideoSrc;
  }, [localVideoSrc]);
```

- [ ] **Step 4: Update Effect A to use localVideoSrc directly**

In Effect A (the local video player lifecycle, starting around line 250), replace all references to `localVideoSrcRef.current` with the `localVideoSrc` variable captured in closure. Update the effect to set `video.src` immediately and simplify:

```typescript
  // Effect: create/destroy the <video> element when slide identity changes.
  useEffect(() => {
    const isLocal = activeSlide?.videoSource === "local";
    const videoUrl = activeSlide?.videoUrl ?? null;
    if (!isLocal || !videoUrl || !playerHostRef.current || !localVideoSrc) return;

    // Clean up previous local player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.remove();
      videoRef.current = null;
    }

    const video = document.createElement("video");
    video.style.cssText = "width:100%;height:100%;object-fit:contain;";
    video.playsInline = true;
    video.src = localVideoSrc;
    playerHostRef.current.appendChild(video);
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
      video.muted = true;
      void video.play()
        .then(() => { video.muted = false; })
        .catch((err) => {
          console.warn("[PVP] autoplay failed:", err);
          video.muted = false;
        });
      startPoll();
    };

    const onError = () => {
      const e = video.error;
      console.error("[PVP] video error:", e?.code, e?.message, "src:", video.src.slice(0, 120));
    };

    const onPause = () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      broadcastState(
        { paused: true, currentTime: video.currentTime, duration: isFinite(video.duration) ? video.duration : 0, volume: video.volume },
        { videoId: null, videoSrc: localVideoSrc, videoSource: "local" },
      );
    };

    video.addEventListener("error", onError);
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
      video.removeEventListener("error", onError);
      video.pause();
      video.src = "";
      video.remove();
      videoRef.current = null;
    };
  }, [activeSlide?.videoSource, activeSlide?.videoUrl, localVideoSrc, broadcastState]);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors. The `useMediaSource` import is gone, `convertFileSrc` is used instead.

- [ ] **Step 6: Commit**

```bash
git add src/components/online-videos/persistent-video-player.tsx
git commit -m "fix(video): replace streaming server with convertFileSrc for local video playback

Eliminates permission errors on projector/return windows. Streaming server
stays exclusively for external consumers (OBS/live streaming)."
```

---

### Task 3: Auto-project Bible verse on single-click (Issue H)

**Root cause:** `handleSelectVerse` in `bible/index.tsx` only calls `bible.selectSingleVerse(verse)` — it does NOT call `bible.updateBibleProjection()` when already projecting. Double-click and arrow keys do auto-project, but single-click doesn't.

**Files:**
- Modify: `src/routes/bible/index.tsx:107-116`

- [ ] **Step 1: Add auto-project to handleSelectVerse**

In `src/routes/bible/index.tsx`, modify `handleSelectVerse` to call `updateBibleProjection()` after selecting the verse when `isProjecting`:

```typescript
  const handleSelectVerse = useCallback(
    (verse: number, shiftKey?: boolean) => {
      if (shiftKey && bible.lastSelectedVerse !== null) {
        bible.selectVerseRange(bible.lastSelectedVerse, verse);
      } else {
        bible.selectSingleVerse(verse);
      }
      if (bible.isProjecting) {
        void bible.updateBibleProjection();
      }
    },
    [bible],
  );
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/bible/index.tsx
git commit -m "fix(bible): auto-project verse on single-click when already projecting"
```

---

### Task 4: Fix preview sizing (Issue F)

**Root cause:** In `preview-canvas.tsx`, the video preview wrapper uses `aspect-video w-full max-w-full` without height constraints. The parent flex container has `min-h-0 flex-1` but the inner `aspect-video` can overflow vertically.

**Files:**
- Modify: `src/components/playing-now/preview-canvas.tsx:46-54, 57-68`

- [ ] **Step 1: Fix video preview container**

Replace the video preview section (lines 46-54):

```typescript
  // Video preview (online or offline)
  if (currentItem && mediaHasVideo(currentItem)) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-4">
        <div className="relative h-full w-full max-h-full">
          <VideoPreviewSlot className="h-full w-full" />
        </div>
      </div>
    );
  }
```

- [ ] **Step 2: Fix slide preview container**

Replace the slide preview section (lines 57-68):

```typescript
  // Slide preview (hymn, presentation, bible, etc.)
  if (currentSlide) {
    return (
      <div className="flex h-full items-center justify-center bg-black/90 p-4">
        <div className="relative aspect-video max-h-full max-w-full overflow-hidden rounded-lg shadow-lg">
          <SlideRenderer
            slide={currentSlide}
            renderMode="playing-now-preview"
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }
```

Key change: Use `max-h-full max-w-full` to constrain to parent bounds instead of `w-full max-w-full` which only constrains width.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/playing-now/preview-canvas.tsx
git commit -m "fix(preview): constrain preview dimensions to container bounds on resize"
```

---

### Task 5: Fix queue clear and stop behavior (Issue B)

**Root cause:** (1) No "Clear Queue" button in queue-panel header. (2) `useMediaPlayer.stop()` resets `useMediaPlayerStore` but doesn't reset `useQueueStore.currentIndex`, so the "Now Playing" item persists.

**Files:**
- Modify: `src/components/playing-now/queue-panel.tsx:1-105`
- Modify: `src/hooks/use-media-player.ts:118-122`
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`

- [ ] **Step 1: Add i18n key for clear queue**

Add to all 3 locale files under the `playingNow` section:

`en.json`:
```json
"clearQueue": "Clear queue"
```

`pt.json`:
```json
"clearQueue": "Limpar fila"
```

`es.json`:
```json
"clearQueue": "Limpiar cola"
```

- [ ] **Step 2: Add Clear Queue button to queue-panel header**

In `src/components/playing-now/queue-panel.tsx`, add a `Trash2` import:

```typescript
import {
  PanelRightClose,
  PanelRight,
  Music,
  Presentation,
  X,
  GripVertical,
  Trash2,
} from "lucide-react";
```

Add `clearQueue` to the store selectors (around line 45):

```typescript
  const clearQueue = useQueueStore((s) => s.clearQueue);
```

Add a Clear Queue button in the header between the title and collapse button (lines 93-105). Replace the header `div`:

```typescript
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("playingNow.queue")} ({items.length})
        </span>
        <div className="flex items-center gap-0.5">
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearQueue}
              aria-label={t("playingNow.clearQueue")}
              title={t("playingNow.clearQueue")}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={toggleCollapsed}
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
```

- [ ] **Step 3: Reset queue index on stop**

In `src/hooks/use-media-player.ts`, update the `stop` callback (lines 118-122) to also reset the queue:

```typescript
  const stop = useCallback(() => {
    void useAudioStore.getState().stop();
    void emit("video-control", { action: "stop" });
    store.getState().stop();
    useQueueStore.getState().clearQueue();
  }, []);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/playing-now/queue-panel.tsx src/hooks/use-media-player.ts src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "fix(queue): add clear queue button and reset queue on stop"
```

---

### Task 6: Bridge video events to media-player-store (Issue C)

**Root cause:** Videos activated via the old projection path (`setCurrentSlide` → `slide-changed` event) set `activeSlide` in `PersistentVideoPlayer` but never call `useMediaPlayerStore.load()`. Playing Now reads from `useMediaPlayerStore` and sees `currentItem: null` → shows empty state instead of video preview.

**Solution:** When `PersistentVideoPlayer` receives a video `slide-changed` event, also load a corresponding `MediaItem` into `useMediaPlayerStore`.

**Files:**
- Modify: `src/components/online-videos/persistent-video-player.tsx:88-101`

- [ ] **Step 1: Add media-player-store import**

Add at the top of `persistent-video-player.tsx`:

```typescript
import { useMediaPlayerStore } from "../../stores/media-player-store";
import type { OnlineVideoMediaItem, OfflineVideoMediaItem } from "../../types/media";
```

- [ ] **Step 2: Bridge slide-changed to media-player-store**

In the `slide-changed` listener (around line 90-100), after `setActiveSlide(slide)`, also load a `MediaItem`:

```typescript
  // Listen to slide-changed
  useEffect(() => {
    const unsub = listen<SlideContent>("slide-changed", (e) => {
      const slide = e.payload;
      if (slide.slideType === "online_video") {
        setActiveSlide(slide);

        // Bridge to media-player-store so Playing Now shows video preview
        const mpState = useMediaPlayerStore.getState();
        if (slide.videoSource === "local" && slide.videoUrl) {
          const item: OfflineVideoMediaItem = {
            type: "offline_video",
            videoPath: slide.videoUrl,
            title: slide.videoTitle ?? "Video",
            isManaged: slide.videoUrl.startsWith("media/"),
          };
          if (mpState.currentItem?.type !== "offline_video" || (mpState.currentItem as OfflineVideoMediaItem).videoPath !== slide.videoUrl) {
            mpState.load(item);
          }
        } else if (slide.videoId) {
          const item: OnlineVideoMediaItem = {
            type: "online_video",
            videoId: slide.videoId,
            videoSource: "youtube",
            title: slide.videoTitle ?? "Video",
          };
          if (mpState.currentItem?.type !== "online_video" || (mpState.currentItem as OnlineVideoMediaItem).videoId !== slide.videoId) {
            mpState.load(item);
          }
        }
      } else {
        // Non-video slide projected: pause but keep player alive
        ytPlayerRef.current?.pauseVideo();
        if (videoRef.current) videoRef.current.pause();
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/online-videos/persistent-video-player.tsx
git commit -m "fix(video): bridge slide-changed events to media-player-store for Playing Now preview"
```

---

### Task 7: Add mode switching UI (Issue A)

**Root cause:** No UI to switch between sung/karaoke/silent modes mid-playback. `HymnMediaItem` has a `mode` field but `useMediaPlayerStore` has no `setMode` action, and `control-bar.tsx` has no toggle.

**Files:**
- Modify: `src/stores/media-player-store.ts:6-40, 55-105`
- Modify: `src/components/playing-now/control-bar.tsx`
- Modify: `src/hooks/use-media-player.ts`
- Modify: `src/routes/playing-now/index.tsx`
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`

- [ ] **Step 1: Add setMode action to media-player-store**

In `src/stores/media-player-store.ts`, add to the interface (around line 37):

```typescript
  setMode: (mode: "sung" | "karaoke" | "silent") => void;
```

Add the implementation (after `setOverlay` around line 102):

```typescript
  setMode: (mode) =>
    set((state) => {
      if (state.currentItem?.type !== "hymn") return state;
      return {
        currentItem: { ...state.currentItem, mode },
        timelineSource: mode === "silent" ? "none" : "audio",
      };
    }),
```

- [ ] **Step 2: Add i18n keys for mode labels**

Add to all 3 locale files under the `playingNow` section:

`en.json`:
```json
"modeSung": "Sung",
"modeKaraoke": "Karaoke",
"modeSilent": "Slides only"
```

`pt.json`:
```json
"modeSung": "Cantado",
"modeKaraoke": "Playback",
"modeSilent": "Só slides"
```

`es.json`:
```json
"modeSung": "Cantado",
"modeKaraoke": "Karaoke",
"modeSilent": "Solo diapositivas"
```

- [ ] **Step 3: Add onModeChange to ControlBar props and UI**

In `src/components/playing-now/control-bar.tsx`, add `Mic`, `Music2`, `MonitorPlay` to the lucide imports:

```typescript
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Mic,
  Music2,
  MonitorPlay,
} from "lucide-react";
```

Add to `ControlBarProps`:

```typescript
  currentMode?: "sung" | "karaoke" | "silent";
  onModeChange?: (mode: "sung" | "karaoke" | "silent") => void;
```

Add props to the destructuring:

```typescript
  currentMode,
  onModeChange,
```

Add the mode toggle in the controls row, between the left playback controls and the center slide counter. Insert right after the `{isActive && (` stop button block (after line 164):

```typescript
          {/* Mode toggle (hymns only) */}
          {currentMode && onModeChange && (
            <div className="ml-2 flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <Button
                variant={currentMode === "sung" ? "default" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => onModeChange("sung")}
                title={t("playingNow.modeSung")}
              >
                <Mic className="h-3 w-3" />
              </Button>
              <Button
                variant={currentMode === "karaoke" ? "default" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => onModeChange("karaoke")}
                title={t("playingNow.modeKaraoke")}
              >
                <Music2 className="h-3 w-3" />
              </Button>
              <Button
                variant={currentMode === "silent" ? "default" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => onModeChange("silent")}
                title={t("playingNow.modeSilent")}
              >
                <MonitorPlay className="h-3 w-3" />
              </Button>
            </div>
          )}
```

Add `useTranslation` import at the top and call `const { t } = useTranslation();` inside the component. Import:

```typescript
import { useTranslation } from "react-i18next";
```

- [ ] **Step 4: Add switchMode action to use-media-player**

In `src/hooks/use-media-player.ts`, add a `switchMode` callback after the `stop` callback:

```typescript
  const switchMode = useCallback(async (mode: "sung" | "karaoke" | "silent") => {
    const state = store.getState();
    if (state.currentItem?.type !== "hymn") return;

    const hymn = state.currentItem.hymn;
    store.getState().setMode(mode);

    // Stop current audio
    await useAudioStore.getState().stop();

    if (mode === "silent") {
      // No audio in silent mode
      useAudioStore.getState().setPlaybackMode("silent");
      return;
    }

    // Start appropriate audio
    const audioPath = mode === "karaoke"
      ? (hymn.playbackPath || hymn.audioPath)
      : hymn.audioPath;

    if (audioPath) {
      const playbackMode = mode === "karaoke" ? "karaoke" : "sung";
      useAudioStore.getState().setPlaybackMode(playbackMode);

      const variantPaths = resolvePlaybackVariantPaths(hymn.audioPath, hymn.playbackPath);
      if (variantPaths) {
        await useAudioStore.getState().playVariants(
          variantPaths.sungPath,
          variantPaths.karaokePath,
          playbackMode,
          state.currentTime,
        );
      } else {
        await useAudioStore.getState().play(audioPath, state.currentTime);
      }
    }
  }, []);
```

Add the import for `resolvePlaybackVariantPaths` at the top:

```typescript
import { resolvePlaybackVariantPaths } from "../lib/audio-sync";
```

Add `switchMode` to the return object:

```typescript
  return { play, pause, stop, seek, goToSlide, nextSlide, prevSlide, nextItem, prevItem, switchMode };
```

- [ ] **Step 5: Wire mode props in Playing Now route**

In `src/routes/playing-now/index.tsx`, read the current mode from store and pass to ControlBar.

Add to the `useShallow` selector:

```typescript
      currentItem: s.currentItem,
      // ... existing fields ...
```

Derive the mode:

```typescript
  const currentMode = currentItem?.type === "hymn" ? currentItem.mode : undefined;
```

Pass to ControlBar:

```typescript
            currentMode={currentMode}
            onModeChange={actions.switchMode}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/stores/media-player-store.ts src/components/playing-now/control-bar.tsx src/hooks/use-media-player.ts src/routes/playing-now/index.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat(playing-now): add mode switching UI for hymn playback (sung/karaoke/silent)"
```

---

## Summary of Issue → Task Mapping

| Issue | Description | Task |
|-------|-------------|------|
| E | Lyrics sync broken | Task 1 |
| D | Offline video not playing | Task 2 |
| G | Streaming permission errors | Task 2 |
| H | Bible auto-project on click | Task 3 |
| F | Preview sizing | Task 4 |
| B | Queue clear/remove + stop | Task 5 |
| C | Video preview not showing | Task 6 |
| A | Mode switching UI | Task 7 |
