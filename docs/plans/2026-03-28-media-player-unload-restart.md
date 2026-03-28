# Media Player Unload & Restart Implementation Plan

> **For Agents:** REQUIRED SUB-SKILL: Use ring:executing-plans to implement this plan task-by-task.

**Goal:** Add `unload()` to media-player-store, fix ESC and Stop button to fully reset state when queue is empty, and add a Restart button to the control bar.

**Architecture:** Four isolated changes across 5 files — store action, keyboard hook, media-player hook, control-bar component, and playing-now route. Each change is independent and can be verified in isolation.

**Tech Stack:** TypeScript 5.8, React 19, Zustand, Tauri events (@tauri-apps/api/event), lucide-react icons.

**Global Prerequisites:**
- Environment: macOS/Linux, Node.js 20+, pnpm 9+, Rust toolchain
- Tools: `pnpm --version`, `npx tsc --noEmit`
- State: Working tree should be clean (or changes staged) on `main` branch

**Verification before starting:**
```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
git status          # Expected: on branch main, working tree clean (or only M src-tauri/src/archive/pptx.rs)
pnpm --version      # Expected: 9.x.x
npx tsc --noEmit    # Expected: exits 0, no errors
```

---

## Task 1: Add `unload()` action to media-player-store

**Files:**
- Modify: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/stores/media-player-store.ts`

**Prerequisites:**
- File must exist (it does — read above)
- No external dependencies

**Step 1: Add `unload` to the interface**

In `media-player-store.ts`, line 41, after `stop: () => void;`, add `unload: () => void;`:

Old text (lines 41-42):
```typescript
  stop: () => void;
}
```

New text:
```typescript
  stop: () => void;
  unload: () => void;
}
```

**Step 2: Add `unload` implementation**

In `media-player-store.ts`, after the `stop` action implementation (after line 128, the closing `}),`), add the `unload` action:

Old text (lines 115-129):
```typescript
  stop: () =>
    set((state) => ({
      status: "idle",
      currentTime: 0,
      duration: 0,
      timelineSource: "none" as TimelineSource,
      activeSlideIndex: 0,
      error: null,
      // Preserve currentItem and overlay — stop ≠ unload
      currentItem: state.currentItem,
      overlay: state.overlay,
      slides: state.slides,
      syncPoints: state.syncPoints,
    })),
}));
```

New text:
```typescript
  stop: () =>
    set((state) => ({
      status: "idle",
      currentTime: 0,
      duration: 0,
      timelineSource: "none" as TimelineSource,
      activeSlideIndex: 0,
      error: null,
      // Preserve currentItem and overlay — stop ≠ unload
      currentItem: state.currentItem,
      overlay: state.overlay,
      slides: state.slides,
      syncPoints: state.syncPoints,
    })),

  unload: () => set({ ...initialState }),
}));
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && npx tsc --noEmit`

Expected output:
```
(exits 0 with no errors)
```

If you see `Property 'unload' does not exist on type 'MediaPlayerState'` — check that the interface addition in Step 1 was applied correctly.

**Step 4: Commit**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
git add src/stores/media-player-store.ts
git commit -m "feat(media-player): add unload() action to fully reset store state"
```

**If Task Fails:**

1. **TS error on `unload` in interface:** The `unload: () => void;` line was not added to the `MediaPlayerState` interface (lines 6-42). Check both the interface and the implementation are present.
2. **`initialState` spread doesn't include all fields:** Verify `initialState` (lines 44-55) covers all fields — it does (currentItem, status, currentTime, duration, timelineSource, slides, activeSlideIndex, syncPoints, overlay, error). The `...initialState` spread is safe.
3. **Rollback:** `git checkout -- src/stores/media-player-store.ts`

---

## Task 2: Fix ESC key behavior — call `unload()` when queue ≤ 1 items

**Files:**
- Modify: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-keyboard.ts`

**Prerequisites:**
- Task 1 must be complete (`unload` exists on `useMediaPlayerStore`)
- `useMediaPlayerStore` is already imported in this file (line 0 — it is NOT currently imported; must add import)

**Step 1: Add import for `useMediaPlayerStore`**

In `use-keyboard.ts`, line 7 (after `import { useQueueStore } from "../stores/queue-store";`):

Old text (lines 6-8):
```typescript
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { useSetting } from "../lib/queries";
```

New text:
```typescript
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { useSetting } from "../lib/queries";
import { useMediaPlayerStore } from "../stores/media-player-store";
```

**Step 2: Call `unload()` in `clearPresentation`**

In `use-keyboard.ts`, the `clearPresentation` callback (lines 26-34):

Old text:
```typescript
  const clearPresentation = useCallback(() => {
    usePresentationStore.getState().setSlides([]);
    void stopProjectionAndSongAudio();
    // Clear queue when ESC is pressed with one item or at the last item
    const q = useQueueStore.getState();
    if (q.items.length <= 1 || q.currentIndex >= q.items.length - 1) {
      q.clearQueue();
    }
  }, []);
