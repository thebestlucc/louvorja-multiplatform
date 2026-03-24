# Online Video Playback Fixes & Enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs in online video playback and add 4 UX features for video projection control.

**Architecture:** Bug fixes are isolated one-file changes (permissions, null-guard, listener pattern, render mode). Features layer new state into `presentationStore`, new Rust commands (`set_slide_on_projector` / `set_slide_on_return`), and new render modes in `OnlineVideoSlide`. The Playing Now preview replaces the text-only `return-current` render with an actual video/iframe for video slides.

**Tech Stack:** Tauri 2 (Rust), React 19, TanStack Query, Zustand, i18next (en/pt/es)

---

## File Map

| File | Change |
|------|--------|
| `src-tauri/capabilities/default.json` | Add `opener:allow-open-url` permission |
| `src/components/online-videos/online-video-slide.tsx` | Fix empty `src` null-guard; improve `return-current`/`return-next` to show video/thumbnail; add `"playing-now-preview"` mode |
| `src/lib/use-presentation-font-size.ts` | Fix unlisten race condition (align with project-standard safe promise pattern) |
| `src/stores/presentation-store.ts` | Add `currentVideoProjectionId: string \| null` + setter |
| `src/components/online-videos/video-card.tsx` | Show playing indicator; replace single "Project" button with three target buttons |
| `src-tauri/src/display/projection.rs` | Extract `update_current_slide_targeted(target)` helper |
| `src-tauri/src/commands/display.rs` | Add `set_slide_on_projector` + `set_slide_on_return` commands |
| `src-tauri/src/lib.rs` | Register the two new commands via `tauri_specta::collect_commands!` |
| `src/lib/tauri/display.ts` | Add `setSlideOnProjector` + `setSlideOnReturn` wrappers |
| `src/routes/playing-now/index.tsx` | Use `"playing-now-preview"` render mode; emit video-control to all windows |
| `src/locales/en.json` | New i18n keys for three projection buttons + "now playing" label |
| `src/locales/pt.json` | Same keys in Portuguese |
| `src/locales/es.json` | Same keys in Spanish |

---

## Task 1: Fix opener permission

**Files:**
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add the missing permission**

Open `src-tauri/capabilities/default.json` and add `"opener:allow-open-url"` to the `permissions` array (after `"opener:allow-default-urls"`):

```json
"opener:allow-default-urls",
"opener:allow-open-url",
{
  "identifier": "opener:allow-open-path",
  ...
}
```