```

New text:
```typescript
  const clearPresentation = useCallback(() => {
    usePresentationStore.getState().setSlides([]);
    void stopProjectionAndSongAudio();
    // Clear queue and unload media player when ESC is pressed with one item or at the last item
    const q = useQueueStore.getState();
    if (q.items.length <= 1 || q.currentIndex >= q.items.length - 1) {
      q.clearQueue();
      useMediaPlayerStore.getState().unload();
    }
  }, []);
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && npx tsc --noEmit`

Expected output:
```
(exits 0 with no errors)
```

If you see `Property 'unload' does not exist` — Task 1 was not completed. Complete Task 1 first.

**Step 4: Commit**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
git add src/hooks/use-keyboard.ts
git commit -m "fix(keyboard): unload media player store on ESC when queue is empty"
```

**If Task Fails:**

1. **Import not found:** Verify path `../stores/media-player-store` resolves correctly from `src/hooks/`. It should — other stores are imported with the same `../stores/` prefix.
2. **`unload` not a function:** Task 1 was not completed. Run Task 1 first.
3. **Rollback:** `git checkout -- src/hooks/use-keyboard.ts`

---

## Task 3: Fix Stop button behavior — unload when queue ≤ 1 items

**Files:**
- Modify: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-media-player.ts`

**Prerequisites:**
- Task 1 must be complete (`unload` exists on `useMediaPlayerStore`)
- `useQueueStore` is already imported (line 9)
- `useMediaPlayerStore` is already imported (line 6)

**Step 1: Replace the `stop` callback**

In `use-media-player.ts`, lines 120-128:

Old text:
```typescript
  const stop = useCallback(() => {
    // Seek video to beginning before clearing screens
    if (store.getState().timelineSource === "video") {
      void emit("video-control", { action: "seek", value: 0 });
    }
    void useAudioStore.getState().stop();
    void clearCurrentSlide();
    store.getState().stop();
  }, []);
```

New text:
```typescript
  const stop = useCallback(() => {
    // Seek video to beginning before clearing screens
    if (store.getState().timelineSource === "video") {
      void emit("video-control", { action: "seek", value: 0 });
    }
    void useAudioStore.getState().stop();
    void clearCurrentSlide();
    store.getState().stop();
    // Unload fully when queue has 0 or 1 items (nothing left to play)
    const q = useQueueStore.getState();
    if (q.items.length <= 1) {
      q.clearQueue();
      store.getState().unload();
    }
  }, []);
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && npx tsc --noEmit`

Expected output:
```
(exits 0 with no errors)
```

**Step 3: Commit**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
git add src/hooks/use-media-player.ts
git commit -m "fix(media-player): clear queue and unload store on stop when queue is empty"
```

**If Task Fails:**

1. **`unload` not found:** Task 1 not complete. Run Task 1 first.
2. **`clearQueue` not found on `q`:** Verify import line 9 `import { useQueueStore } from "../stores/queue-store";` is present and unchanged.
3. **Rollback:** `git checkout -- src/hooks/use-media-player.ts`

---

## Task 4: Add `restart` action to `use-media-player.ts`

**Files:**
- Modify: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-media-player.ts`

**Prerequisites:**
- `emit` from `@tauri-apps/api/event` already imported (line 3)
- `useAudioStore` already imported (line 7)
- `useMediaPlayerStore` available as `store` (line 19)

**Step 1: Add `restart` callback after `stop`**

In `use-media-player.ts`, after the `stop` callback and before the `seek` callback (after line 128, i.e. after the `}, []);` of `stop`):

Old text (lines 130-137):
```typescript
  const seek = useCallback((timeMs: number) => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      void useAudioStore.getState().seek(timeMs);
    } else if (state.timelineSource === "video") {
      void emit("video-control", { action: "seek", value: timeMs / 1000 });
    }
  }, []);
```

New text:
```typescript
  const restart = useCallback(() => {
    const state = store.getState();
    if (state.timelineSource === "video") {
      void emit("video-control", { action: "seek", value: 0 });
      void emit("video-control", { action: "play" });
    } else {
      // Audio restart: seek to beginning and resume
      const audioState = useAudioStore.getState();
      void audioState.seek(0);
      void audioState.resume();
    }
    // Reset media-player-store timeline position
    store.getState().seek(0);
  }, []);

  const seek = useCallback((timeMs: number) => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      void useAudioStore.getState().seek(timeMs);
    } else if (state.timelineSource === "video") {
      void emit("video-control", { action: "seek", value: timeMs / 1000 });
    }
  }, []);
```

**Step 2: Add `restart` to the return object**

In `use-media-player.ts`, line 268 (the `return` statement):

Old text:
```typescript
  return { play, pause, stop, seek, goToSlide, nextSlide, prevSlide, nextItem, prevItem, switchMode, setVolume };
```

New text:
```typescript
  return { play, pause, stop, restart, seek, goToSlide, nextSlide, prevSlide, nextItem, prevItem, switchMode, setVolume };
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && npx tsc --noEmit`

Expected output:
```
(exits 0 with no errors)
```

If you see `store.getState().seek is not callable` — note that `store` is `useMediaPlayerStore` (the Zustand store object), and `useMediaPlayerStore.getState().seek` refers to the `seek` callback defined later in the same hook. This is a forward reference issue. In this case, replace `store.getState().seek(0)` with a direct `set` call:

```typescript
  // Reset media-player-store timeline position
  useMediaPlayerStore.setState({ currentTime: 0, activeSlideIndex: 0 });
```

**Step 4: Commit**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
git add src/hooks/use-media-player.ts
git commit -m "feat(media-player): add restart() action to seek to beginning and resume"
```

**If Task Fails:**

1. **`store.getState().seek` conflicts with hook's own `seek`:** The `seek` on `MediaPlayerState` (store) is a different function from the hook's `seek` — the store does not have a `seek` action. Replace `store.getState().seek(0)` with `useMediaPlayerStore.setState({ currentTime: 0, activeSlideIndex: 0 })`.
2. **Rollback:** `git checkout -- src/hooks/use-media-player.ts`

---

## Task 5: Add `onRestart` prop and Restart button to ControlBar

**Files:**
- Modify: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/playing-now/control-bar.tsx`

**Prerequisites:**
- `RotateCcw` must be imported from `lucide-react` (not currently imported — must add)
- Tasks 3 and 4 can be done in parallel with this task (no runtime dependency between them)

**Step 1: Add `RotateCcw` to the lucide-react import**

In `control-bar.tsx`, lines 1-17 (the import block):

Old text:
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

New text:
```typescript
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Mic,
  Music2,
  MonitorPlay,
} from "lucide-react";
```

**Step 2: Add `onRestart` to `ControlBarProps` interface**

In `control-bar.tsx`, lines 22-44 (the `ControlBarProps` interface):

Old text:
```typescript
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (timeMs: number) => void;
```

New text:
```typescript
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRestart: () => void;
  onSeek: (timeMs: number) => void;
```

**Step 3: Destructure `onRestart` in the component function signature**

In `control-bar.tsx`, lines 53-74 (the function parameters):

Old text:
```typescript
  onPlay,
  onPause,
  onStop,
  onSeek,
```

New text:
```typescript
  onPlay,
  onPause,
  onStop,
  onRestart,
  onSeek,
```

**Step 4: Add Restart button next to Stop button**

In `control-bar.tsx`, lines 170-174:

Old text:
```typescript
          {isActive && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop} aria-label="Stop">
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}
```

New text:
```typescript
          {isActive && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRestart} aria-label="Restart">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop} aria-label="Stop">
                <Square className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && npx tsc --noEmit`

Expected output:
```
error TS2739: ... Property 'onRestart' is missing in type ...
```

This error is EXPECTED — it means the prop was added but not yet wired in the parent. Proceed to Task 6.

**Step 6: Commit**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
git add src/components/playing-now/control-bar.tsx
git commit -m "feat(control-bar): add Restart button with onRestart prop"
```

**If Task Fails:**

1. **`RotateCcw` not found in lucide-react:** The installed version may differ. Check with `grep -r "RotateCcw" node_modules/lucide-react/dist/`. If not found, use `RefreshCcw` instead.
2. **JSX Fragment error:** If `<>...</>` causes issues, replace with `<div className="flex items-center gap-1">...</div>`.
3. **Rollback:** `git checkout -- src/components/playing-now/control-bar.tsx`

---

## Task 6: Wire `onRestart` in the playing-now route