- [ ] **Step 2: Verify Rust build still compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/capabilities/default.json
git commit -m "fix(permissions): add opener:allow-open-url to desktop capability"
```

---

## Task 2: Fix empty `src` attribute on local video

**Root cause:** In `OnlineVideoSlide`, the condition `isLocalFile && slide.videoUrl` can be true while `localVideoSrc` is still `null` (streaming port not yet known). Passing `localVideoSrc ?? ""` to `<video src="">` triggers a React warning and causes the browser to re-download the page.

**Files:**
- Modify: `src/components/online-videos/online-video-slide.tsx`

- [ ] **Step 1: Tighten the guard in the projector render branch**

Find the line inside `if (renderMode === "projector")`:
```tsx
{isLocalFile && slide.videoUrl ? (
  <LocalVideoPlayer
    src={localVideoSrc ?? ""}
```

Replace with:
```tsx
{isLocalFile && localVideoSrc ? (
  <LocalVideoPlayer
    src={localVideoSrc}
```

This defers rendering the video element until the streaming server URL is available.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/online-videos/online-video-slide.tsx
git commit -m "fix(video): skip LocalVideoPlayer render until streaming URL resolves"
```

---

## Task 3: Fix listener race condition in use-presentation-font-size.ts

**Root cause:** The hook uses a non-standard `listen()` pattern that leaks the listener when the component unmounts before the Promise resolves, causing a Tauri internal `listeners[eventId].handlerId` error. The rest of the codebase uses the safe promise pattern.

**Files:**
- Modify: `src/lib/use-presentation-font-size.ts`

- [ ] **Step 1: Replace the listen pattern in `useProjectionDisplay`**

Current code (lines 77–90 in `useProjectionDisplay`):
```ts
listen<ProjectionDisplaySettings>(PROJECTION_DISPLAY_EVENT, (event) => {
  setSettings(event.payload);
}).then((fn) => {
  if (mounted) {
    unlisten = fn;
  } else {
    fn();
  }
});

return () => {
  mounted = false;
  unlisten?.();
};
```

Replace the entire `useEffect` with the safe promise pattern (used project-wide). Remove the `unlisten` ref and `mounted` variables — they are no longer needed:
```ts
useEffect(() => {
  let cancelled = false;

  const load = async () => {
    const [fontSize] = await catcher(
      getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE),
    );
    const [fontFamily] = await catcher(
      getPreference<string>(PROJECTION_FONT_FAMILY_KEY, DEFAULT_PROJECTION_FONT_FAMILY),
    );
    if (!cancelled) {
      setSettings({
        fontSize: fontSize ?? DEFAULT_PRESENTATION_FONT_SIZE,
        fontFamily: normalizeFontFamily(fontFamily),
      });
    }
  };
  void load();

  // Safe promise pattern: .catch(() => () => {}) prevents unhandled rejections;
  // cleanup always eventually calls the unlisten function.
  const unsub = listen<ProjectionDisplaySettings>(PROJECTION_DISPLAY_EVENT, (event) => {
    if (!cancelled) setSettings(event.payload);  // guard against post-unmount state update
  }).catch(() => () => {});

  return () => {
    cancelled = true;
    void unsub.then((fn) => fn()).catch(() => {});
  };
}, []);
```

> The `if (!cancelled)` guard inside the listener is important: it prevents setting React state after unmount (which can happen if the event fires between `cancelled = true` and the actual `.then((fn) => fn())` cleanup executing).

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-presentation-font-size.ts
git commit -m "fix(listener): align useProjectionDisplay with safe promise unlisten pattern"
```

---

## Task 4: Fix return monitor / streaming showing text instead of video

**Root cause:** The `return-current` and `return-next` render modes in `OnlineVideoSlide` only render a text badge. The Tauri `/return` window CAN serve local files via the streaming server. YouTube should show a thumbnail + title (no iframe — cross-origin issues on the return monitor).

**Files:**
- Modify: `src/components/online-videos/online-video-slide.tsx`

- [ ] **Step 1: Update `return-current` render mode**

Replace the `if (renderMode === "return-current")` block:
```tsx
if (renderMode === "return-current") {
  const isLocalVideo = slide.videoSource === "local" && !!localVideoSrc;
  const thumbUrl = slide.videoId
    ? `https://i.ytimg.com/vi/${slide.videoId}/hqdefault.jpg`
    : null;

  return (
    <div className={cn("relative h-full w-full bg-black overflow-hidden", className)}>
      {isLocalVideo ? (
        <LocalVideoPlayer
          src={localVideoSrc!}
          title={slide.videoTitle ?? ""}
          className="h-full w-full object-contain"
          muted
        />
      ) : thumbUrl ? (
        <img src={thumbUrl} alt="" className="h-full w-full object-cover opacity-60" />
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

- [ ] **Step 2: Update `return-next` render mode**

Replace `if (renderMode === "return-next")` block:
```tsx
if (renderMode === "return-next") {
  const thumbUrl = slide.videoId
    ? `https://i.ytimg.com/vi/${slide.videoId}/hqdefault.jpg`
    : null;

  return (
    <div className={cn("relative h-full w-full bg-black overflow-hidden", className)}>
      {thumbUrl && (
        <img src={thumbUrl} alt="" className="h-full w-full object-cover opacity-40" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex flex-col gap-1">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.25em] text-white/60 self-start">
          {t("presentations.types.onlineVideo")}
        </span>
        <p className="text-[10px] text-white/70 truncate">{slide.videoTitle ?? slide.videoId ?? ""}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `muted` prop to `LocalVideoPlayer`**

Update `LocalVideoPlayer` interface and element:
```tsx
function LocalVideoPlayer({ src, title, className, muted }: {
  src: string; title: string; className?: string; muted?: boolean
}) {
  // ... existing refs and effects ...
  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      title={title}
      playsInline
      muted={muted}
    />
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/components/online-videos/online-video-slide.tsx
git commit -m "fix(return-monitor): show video/thumbnail for online_video slides on return screen"
```

---

## Task 5: Add "currently playing" indicator to video items

**Goal:** Track which video is currently projected (persisted in Zustand) and show a visual indicator on the VideoCard.

**Files:**
- Modify: `src/stores/presentation-store.ts`
- Modify: `src/components/online-videos/video-card.tsx`

- [ ] **Step 1: Add `currentVideoProjectionId` to `presentationStore`**

In `src/stores/presentation-store.ts`, find the `PresentationState` interface and add:
```ts
currentVideoProjectionId: string | null;
setCurrentVideoProjectionId: (id: string | null) => void;
```

In the `create()` call, add:
```ts
currentVideoProjectionId: null,
setCurrentVideoProjectionId: (id) => set({ currentVideoProjectionId: id }),
```

- [ ] **Step 2: Update `handleProject` in `video-card.tsx` to track the projection**

In `video-card.tsx`, after the successful `setCurrentSlide()` call inside `handleProject`:
```ts
const handleProject = async () => {
  // ... existing logic to build videoUrl/videoId/videoSource ...
  const [, err] = await catcher(setCurrentSlide({ ... }), { notify: true });
  if (!err) {
    // Track which video is currently projected (use videoId for YT, localPath for local)
    usePresentationStore.getState().setCurrentVideoProjectionId(
      video.localPath ?? video.videoId,
    );
  }
};
```

Also import `usePresentationStore`:
```ts
import { usePresentationStore } from "../../stores/presentation-store";
```

- [ ] **Step 3: Show indicator in VideoCard render**

In `video-card.tsx`, add a selector at the top of the component:
```ts
const currentVideoProjectionId = usePresentationStore(
  (s) => s.currentVideoProjectionId,
);
const isProjecting =
  currentVideoProjectionId === video.videoId ||
  currentVideoProjectionId === video.localPath;
```

Add a visual indicator in the thumbnail area (overlay on the thumbnail `div`):
```tsx
{isProjecting && (
  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
    <div className="flex flex-col items-center gap-1">
      <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
      <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">
        {t("onlineVideos.detail.nowPlaying")}
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 4: Clear the indicator when slide is cleared**

The playing-now screen already listens to `slide-cleared`. However we need to clear `currentVideoProjectionId` on that event too. In `playing-now/index.tsx`, inside the `slide-cleared` listener:
```ts
const unsub = listen("slide-cleared", () => {
  setCurrentSlide(null);
  setContextIndex(0);
  setContextTotal(0);
  setVideoState(null);
  usePresentationStore.getState().setCurrentVideoProjectionId(null); // add this
}).catch(() => () => {});
```

Import `usePresentationStore` at the top of the file.

- [ ] **Step 5: Add i18n keys**

In `src/locales/en.json`, inside `"onlineVideos"."detail"`:
```json
"nowPlaying": "Now playing",
"projectAll": "All screens",
"projectProjector": "Projector only",
"projectReturn": "Return + streaming"
```

In `src/locales/pt.json`:
```json
"nowPlaying": "Em exibição",
"projectAll": "Todas as telas",
"projectProjector": "Somente projetor",
"projectReturn": "Retorno + streaming"
```

In `src/locales/es.json`:
```json
"nowPlaying": "En pantalla",
"projectAll": "Todas las pantallas",
"projectProjector": "Solo proyector",
"projectReturn": "Retorno + streaming"
```

- [ ] **Step 6: TypeScript check + i18n lint**

```bash
npx tsc --noEmit 2>&1 | head -20
pnpm lint:i18n 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add src/stores/presentation-store.ts src/components/online-videos/video-card.tsx \
        src/routes/playing-now/index.tsx \
        src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat(video): add currently-playing indicator to video cards"
```

---

## Task 6: Add target-specific projection (projector-only / return-only)

**Goal:** Allow projecting a video to only the projector window OR only the return/streaming screens.

**Approach:**
- Two new Rust commands: `set_slide_on_projector` and `set_slide_on_return`
- `set_slide_on_projector` — emits `slide-changed` only to the "projector" window; does NOT broadcast SSE
- `set_slide_on_return` — emits `slide-changed` only to the "return" window AND broadcasts SSE; does NOT emit to projector
- Both update `state.current_slide` so `get_current_slide` stays consistent
- Register both in `lib.rs`; add wrappers in `tauri/display.ts`
- Replace the single "Project" button in `video-card.tsx` with three buttons

**Files:**
- Modify: `src-tauri/src/display/projection.rs`
- Modify: `src-tauri/src/commands/display.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri/display.ts`
- Modify: `src/components/online-videos/video-card.tsx`

- [ ] **Step 1: Add `set_slide_on_projector` command in `display.rs`**

After the existing `set_current_slide` function, add:
```rust
#[tauri::command]
#[specta::specta]
pub fn set_slide_on_projector(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    if !is_live_utility_slide(&slide_data) {
        stop_live_utility_projection(&state)?;
    }
    {
        let mut current = state
            .current_slide
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    // Emit only to the projector window (not all windows, not SSE)
    if let Some(projector_win) = app.get_webview_window("projector") {
        projector_win
            .emit("slide-changed", &slide_data)
            .map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    Ok(())
}
```

- [ ] **Step 2: Add `set_slide_on_return` command in `display.rs`**

```rust
#[tauri::command]
#[specta::specta]
pub fn set_slide_on_return(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    if !is_live_utility_slide(&slide_data) {
        stop_live_utility_projection(&state)?;
    }
    {
        let mut current = state
            .current_slide
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    // Emit only to the return window (not projector, not main)
    if let Some(return_win) = app.get_webview_window("return") {
        return_win
            .emit("slide-changed", &slide_data)
            .map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    // Broadcast to SSE streaming viewers
    let app_data_dir = app.path().app_data_dir().ok();
    let adr = app_data_dir.as_deref();
    if let Ok(server) = streaming_state.server.lock() {
        let return_payload = build_return_stream_payload(&slide_data, None, adr);
        server.broadcast_return(&return_payload.to_string());
    }
    Ok(())
}
```

Add `build_return_stream_payload` to the **existing** `use crate::commands::streaming` import block at the top of `display.rs` (lines 15–18):
```rust
use crate::commands::streaming::{
    empty_return_stream_payload,
    empty_streaming_music_payload,
    build_return_stream_payload,  // ← add this
};
```

- [ ] **Step 3: Register both commands in `lib.rs`**

Find `tauri_specta::collect_commands![` in `src-tauri/src/lib.rs` and add `set_slide_on_projector, set_slide_on_return` to the list.

- [ ] **Step 4: Verify Rust build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10
```
Expected: no errors. `bindings.ts` will be regenerated on next `pnpm tauri dev`.

- [ ] **Step 5: Add TypeScript wrappers in `src/lib/tauri/display.ts`**

This file uses the `tauriInvoke<T>()` helper pattern (see existing wrappers like `setCurrentSlide`). Add after `setCurrentSlide`:
```ts
export async function setSlideOnProjector(slideData: SlideContent): Promise<void> {
  return tauriInvoke<void>("set_slide_on_projector", { slideData });
}

export async function setSlideOnReturn(slideData: SlideContent): Promise<void> {
  return tauriInvoke<void>("set_slide_on_return", { slideData });
}
```

> The `tauriInvoke` helper is defined at the top of `display.ts` — no extra import needed. The Rust command names use snake_case (`set_slide_on_projector`), as required by Tauri's invoke bridge.

- [ ] **Step 6: Replace single Project button with three buttons in `video-card.tsx`**

Import the new wrappers:
```ts
import { downloadOnlineVideo, cancelDownload, setCurrentSlide, setSlideOnProjector, setSlideOnReturn } from "../../lib/tauri";
```

Extract the slide payload builder into a helper:
```ts
function buildVideoSlidePayload(video: OnlineVideo): SlideContent {
  const isLocal = !!video.localPath;
  return {
    slideType: "online_video",
    videoId: isLocal ? null : video.videoId,
    videoTitle: video.title ?? "",
    videoUrl: isLocal ? video.localPath : null,
    videoSource: isLocal ? "local" : "youtube",
    text: null, title: null, subtitle: null, label: null,
    videoPath: null, backgroundImage: null, backgroundColor: null,
    audioPath: null, autoPlay: null, loop: null, muted: null,
    mode: null, textColor: null, textSize: null,
  };
}
```

Update `handleProject` to accept a target:
```ts
const handleProject = async (target: "all" | "projector" | "return") => {
  const payload = buildVideoSlidePayload(video);
  const fn = target === "projector"
    ? setSlideOnProjector
    : target === "return"
    ? setSlideOnReturn
    : setCurrentSlide;
  const [, err] = await catcher(fn(payload), { notify: true });
  if (!err) {
    usePresentationStore.getState().setCurrentVideoProjectionId(
      video.localPath ?? video.videoId,
    );
  }
};
```

Replace the single Project button in the JSX with three buttons:
```tsx
<div className="flex items-center gap-1 mt-auto flex-wrap">
  <Button
    variant="default"
    size="sm"
    onClick={() => void handleProject("all")}
    title={t("onlineVideos.detail.projectAll")}
    className="h-7 px-2 text-xs"
  >
    <MonitorPlay className="h-3 w-3 mr-1" />
    {t("onlineVideos.detail.projectAll")}
  </Button>
  <Button
    variant="outline"
    size="sm"
    onClick={() => void handleProject("projector")}
    title={t("onlineVideos.detail.projectProjector")}
    className="h-7 px-2 text-xs"
  >
    <Monitor className="h-3 w-3 mr-1" />
    {t("onlineVideos.detail.projectProjector")}
  </Button>
  <Button
    variant="outline"
    size="sm"
    onClick={() => void handleProject("return")}
    title={t("onlineVideos.detail.projectReturn")}
    className="h-7 px-2 text-xs"
  >
    <Tv className="h-3 w-3 mr-1" />
    {t("onlineVideos.detail.projectReturn")}
  </Button>
  {/* existing download/cancel/delete buttons */}
  ...
</div>
```

Add `MonitorPlay, Monitor, Tv` to the lucide import line.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

> If `bindings.ts` has not been regenerated yet, the `commands.setSlideOnProjector` call will fail. Use `invoke<null>` temporarily and come back after `pnpm tauri dev`.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/display.rs src-tauri/src/lib.rs \
        src/lib/tauri/display.ts src/components/online-videos/video-card.tsx
git commit -m "feat(video): add projector-only and return-only projection targets for video items"
```

---

## Task 7: Playing Now preview shows actual video content

**Goal:** The center preview in `/playing-now` currently uses `renderMode="return-current"` for all slides. For video slides, switch to a new `"playing-now-preview"` mode that renders the YouTube iframe (muted) or local video player (muted). Also ensure `video-control` events broadcast to all windows so the playing-now preview responds too.

**Files:**
- Modify: `src/components/online-videos/online-video-slide.tsx`
- Modify: `src/routes/playing-now/index.tsx`

- [ ] **Step 1: Add `"playing-now-preview"` to `OnlineVideoRenderMode` type**

In `online-video-slide.tsx`, update the type:
```ts
export type OnlineVideoRenderMode =
  | "projector"
  | "return-current"
  | "return-next"
  | "playing-now-preview"
  | "editor"
  | "thumbnail";
```

- [ ] **Step 2: Add `"playing-now-preview"` render branch**

Before the `// editor mode` comment, add:
```tsx
if (renderMode === "playing-now-preview") {
  const isLocal = slide.videoSource === "local" && !!localVideoSrc;

  return (
    <div className={cn("h-full w-full bg-black relative overflow-hidden", className)}>
      {isLocal ? (
        <LocalVideoPlayer
          src={localVideoSrc!}
          title={slide.videoTitle ?? ""}
          className="h-full w-full object-contain"
          muted
        />
      ) : slide.videoId ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${slide.videoId}?autoplay=1&controls=0&rel=0&modestbranding=1&showinfo=0&disablekb=1&iv_load_policy=3&mute=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="h-full w-full"
          style={{ border: "none", pointerEvents: "none" }}
          title={slide.videoTitle ?? slide.videoId}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
          {t("presentations.types.onlineVideo")}
        </div>
      )}
      {/* Overlay title badge */}
      <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2 pointer-events-none">
        <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/80 truncate max-w-full">
          {slide.videoTitle ?? ""}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Use `"playing-now-preview"` in playing-now index**

In `src/routes/playing-now/index.tsx`, find the center preview render:
```tsx
<SlideRenderer slide={previewSlide} renderMode="return-current" className="h-full w-full" />
```

Replace with a conditional:
```tsx
<SlideRenderer
  slide={previewSlide}
  renderMode={
    previewSlide?.slideType === "online_video" || previewSlide?.slideType === "video"
      ? "playing-now-preview"
      : "return-current"
  }
  className="h-full w-full"
/>
```

- [ ] **Step 4: Broadcast `video-control` events to all windows**

In `playing-now/index.tsx`, `handleVideoPlayPause` and `handleVideoSeek` currently call `emitTo("projector", ...)`. Change to `emit(...)` (broadcasts to all windows, including the main window's preview):

```ts
import { emit, emitTo } from "@tauri-apps/api/event";

const handleVideoPlayPause = async () => {
  const action = videoState?.paused === false ? "pause" : "play";
  // Emit to all windows: projector + playing-now preview
  await emit("video-control", { action }).catch(() => {});
};

const handleVideoSeek = async (value: number[]) => {
  if (value[0] !== undefined) {
    await emit("video-control", { action: "seek", value: value[0] }).catch(() => {});
  }
};
```

> Note: `emit` (from `@tauri-apps/api/event`) is already imported, but it broadcasts to ALL windows in the same process. The projector window `LocalVideoPlayer` already listens to `"video-control"`, so it will respond too.

- [ ] **Step 5: Emit `video-state` from playing-now preview local video**

The `LocalVideoPlayer` inside the playing-now preview will emit `video-state` to "main" via `emitTo("main", "video-state", ...)`. The playing-now screen already listens to `"video-state"` and updates `videoState`. This means both the projector and the preview emit state — the last emitter wins, which is fine (they should be in sync).

No code change needed here — the existing `LocalVideoPlayer` emit logic handles this automatically.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add src/components/online-videos/online-video-slide.tsx \
        src/routes/playing-now/index.tsx
git commit -m "feat(playing-now): show video/iframe preview and fix video-control broadcast"
```

---

## Task 8: Regenerate bindings and full TypeScript validation

After all code changes, regenerate `bindings.ts` so the new Rust commands appear as typed functions.

- [ ] **Step 1: Start dev to regenerate bindings**

```bash
pnpm tauri dev &
# Wait for "Finished dev [unoptimized + debuginfo]" then Ctrl+C
```

Or if you prefer just the specta export without the full dev server:
```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```
The specta codegen runs on any Tauri build that includes `tauri_specta::collect_commands!`.

- [ ] **Step 2: Full TypeScript check**

```bash
pnpm vite build 2>&1 | tail -10
npx tsc --noEmit 2>&1 | head -40
```
Expected: clean build.

- [ ] **Step 3: Run unit tests**

```bash
pnpm test:unit 2>&1 | tail -20
```
Expected: all pass.

- [ ] **Step 4: Run i18n lint**

```bash
pnpm lint:i18n 2>&1 | tail -20
```
Expected: no missing keys.

- [ ] **Step 5: Commit bindings update**

```bash
git add src/lib/bindings.ts
git commit -m "chore: regenerate bindings.ts with setSlideOnProjector + setSlideOnReturn"
```

---

## Verification Checklist

After all tasks:

- [ ] Clicking "Open URL" in streaming controls no longer throws permission error
- [ ] Local video slides on the projector window: no empty `src` console error on startup
- [ ] Return monitor shows local video playing (muted) when a local video is projected
- [ ] Return monitor shows YouTube thumbnail + title instead of just the text badge
- [ ] VideoCard shows a green pulsing dot + "Now playing" label on the currently projected video
- [ ] VideoCard shows three buttons: "All screens", "Projector only", "Return + streaming"
- [ ] "Projector only" projects to the projector window, does NOT update streaming viewers
- [ ] "Return + streaming" updates the return window and SSE viewers, does NOT update projector
- [ ] Playing Now center preview shows the YouTube iframe (muted) for YouTube videos
- [ ] Playing Now center preview shows the local video player (muted) for local videos
- [ ] Play/Pause/Seek in Playing Now controls the video in both projector window and playing-now preview
- [ ] `pnpm lint:i18n` passes (all 3 locales have new keys)
- [ ] `npx tsc --noEmit` passes with no errors