**Files:**
- Modify: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/playing-now/index.tsx`

**Prerequisites:**
- Task 4 complete (`restart` returned from `useMediaPlayer()`)
- Task 5 complete (`onRestart` prop exists on `ControlBar`)

**Step 1: Add `onRestart` prop to `<ControlBar>`**

In `playing-now/index.tsx`, lines 82-106 (the `<ControlBar>` JSX):

Old text:
```typescript
          <ControlBar
            currentItem={currentItem}
            status={status}
            currentTime={currentTime}
            duration={duration}
            activeSlideIndex={effectiveActiveIndex}
            totalSlides={effectiveSlides.length}
            volume={volume}
            muted={outputMuted}
            onPlay={actions.play}
            onPause={actions.pause}
            onStop={actions.stop}
            onSeek={actions.seek}
            onPrevSlide={actions.prevSlide}
            onNextSlide={actions.nextSlide}
            onVolumeChange={actions.setVolume}
            onMuteToggle={() => {
              const s = useAudioStore.getState();
              s.setOutputMuted(!s.outputMuted);
            }}
            onPrevItem={actions.prevItem}
            onNextItem={actions.nextItem}
            currentMode={currentMode}
            onModeChange={actions.switchMode}
          />
```

New text:
```typescript
          <ControlBar
            currentItem={currentItem}
            status={status}
            currentTime={currentTime}
            duration={duration}
            activeSlideIndex={effectiveActiveIndex}
            totalSlides={effectiveSlides.length}
            volume={volume}
            muted={outputMuted}
            onPlay={actions.play}
            onPause={actions.pause}
            onStop={actions.stop}
            onRestart={actions.restart}
            onSeek={actions.seek}
            onPrevSlide={actions.prevSlide}
            onNextSlide={actions.nextSlide}
            onVolumeChange={actions.setVolume}
            onMuteToggle={() => {
              const s = useAudioStore.getState();
              s.setOutputMuted(!s.outputMuted);
            }}
            onPrevItem={actions.prevItem}
            onNextItem={actions.nextItem}
            currentMode={currentMode}
            onModeChange={actions.switchMode}
          />
```

**Step 2: Verify TypeScript compiles with zero errors**

Run: `cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && npx tsc --noEmit`

Expected output:
```
(exits 0 with no errors)
```

If you see `Property 'restart' does not exist on type ...` — Task 4 was not completed or `restart` was not added to the return object in `use-media-player.ts`.

**Step 3: Commit**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
git add src/routes/playing-now/index.tsx
git commit -m "feat(playing-now): wire restart action to ControlBar"
```

**If Task Fails:**

1. **`actions.restart` is undefined:** Check `use-media-player.ts` return statement includes `restart`. Run Task 4 first.
2. **TS error on `onRestart` in ControlBar:** Check Task 5 added the prop to both interface and destructuring.
3. **Rollback:** `git checkout -- src/routes/playing-now/index.tsx`

---

## Task 7: Code Review Checkpoint

**Step 1: Run TypeScript and verify zero errors**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && npx tsc --noEmit
```

Expected output:
```
(exits 0 with no errors)
```

**Step 2: Review all changed files for correctness**

Files changed across all tasks:
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/stores/media-player-store.ts` — `unload()` added
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-keyboard.ts` — ESC calls `unload()` when queue ≤ 1
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-media-player.ts` — `stop` calls `clearQueue()+unload()` when queue ≤ 1; `restart` action added
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/playing-now/control-bar.tsx` — `onRestart` prop + Restart button
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/playing-now/index.tsx` — `onRestart={actions.restart}` wired

**Step 3: Dispatch code reviewers**

REQUIRED SUB-SKILL: Use ring:requesting-code-review — dispatch all 5 reviewers in parallel.

**Step 4: Handle findings by severity**

- Critical/High/Medium: Fix immediately, re-run all 5 reviewers after fixes, repeat until zero remain.
- Low: Add `TODO(review): [Issue] (reported by [reviewer] on 2026-03-28, severity: Low)` comment in code.
- Cosmetic: Add `FIXME(nitpick): [Issue] (reported by [reviewer] on 2026-03-28, severity: Cosmetic)` comment in code.

---

## Implementation Order Summary

```
Task 1: media-player-store.ts — add unload()             [no deps]
Task 2: use-keyboard.ts — ESC calls unload()             [depends on Task 1]
Task 3: use-media-player.ts — stop calls unload()        [depends on Task 1]
Task 4: use-media-player.ts — add restart()              [no deps, same file as Task 3 — do after Task 3]
Task 5: control-bar.tsx — add Restart button             [no deps]
Task 6: playing-now/index.tsx — wire onRestart           [depends on Tasks 4 and 5]
Task 7: Code Review                                      [depends on all above]
```

Tasks 2, 3+4, and 5 can be done in parallel after Task 1 completes.
