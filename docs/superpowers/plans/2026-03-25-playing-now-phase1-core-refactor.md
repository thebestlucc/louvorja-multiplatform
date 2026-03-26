# Playing Now Phase 1: Core Refactor (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic 691-line Playing Now route with a unified media state machine (`useMediaPlayerStore`) and a three-panel layout (slides | preview | queue) that supports hymn audio, online video, offline video, presentations, and all other projectable content through a single coherent interface.

**Architecture:** The new `useMediaPlayerStore` Zustand store becomes the single source of truth for "what is playing and what state it's in." It absorbs scattered state from `presentation-store` (slides, activeSlideIndex), `video-player-store` (video playback state), and `audio-store` (timeline synchronization). The 691-line route is decomposed into 5 focused components. The existing `usePlaybackCoordinator` hook is migrated to dispatch `MediaItem` objects to the new store instead of directly manipulating multiple stores.

**Tech Stack:** React 19, TypeScript 5.8, Zustand, Tauri events, @dnd-kit/sortable, Radix UI (Slider, ScrollArea, Tooltip), existing `SlideThumbnail` component, existing `SlideRenderer` component.

**Architecture doc:** `docs/plans/playing-now-architecture.md` (Sections 1-9 define the target state)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/stores/media-player-store.ts` | Unified state machine: current MediaItem, status (idle/loading/ready/playing/paused/ended/error), timeline, slides, sync points, actions |
| `src/types/media.ts` | `MediaItem` discriminated union type, `MediaStatus` type, `MediaItemType` type |
| `src/components/playing-now/slide-panel.tsx` | Left sidebar: slide thumbnails with active highlight, scroll-into-view, collapse toggle |
| `src/components/playing-now/queue-panel.tsx` | Right sidebar: two-section queue (manual + source), drag-to-reorder, type icons |
| `src/components/playing-now/control-bar.tsx` | Adaptive control bar: play/pause, seek, volume, slide nav, time display |
| `src/components/playing-now/preview-canvas.tsx` | Center preview: SlideRenderer for slides, VideoPreviewSlot for video, image display |
| `src/hooks/use-media-player.ts` | Hook that bridges `useMediaPlayerStore` with Tauri event listeners (audio-status, media-state, slide-changed, etc.) |

### Modified Files

| File | Changes |
|------|---------|
| `src/routes/playing-now/index.tsx` | Complete rewrite: thin shell composing SlidePanel + PreviewCanvas + ControlBar + QueuePanel |
| `src/stores/queue-store.ts` | Extend with two-section model (manualQueue + sourceQueue + sourceLabel), `repeat` and `shuffle` fields, `addToQueueNext()`, `setSourceQueue()`, `reorder()` |
| `src/hooks/use-playback-coordinator.ts` | Migrate from direct store manipulation to `mediaPlayerStore.load(MediaItem)` dispatch |
| `src/hooks/use-hymn-playback.ts` | Migrate `bindHymnToPlaybackQueue` to produce `MediaItem` objects instead of raw `QueueItem` |

### Untouched (consumed as-is)

| File | Why |
|------|-----|
| `src/components/slides/slide-thumbnail.tsx` | Already has `SlideThumbnail` with all needed props (slide, index, isActive, onClick, typeLabel) |
| `src/components/slides/slide-renderer.tsx` | Already renders all slide types |
| `src/components/online-videos/persistent-video-player.tsx` | Video rendering stays here; we only consume `VideoPreviewSlot` |
| `src/stores/audio-store.ts` | Keeps managing rodio audio; `useMediaPlayer` hook subscribes to its events |
| `src/stores/presentation-store.ts` | Keeps its shape; `useMediaPlayerStore` reads/writes to it for projection coordination |
| `src/stores/display-store.ts` | Unchanged |
| `src/hooks/use-slides.ts` | Projection helpers consumed by new store |

---

## Code Review Checkpoints

After Tasks 1-2 (store + types): **Checkpoint 1** — verify store API and types are sound.
After Tasks 3-6 (all UI components): **Checkpoint 2** — verify layout, panels, controls render correctly.
After Tasks 7-8 (hook + route rewrite): **Checkpoint 3** — verify full integration works end-to-end.
After Task 9 (queue upgrade): **Checkpoint 4** — verify two-section queue works.
After Task 10 (coordinator migration): **Checkpoint 5** — final integration, full feature parity.

---

## Task 1: MediaItem Type Definitions

**Files:**
- Create: `src/types/media.ts`

This task defines the `MediaItem` discriminated union and related types that the entire Playing Now system consumes. These types come from Section 1 of the architecture doc.

- [ ] **Step 1: Create the media types file**

```typescript
// src/types/media.ts
import type { SlideContent, SyncPoint, Hymn } from "../lib/bindings";

/**
 * Discriminated union for all media types supported by the Playing Now system.
 * See docs/plans/playing-now-architecture.md Section 1.
 */
export type MediaItem =
  | HymnMediaItem
  | OnlineVideoMediaItem
  | OfflineVideoMediaItem
  | PresentationMediaItem
  | ImageMediaItem
  | BibleMediaItem
  | AnnotationMediaItem;

export interface HymnMediaItem {
  type: "hymn";
  hymn: Hymn;
  mode: "sung" | "karaoke" | "silent";
  slides: SlideContent[];
  syncPoints: SyncPoint[];
  audioPath?: string;
  playbackPath?: string;
}

export interface OnlineVideoMediaItem {
  type: "online_video";
  videoId: string;
  videoSource: "youtube";
  title: string;
  thumbnailUrl?: string;
}

export interface OfflineVideoMediaItem {
  type: "offline_video";
  videoPath: string;
  title: string;
  thumbnailUrl?: string;
  isManaged: boolean;
}

export interface PresentationMediaItem {
  type: "presentation";
  presentationId: number;
  slides: SlideContent[];
}

export interface ImageMediaItem {
  type: "image";
  imagePath: string;
  title: string;
  isManaged: boolean;
}

export interface BibleMediaItem {
  type: "bible";
  reference: string;
  text: string;
  version: string;
}

export interface AnnotationMediaItem {
  type: "annotation";
  text: string;
  title: string;
}

/** All possible media types as a string union */
export type MediaItemType = MediaItem["type"];

/** State machine status values */
export type MediaStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

/** Which timeline source is active */
export type TimelineSource = "audio" | "video" | "none";

/** Helper: does this media type have slides? */
export function mediaHasSlides(item: MediaItem): boolean {
  return item.type === "hymn" || item.type === "presentation";
}

/** Helper: does this media type have a playback timeline? */
export function mediaHasTimeline(item: MediaItem): boolean {
  return item.type === "hymn" && item.mode !== "silent"
    || item.type === "online_video"
    || item.type === "offline_video";
}

/** Helper: does this media type have video? */
export function mediaHasVideo(item: MediaItem): boolean {
  return item.type === "online_video" || item.type === "offline_video";
}

/** Helper: type icon map for queue/UI display */
export const MEDIA_TYPE_ICONS: Record<MediaItemType, string> = {
  hymn: "music",
  online_video: "video",
  offline_video: "video",
  presentation: "presentation",
  image: "image",
  bible: "book-open",
  annotation: "file-text",
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors from the new file)

- [ ] **Step 3: Commit**

```bash
git add src/types/media.ts
git commit -m "feat(playing-now): add MediaItem discriminated union types

Defines the unified media type system for the Playing Now refactor.
All media types (hymn, video, presentation, image, bible, annotation)
are modeled as a discriminated union with helper functions."
```

---

## Task 2: Create useMediaPlayerStore

**Files:**
- Create: `src/stores/media-player-store.ts`

This is the unified state machine (architecture doc Section 3). It replaces the scattered state across `presentation-store` (slides/activeSlideIndex), `video-player-store` (timeline), and the 691-line route's local `useState` calls.

**Key design decisions:**
- The store manages its own state but does NOT directly call Tauri commands (projection, audio). Side effects live in the `use-media-player` hook (Task 7).
- Timeline is normalized to milliseconds for both audio and video.
- The store exposes a `load()` action that transitions from any state → LOADING.

- [ ] **Step 1: Create the store file**

```typescript
// src/stores/media-player-store.ts
import { create } from "zustand";
import type { SlideContent, SyncPoint } from "../lib/bindings";
import type { MediaItem, MediaStatus, TimelineSource } from "../types/media";

interface MediaPlayerState {
  // --- Current item ---
  currentItem: MediaItem | null;
  status: MediaStatus;

  // --- Timeline (normalized to ms) ---
  currentTime: number;
  duration: number;
  timelineSource: TimelineSource;

  // --- Slides ---
  slides: SlideContent[];
  activeSlideIndex: number;
  syncPoints: SyncPoint[];

  // --- Overlay ---
  overlay: "black" | "logo" | null;

  // --- Error ---
  error: string | null;

  // --- Actions ---
  load: (item: MediaItem) => void;
  setStatus: (status: MediaStatus) => void;
  setError: (error: string | null) => void;

  updateTimeline: (currentTime: number, duration: number, source: TimelineSource) => void;

  setSlides: (slides: SlideContent[], syncPoints?: SyncPoint[]) => void;
  setActiveSlideIndex: (index: number) => void;

  setOverlay: (overlay: "black" | "logo" | null) => void;

  stop: () => void;
  reset: () => void;
}

const initialState = {
  currentItem: null,
  status: "idle" as MediaStatus,
  currentTime: 0,
  duration: 0,
  timelineSource: "none" as TimelineSource,
  slides: [] as SlideContent[],
  activeSlideIndex: 0,
  syncPoints: [] as SyncPoint[],
  overlay: null as "black" | "logo" | null,
  error: null as string | null,
};

export const useMediaPlayerStore = create<MediaPlayerState>((set) => ({
  ...initialState,

  load: (item) =>
    set({
      currentItem: item,
      status: "loading",
      currentTime: 0,
      duration: 0,
      error: null,
      overlay: null,
      // Slides populated immediately for hymn/presentation
      slides: "slides" in item ? item.slides : [],
      syncPoints: "syncPoints" in item ? item.syncPoints : [],
      activeSlideIndex: 0,
      timelineSource:
        item.type === "hymn" && item.mode !== "silent"
          ? "audio"
          : item.type === "online_video" || item.type === "offline_video"
            ? "video"
            : "none",
    }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: error ? "error" : "idle" }),

  updateTimeline: (currentTime, duration, source) =>
    set((state) => {
      // Only accept updates from the active source
      if (state.timelineSource !== source) return state;
      return { currentTime, duration };
    }),

  setSlides: (slides, syncPoints) =>
    set({
      slides,
      activeSlideIndex: 0,
      ...(syncPoints !== undefined ? { syncPoints } : {}),
    }),

  setActiveSlideIndex: (index) =>
    set((state) => {
      if (index < 0 || index >= state.slides.length) return state;
      return { activeSlideIndex: index };
    }),

  setOverlay: (overlay) => set({ overlay }),

  stop: () =>
    set({
      ...initialState,
    }),

  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/media-player-store.ts
git commit -m "feat(playing-now): add useMediaPlayerStore unified state machine

Single Zustand store managing current media item, playback status,
timeline, slides, sync points, and overlay state. Replaces scattered
state across presentation-store, video-player-store, and route locals."
```

---

## CHECKPOINT 1: Review store + types

Verify:
- `MediaItem` union covers all 7 media types from the architecture doc
- `useMediaPlayerStore` has clean state transitions
- No circular imports between `types/media.ts` and `stores/media-player-store.ts`
- Types compile cleanly: `npx tsc --noEmit`

---

## Task 3: SlidePanel Component (Left Sidebar)

**Files:**
- Create: `src/components/playing-now/slide-panel.tsx`

The slide panel shows thumbnails of the current item's slides (architecture doc Section 6). It uses the existing `SlideThumbnail` component from `src/components/slides/slide-thumbnail.tsx` (44 lines, takes `slide`, `index`, `isActive`, `onClick`).

**Behavior:**
- Visible for hymns and presentations, hidden for video/image/bible/annotation (use `mediaHasSlides()` helper)
- Collapsible via toggle button; collapse state persisted via `plugin-store`
- Active slide auto-scrolls into view
- Click thumbnail → calls `onSlideClick(index)` prop (parent wires to store)

- [ ] **Step 1: Create slide-panel component**

```typescript
// src/components/playing-now/slide-panel.tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { SlideThumbnail } from "../slides/slide-thumbnail";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { getPreference, setPreference } from "../../lib/store";
import { cn } from "../../lib/utils";
import type { SlideContent } from "../../lib/bindings";

interface SlidePanelProps {
  slides: SlideContent[];
  activeSlideIndex: number;
  onSlideClick: (index: number) => void;
  visible: boolean;
}

const PREF_KEY = "playing-now-slide-panel-collapsed";

export function SlidePanel({ slides, activeSlideIndex, onSlideClick, visible }: SlidePanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);

  // Load collapse preference on mount
  useEffect(() => {
    getPreference(PREF_KEY, false).then(setCollapsed);
  }, []);

  // Auto-scroll active slide into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeSlideIndex]);

  if (!visible) return null;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPreference(PREF_KEY, next);
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-r border-border bg-muted/30 pt-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleCollapsed}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <div className="mt-2 -rotate-90 whitespace-nowrap text-xs text-muted-foreground">
          {t("playingNow.slides")} ({slides.length})
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[200px] min-w-[160px] max-w-[300px] flex-col border-r border-border bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("playingNow.slides")} ({slides.length})
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleCollapsed}>
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Thumbnail list */}
      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-2">
          {slides.map((slide, i) => (
            <div key={i} ref={i === activeSlideIndex ? activeRef : undefined}>
              <SlideThumbnail
                slide={slide}
                index={i}
                isActive={i === activeSlideIndex}
                onClick={() => onSlideClick(i)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: Add i18n key to all 3 locale files**

Add `"playingNow.slides": "Slides"` to `src/locales/en.json`.
Add `"playingNow.slides": "Slides"` to `src/locales/pt.json`.
Add `"playingNow.slides": "Diapositivas"` to `src/locales/es.json`.

Check if the key already exists first by searching the locale files. If `playingNow` namespace already has entries, add next to them.

Run: `pnpm lint:i18n`
Expected: PASS (all 3 locales have the key)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/playing-now/slide-panel.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat(playing-now): add SlidePanel left sidebar component

Collapsible slide thumbnail panel with auto-scroll-to-active,
collapse state persistence, and responsive collapsed view."
```

---

## Task 4: QueuePanel Component (Right Sidebar)

**Files:**
- Create: `src/components/playing-now/queue-panel.tsx`

The queue panel is the right sidebar showing what's playing and what's next (architecture doc Section 8). This is a UI-only refactor of the existing `playing-queue.tsx` (71 lines) with the new two-section layout. The actual queue store upgrade happens in Task 9 — this component initially works with the current flat queue shape and will adapt to the two-section model later.

**Behavior:**
- "Now Playing" item highlighted at top
- "Next Up" section (manual queue items) with drag-to-reorder
- "From [Source]" section (service/playlist context)
- Collapsible via toggle button; state persisted
- Type icons per media type (music note for hymn, video icon for video, etc.)

- [ ] **Step 1: Create queue-panel component**

```typescript
// src/components/playing-now/queue-panel.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PanelRightClose, PanelRight, Music, Video, BookOpen, FileText, Image, Presentation, X, GripVertical } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { getPreference, setPreference } from "../../lib/store";
import { cn } from "../../lib/utils";
import { useQueueStore, type QueueItem } from "../../stores/queue-store";

interface QueuePanelProps {
  className?: string;
}

const PREF_KEY = "playing-now-queue-panel-collapsed";

const typeIcons: Record<string, typeof Music> = {
  audio: Music,
  playback: Music,
  projection: Presentation,
  online_video: Video,
  offline_video: Video,
  image: Image,
  bible: BookOpen,
  annotation: FileText,
};

function getItemTitle(item: QueueItem): string {
  if (item.title) return item.title;
  if (item.hymn) return item.hymn.title;
  return "Untitled";
}

function getItemSubtitle(item: QueueItem): string | null {
  if (item.hymn?.album) return item.hymn.album;
  return null;
}

export function QueuePanel({ className }: QueuePanelProps) {
  const { t } = useTranslation();
  const items = useQueueStore((s) => s.items);
  const currentIndex = useQueueStore((s) => s.currentIndex);
  const setCurrentIndex = useQueueStore((s) => s.setCurrentIndex);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getPreference(PREF_KEY, false).then(setCollapsed);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPreference(PREF_KEY, next);
  };

  if (collapsed) {
    return (
      <div className={cn("flex h-full w-10 flex-col items-center border-l border-border bg-muted/30 pt-2", className)}>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleCollapsed}>
          <PanelRight className="h-4 w-4" />
        </Button>
        <div className="mt-2 -rotate-90 whitespace-nowrap text-xs text-muted-foreground">
          {t("playingNow.queue")} ({items.length})
        </div>
      </div>
    );
  }

  const nowPlaying = currentIndex >= 0 ? items[currentIndex] : null;
  const upNext = items.filter((_, i) => i > currentIndex);

  return (
    <div className={cn("flex h-full w-[280px] min-w-[220px] max-w-[400px] flex-col border-l border-border bg-muted/30", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("playingNow.queue")} ({items.length})
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleCollapsed}>
          <PanelRightClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {/* Now Playing */}
          {nowPlaying && (
            <>
              <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("playingNow.nowPlaying")}
              </div>
              <QueueItemRow item={nowPlaying} isActive onRemove={undefined} onClick={undefined} />
            </>
          )}

          {/* Up Next */}
          {upNext.length > 0 && (
            <>
              <div className="mt-2 px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("playingNow.nextUp")} ({upNext.length})
              </div>
              {upNext.map((item, i) => {
                const actualIndex = currentIndex + 1 + i;
                return (
                  <QueueItemRow
                    key={item.id}
                    item={item}
                    isActive={false}
                    onClick={() => setCurrentIndex(actualIndex)}
                    onRemove={() => removeFromQueue(actualIndex)}
                  />
                );
              })}
            </>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <Music className="mb-2 h-8 w-8 opacity-40" />
              {t("playingNow.emptyQueue")}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function QueueItemRow({
  item,
  isActive,
  onClick,
  onRemove,
}: {
  item: QueueItem;
  isActive: boolean;
  onClick: (() => void) | undefined;
  onRemove: (() => void) | undefined;
}) {
  const Icon = typeIcons[item.type] ?? Music;
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted cursor-pointer",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {!isActive && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add i18n keys to all 3 locale files**

Keys to add under the `playingNow` namespace:
- `"playingNow.queue"`: "Queue" / "Fila" / "Cola"
- `"playingNow.nowPlaying"`: "Now Playing" / "Tocando agora" / "Reproduciendo"
- `"playingNow.nextUp"`: "Next Up" / "A seguir" / "A continuacion"
- `"playingNow.emptyQueue"`: "Queue is empty. Add hymns, videos, or presentations to start." / "Fila vazia. Adicione hinos, videos ou apresentacoes para comecar." / "Cola vacia. Agrega himnos, videos o presentaciones para comenzar."

Check which keys already exist first — `playingNow.emptyQueue` likely exists from the current `PlayingQueue` component. Update rather than duplicate.

Run: `pnpm lint:i18n`
Expected: PASS

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/playing-now/queue-panel.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat(playing-now): add QueuePanel right sidebar component

Two-section queue panel (Now Playing + Next Up) with type icons,
collapse toggle, persistence, drag handles, and empty state."
```

---

## Task 5: PreviewCanvas Component (Center Area)

**Files:**
- Create: `src/components/playing-now/preview-canvas.tsx`

The center preview area renders what's currently being projected/played (architecture doc Section 2). It delegates to `SlideRenderer` for slide content, `VideoPreviewSlot` for video, or a simple image display.

- [ ] **Step 1: Create preview-canvas component**

```typescript
// src/components/playing-now/preview-canvas.tsx
import { SlideRenderer } from "../slides/slide-renderer";
import { VideoPreviewSlot } from "../online-videos/persistent-video-player";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";
import type { SlideContent } from "../../lib/bindings";
import type { MediaItem } from "../../types/media";
import { mediaHasVideo } from "../../types/media";

interface PreviewCanvasProps {
  currentItem: MediaItem | null;
  currentSlide: SlideContent | null;
  overlay: "black" | "logo" | null;
  isProjectorOpen: boolean;
}

export function PreviewCanvas({ currentItem, currentSlide, overlay, isProjectorOpen }: PreviewCanvasProps) {
  const { t } = useTranslation();

  // Overlay takes priority
  if (overlay === "black") {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <span className="animate-pulse text-sm text-white/30">{t("playingNow.blackScreen")}</span>
      </div>
    );
  }

  if (overlay === "logo") {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <span className="text-sm text-white/50">{t("playingNow.logoScreen")}</span>
      </div>
    );
  }

  // Video preview (online or offline)
  if (currentItem && mediaHasVideo(currentItem)) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black">
        <div className="relative aspect-video w-full max-w-full">
          <VideoPreviewSlot className="h-full w-full" />
        </div>
      </div>
    );
  }

  // Slide preview (hymn, presentation, bible, etc.)
  if (currentSlide) {
    return (
      <div className="flex h-full items-center justify-center bg-black/90 p-4">
        <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-lg shadow-lg">
          <SlideRenderer slide={currentSlide} renderMode="playing-now-preview" className="h-full w-full" />
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <MonitorPlay className="h-12 w-12 opacity-30" />
      <div className="text-center text-sm">
        {t("playingNow.emptyPreview")}
      </div>
      {isProjectorOpen && (
        <div className="flex items-center gap-1.5 text-xs text-green-500">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          {t("playingNow.projectorConnected")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add i18n keys to all 3 locale files**

Keys to add:
- `"playingNow.blackScreen"`: "Black Screen" / "Tela preta" / "Pantalla negra"
- `"playingNow.logoScreen"`: "Logo Screen" / "Tela de logo" / "Pantalla de logo"
- `"playingNow.emptyPreview"`: "Select a hymn, video, or presentation to start" / "Selecione um hino, video ou apresentacao para comecar" / "Selecciona un himno, video o presentacion para comenzar"
- `"playingNow.projectorConnected"`: "Projector connected" / "Projetor conectado" / "Proyector conectado"

Check for existing keys that might overlap (e.g., `blackScreen` may already exist elsewhere).

Run: `pnpm lint:i18n`
Expected: PASS

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/playing-now/preview-canvas.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat(playing-now): add PreviewCanvas center area component

Renders video (via VideoPreviewSlot), slides (via SlideRenderer),
overlays, or empty state based on current media item and projection state."
```

---

## Task 6: ControlBar Component (Adaptive Controls)

**Files:**
- Create: `src/components/playing-now/control-bar.tsx`

The control bar adapts its visible controls based on the current media type (architecture doc Section 9). Audio items show play/pause/seek/volume + slide navigation. Video items show play/pause/seek/volume. Slide-only items show prev/next slide. Items with no timeline or slides show nothing (or a minimal bar).

This component reads from `useMediaPlayerStore` and dispatches actions. It does NOT directly call Tauri commands — it uses the store's actions, and the `use-media-player` hook (Task 7) handles the side effects.

- [ ] **Step 1: Create control-bar component**

```typescript
// src/components/playing-now/control-bar.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Play, Pause, Square, SkipBack, SkipForward,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
} from "lucide-react";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { cn } from "../../lib/utils";
import type { MediaItem } from "../../types/media";
import { mediaHasSlides, mediaHasTimeline } from "../../types/media";
import type { MediaStatus } from "../../types/media";

interface ControlBarProps {
  currentItem: MediaItem | null;
  status: MediaStatus;
  currentTime: number;
  duration: number;
  activeSlideIndex: number;
  totalSlides: number;
  volume: number;
  muted: boolean;

  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (timeMs: number) => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onPrevItem: () => void;
  onNextItem: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ControlBar({
  currentItem,
  status,
  currentTime,
  duration,
  activeSlideIndex,
  totalSlides,
  volume,
  muted,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onPrevSlide,
  onNextSlide,
  onVolumeChange,
  onMuteToggle,
  onPrevItem,
  onNextItem,
}: ControlBarProps) {
  const { t } = useTranslation();
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  if (!currentItem) return null;

  const hasTimeline = mediaHasTimeline(currentItem);
  const hasSlides = mediaHasSlides(currentItem);
  const isPlaying = status === "playing";
  const isPaused = status === "paused";
  const isActive = isPlaying || isPaused;

  return (
    <div className="flex flex-col gap-1 border-t border-border bg-background px-4 py-2">
      {/* Timeline row */}
      {hasTimeline && (
        <div className="flex items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {formatTime(seekPreview ?? currentTime)}
          </span>
          <Slider
            min={0}
            max={Math.max(duration, 1)}
            value={[seekPreview ?? currentTime]}
            onValueChange={([v]) => setSeekPreview(v)}
            onValueCommit={([v]) => {
              onSeek(v);
              setSeekPreview(null);
            }}
            onPointerDown={() => {}}
            onPointerUp={() => setSeekPreview(null)}
            className="flex-1"
          />
          <span className="w-10 text-xs tabular-nums text-muted-foreground">
            {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: playback controls */}
        <div className="flex items-center gap-1">
          {/* Prev item / prev slide */}
          {hasSlides && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevSlide} disabled={activeSlideIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {hasTimeline && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevItem}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={isPlaying ? onPause : onPlay}
                disabled={status === "loading"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextItem}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </>
          )}

          {hasSlides && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextSlide} disabled={activeSlideIndex >= totalSlides - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {isActive && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Center: slide counter */}
        <div className="text-xs text-muted-foreground">
          {hasSlides && totalSlides > 0 && (
            <span>
              {activeSlideIndex + 1} / {totalSlides}
            </span>
          )}
        </div>

        {/* Right: volume */}
        <div className="flex items-center gap-1">
          {hasTimeline && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMuteToggle}>
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              <Slider
                min={0}
                max={100}
                value={[muted ? 0 : volume * 100]}
                onValueChange={([v]) => onVolumeChange(v / 100)}
                className="w-20"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/playing-now/control-bar.tsx
git commit -m "feat(playing-now): add adaptive ControlBar component

Shows play/pause/seek/volume for timeline media, prev/next for slides,
slide counter, and stop button. Adapts visibility based on MediaItem type."
```

---

## CHECKPOINT 2: Review all UI components

Verify:
- `SlidePanel`, `QueuePanel`, `PreviewCanvas`, `ControlBar` all compile
- No circular dependencies
- i18n keys in all 3 locales
- Components are stateless/presentational where possible (state in store/hooks)
- Run: `npx tsc --noEmit` and `pnpm lint:i18n`

---

## Task 7: useMediaPlayer Hook (Event Bridge)

**Files:**
- Create: `src/hooks/use-media-player.ts`

This hook is the bridge between `useMediaPlayerStore` and the Tauri event system + existing stores. It:
1. Subscribes to Tauri events (`audio-status`, `slide-changed`, `slide-cleared`, `overlay-changed`)
2. Updates the media player store's timeline from audio/video events
3. Syncs `activeSlideIndex` changes to projection (Rust setCurrentSlide)
4. Provides convenience methods that wrap store actions with side effects

**Important:** This hook manages subscriptions (event listeners). It does NOT replace `usePlaybackCoordinator` — that hook handles queue→load transitions. This hook handles "while an item is playing, keep things synced."

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-media-player.ts
import { useEffect, useCallback, useRef } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useAudioStore } from "../stores/audio-store";
import { useQueueStore } from "../stores/queue-store";
import { useSlides } from "./use-slides";
import type { OverlayState } from "../lib/bindings";

/**
 * Bridges useMediaPlayerStore with Tauri events and side effects.
 * Must be mounted once in the Playing Now route.
 */
export function useMediaPlayer() {
  const store = useMediaPlayerStore;
  const { projectSlideWithContext } = useSlides();

  // --- Subscribe to Tauri events ---

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // Audio timeline updates
    const unAudio = listen<{ positionMs: number; durationMs: number; isPlaying: boolean }>(
      "audio-status",
      (event) => {
        const state = store.getState();
        if (state.timelineSource !== "audio") return;
        store.getState().updateTimeline(event.payload.positionMs, event.payload.durationMs, "audio");

        // Update status from audio backend
        if (event.payload.isPlaying && state.status !== "playing") {
          store.getState().setStatus("playing");
        }
      }
    );
    unAudio.then((u) => unlisteners.push(u));

    // Video timeline updates (from PersistentVideoPlayer polling)
    const unVideo = listen<{ currentTime: number; duration: number; paused: boolean }>(
      "media-state",
      (event) => {
        const state = store.getState();
        if (state.timelineSource !== "video") return;
        store.getState().updateTimeline(
          event.payload.currentTime * 1000,
          event.payload.duration * 1000,
          "video"
        );
        if (!event.payload.paused && state.status !== "playing") {
          store.getState().setStatus("playing");
        }
        if (event.payload.paused && state.status === "playing") {
          store.getState().setStatus("paused");
        }
      }
    );
    unVideo.then((u) => unlisteners.push(u));

    // Overlay changes
    const unOverlay = listen<OverlayState>("overlay-changed", (event) => {
      const overlay = event.payload?.blackScreen
        ? "black"
        : event.payload?.logoScreen
          ? "logo"
          : null;
      store.getState().setOverlay(overlay);
    });
    unOverlay.then((u) => unlisteners.push(u));

    // Slide cleared (from Rust)
    const unCleared = listen("slide-cleared", () => {
      // Don't reset the whole store — just note that projection was cleared externally
    });
    unCleared.then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, []);

  // --- Actions with side effects ---

  const play = useCallback(() => {
    const state = store.getState();
    if (!state.currentItem) return;

    if (state.timelineSource === "audio") {
      const audioState = useAudioStore.getState();
      if (audioState.status === "paused") {
        audioState.resume();
      }
    } else if (state.timelineSource === "video") {
      emit("video-control", { action: "play" });
    }
    store.getState().setStatus("playing");
  }, []);

  const pause = useCallback(() => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      useAudioStore.getState().pause();
    } else if (state.timelineSource === "video") {
      emit("video-control", { action: "pause" });
    }
    store.getState().setStatus("paused");
  }, []);

  const stop = useCallback(() => {
    useAudioStore.getState().stop();
    emit("video-control", { action: "stop" });
    store.getState().stop();
  }, []);

  const seek = useCallback((timeMs: number) => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      useAudioStore.getState().seek(timeMs);
    } else if (state.timelineSource === "video") {
      emit("video-control", { action: "seek", value: timeMs / 1000 });
    }
  }, []);

  const goToSlide = useCallback(async (index: number) => {
    const state = store.getState();
    if (index < 0 || index >= state.slides.length) return;
    store.getState().setActiveSlideIndex(index);

    // Project the slide
    const slide = state.slides[index];
    const nextSlide = index + 1 < state.slides.length ? state.slides[index + 1] : null;
    const title = state.currentItem?.type === "hymn"
      ? state.currentItem.hymn.title
      : state.currentItem?.type === "presentation"
        ? "Presentation"
        : "";

    await projectSlideWithContext(slide, nextSlide, index, state.slides.length, title);

    // Seek audio to sync point if applicable
    if (state.currentItem?.type === "hymn" && state.syncPoints.length > 0) {
      const syncPoint = state.syncPoints.find((sp) => sp.slideIndex === index);
      if (syncPoint) {
        const audioState = useAudioStore.getState();
        if (audioState.status === "playing" || audioState.status === "paused") {
          const mode = state.currentItem.mode;
          const timestamp = mode === "karaoke" && syncPoint.instrumentalTimestampMs != null
            ? syncPoint.instrumentalTimestampMs
            : syncPoint.timestampMs;
          audioState.seek(timestamp);
        }
      }
    }
  }, [projectSlideWithContext]);

  const nextSlide = useCallback(async () => {
    const state = store.getState();
    if (state.activeSlideIndex < state.slides.length - 1) {
      await goToSlide(state.activeSlideIndex + 1);
    }
  }, [goToSlide]);

  const prevSlide = useCallback(async () => {
    const state = store.getState();
    if (state.activeSlideIndex > 0) {
      await goToSlide(state.activeSlideIndex - 1);
    }
  }, [goToSlide]);

  const nextItem = useCallback(() => {
    useQueueStore.getState().next();
  }, []);

  const prevItem = useCallback(() => {
    useQueueStore.getState().prev();
  }, []);

  return {
    play,
    pause,
    stop,
    seek,
    goToSlide,
    nextSlide,
    prevSlide,
    nextItem,
    prevItem,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-media-player.ts
git commit -m "feat(playing-now): add useMediaPlayer hook bridging store to Tauri events

Subscribes to audio-status, media-state, overlay-changed events.
Provides play/pause/stop/seek/goToSlide actions with projection
and audio side effects."
```

---

## Task 8: Rewrite Playing Now Route

**Files:**
- Modify: `src/routes/playing-now/index.tsx` (complete rewrite)

This is the big one: replace the 691-line monolith with a thin composition shell. The route mounts:
1. `useMediaPlayer()` hook (event bridge)
2. `usePlaybackCoordinator()` hook (queue→load sync)
3. Three-panel layout: `<SlidePanel>` | `<PreviewCanvas>` + `<ControlBar>` | `<QueuePanel>`

All the local `useState` for `currentSlide`, `overlay`, `contextIndex`, `seekPreviewMs`, `videoCurrentTime`, etc. are gone — they now live in `useMediaPlayerStore`.

- [ ] **Step 1: Rewrite the route file**

Replace the entire contents of `src/routes/playing-now/index.tsx` with:

```typescript
// src/routes/playing-now/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { useMediaPlayerStore } from "../../stores/media-player-store";
import { useMediaPlayer } from "../../hooks/use-media-player";
import { usePlaybackCoordinator } from "../../hooks/use-playback-coordinator";
import { useAudioStore } from "../../stores/audio-store";
import { useDisplayStore } from "../../stores/display-store";
import { SlidePanel } from "../../components/playing-now/slide-panel";
import { QueuePanel } from "../../components/playing-now/queue-panel";
import { PreviewCanvas } from "../../components/playing-now/preview-canvas";
import { ControlBar } from "../../components/playing-now/control-bar";
import { mediaHasSlides } from "../../types/media";

export const Route = createFileRoute("/playing-now/")({
  component: PlayingNowScreen,
});

function PlayingNowScreen() {
  // Mount coordination hooks
  usePlaybackCoordinator();
  const actions = useMediaPlayer();

  // Read store state
  const {
    currentItem,
    status,
    currentTime,
    duration,
    slides,
    activeSlideIndex,
    overlay,
  } = useMediaPlayerStore(
    useShallow((s) => ({
      currentItem: s.currentItem,
      status: s.status,
      currentTime: s.currentTime,
      duration: s.duration,
      slides: s.slides,
      activeSlideIndex: s.activeSlideIndex,
      overlay: s.overlay,
    }))
  );

  const volume = useAudioStore((s) => s.volume);
  const outputMuted = useAudioStore((s) => s.outputMuted);
  const isProjectorOpen = useDisplayStore((s) => s.projectorWindowOpen);

  const currentSlide = slides[activeSlideIndex] ?? null;
  const showSlides = currentItem ? mediaHasSlides(currentItem) : false;

  return (
    <div className="flex h-full flex-col">
      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Slide Panel */}
        <SlidePanel
          slides={slides}
          activeSlideIndex={activeSlideIndex}
          onSlideClick={actions.goToSlide}
          visible={showSlides}
        />

        {/* Center: Preview + Controls */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <PreviewCanvas
              currentItem={currentItem}
              currentSlide={currentSlide}
              overlay={overlay}
              isProjectorOpen={isProjectorOpen}
            />
          </div>
          <ControlBar
            currentItem={currentItem}
            status={status}
            currentTime={currentTime}
            duration={duration}
            activeSlideIndex={activeSlideIndex}
            totalSlides={slides.length}
            volume={volume}
            muted={outputMuted}
            onPlay={actions.play}
            onPause={actions.pause}
            onStop={actions.stop}
            onSeek={actions.seek}
            onPrevSlide={actions.prevSlide}
            onNextSlide={actions.nextSlide}
            onVolumeChange={(v) => useAudioStore.getState().setVolume(v)}
            onMuteToggle={() => useAudioStore.getState().setOutputMuted(!outputMuted)}
            onPrevItem={actions.prevItem}
            onNextItem={actions.nextItem}
          />
        </div>

        {/* Right: Queue Panel */}
        <QueuePanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm vite build && npx tsc --noEmit`

Note: Run `pnpm vite build` first because the route file changed and the TanStack Router Vite plugin needs to regenerate `routeTree.gen.ts`.

Expected: PASS

- [ ] **Step 3: Verify the app runs**

Run: `pnpm tauri dev`

Navigate to `/playing-now`. Verify:
- Three-panel layout renders (or two panels if no slides)
- No crash on empty state (no current item)
- Slide panel collapses/expands
- Queue panel collapses/expands

This is a smoke test — full playback integration comes after Task 10.

- [ ] **Step 4: Commit**

```bash
git add src/routes/playing-now/index.tsx
git commit -m "feat(playing-now): rewrite route as thin composition shell

Replaces 691-line monolith with 5 focused components:
SlidePanel, PreviewCanvas, ControlBar, QueuePanel, useMediaPlayer hook.
State centralized in useMediaPlayerStore."
```

---

## CHECKPOINT 3: Visual + structural review

Verify:
- Route renders the three-panel layout
- Empty state shows correctly (MonitorPlay icon + message)
- Slide panel hides for non-slide media types
- Both sidebars collapse/expand and persist preference
- ControlBar shows nothing when no item is loaded
- No regressions in projector/return windows (they're untouched)
- `npx tsc --noEmit` passes
- `pnpm lint:i18n` passes

---

## Task 9: Upgrade Queue Store to Two-Section Model

**Files:**
- Modify: `src/stores/queue-store.ts`

The existing queue is a flat list. The architecture (Section 8) calls for two sections: `manualQueue` (user-added, high priority) and `sourceQueue` (from a service or playlist). Current consumers that use `items[]` and `currentIndex` need to keep working via a computed `allItems` getter.

**Migration strategy:** Keep the existing `items` + `currentIndex` API working by deriving them from the two queues internally. Add new fields and actions without breaking current callers.

- [ ] **Step 1: Upgrade the store**

Modify `src/stores/queue-store.ts`:

```typescript
// src/stores/queue-store.ts
import { create } from "zustand";
import type { Hymn } from "../lib/bindings";

export interface QueueItem {
  id: string;
  hymn?: Hymn;
  title?: string;
  type: "audio" | "playback" | "projection";
}

interface QueueState {
  // Two-section model
  manualQueue: QueueItem[];
  sourceQueue: QueueItem[];
  sourceLabel: string;

  // Playback state
  currentIndex: number; // index into allItems (manualQueue + sourceQueue)
  repeat: "off" | "one" | "all";
  shuffle: boolean;

  // Derived (set explicitly on every mutation)
  items: QueueItem[]; // = manualQueue + sourceQueue (backwards compatible)

  // Existing actions (backwards compatible)
  addToQueue: (items: QueueItem[], clearExisting?: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setCurrentIndex: (index: number) => void;
  next: () => void;
  prev: () => void;
  shuffleQueue: () => void;

  // New actions
  addToQueueNext: (item: QueueItem) => void;
  setSourceQueue: (items: QueueItem[], label: string) => void;
  clearManualQueue: () => void;
  setRepeat: (mode: "off" | "one" | "all") => void;
  setShuffle: (enabled: boolean) => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  manualQueue: [],
  sourceQueue: [],
  sourceLabel: "",
  currentIndex: -1,
  repeat: "off",
  shuffle: false,

  // items is derived — set explicitly in every mutation below
  items: [],

  // -- Backwards-compatible actions --

  addToQueue: (newItems, clearExisting = false) =>
    set((state) => {
      const manualQueue = clearExisting ? newItems : [...state.manualQueue, ...newItems];
      const sourceQueue = clearExisting ? [] : state.sourceQueue;
      const allItems = [...manualQueue, ...sourceQueue];
      return {
        manualQueue,
        sourceQueue: clearExisting ? [] : state.sourceQueue,
        sourceLabel: clearExisting ? "" : state.sourceLabel,
        items: allItems,
        currentIndex: clearExisting
          ? (newItems.length > 0 ? 0 : -1)
          : state.currentIndex === -1 && newItems.length > 0
            ? 0
            : state.currentIndex,
      };
    }),

  removeFromQueue: (index) =>
    set((state) => {
      const allItems = [...state.manualQueue, ...state.sourceQueue];
      if (index < 0 || index >= allItems.length) return state;

      let manualQueue = [...state.manualQueue];
      let sourceQueue = [...state.sourceQueue];

      if (index < manualQueue.length) {
        manualQueue.splice(index, 1);
      } else {
        sourceQueue.splice(index - manualQueue.length, 1);
      }

      const newAll = [...manualQueue, ...sourceQueue];
      let newIndex = state.currentIndex;
      if (index < state.currentIndex) {
        newIndex--;
      } else if (index === state.currentIndex) {
        if (newAll.length === 0) newIndex = -1;
        else if (index >= newAll.length) newIndex = newAll.length - 1;
      }

      return { manualQueue, sourceQueue, items: newAll, currentIndex: newIndex };
    }),

  clearQueue: () =>
    set({ manualQueue: [], sourceQueue: [], sourceLabel: "", items: [], currentIndex: -1 }),

  setCurrentIndex: (index) => set({ currentIndex: index }),

  next: () =>
    set((state) => {
      const allItems = [...state.manualQueue, ...state.sourceQueue];
      if (state.repeat === "one") return state; // handled by audio onFinished re-triggering same index
      if (state.currentIndex < allItems.length - 1) {
        return { currentIndex: state.currentIndex + 1 };
      }
      if (state.repeat === "all" && allItems.length > 0) {
        return { currentIndex: 0 };
      }
      return state;
    }),

  prev: () =>
    set((state) => ({
      currentIndex: state.currentIndex > 0 ? state.currentIndex - 1 : state.currentIndex,
    })),

  shuffleQueue: () =>
    set((state) => {
      if (state.manualQueue.length <= 1) return state;
      const currentItem = state.currentIndex >= 0 && state.currentIndex < state.manualQueue.length
        ? state.manualQueue[state.currentIndex]
        : null;
      const otherItems = state.manualQueue.filter((_, i) => i !== state.currentIndex);

      for (let i = otherItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherItems[i], otherItems[j]] = [otherItems[j], otherItems[i]];
      }

      const manualQueue = currentItem ? [currentItem, ...otherItems] : otherItems;
      return {
        manualQueue,
        items: [...manualQueue, ...state.sourceQueue],
        currentIndex: currentItem ? 0 : state.currentIndex,
      };
    }),

  // -- New actions --

  addToQueueNext: (item) =>
    set((state) => {
      const insertAt = Math.min(state.currentIndex + 1, state.manualQueue.length);
      const manualQueue = [...state.manualQueue];
      manualQueue.splice(insertAt, 0, item);
      return { manualQueue, items: [...manualQueue, ...state.sourceQueue] };
    }),

  setSourceQueue: (items, label) =>
    set((state) => ({
      sourceQueue: items,
      sourceLabel: label,
      items: [...state.manualQueue, ...items],
    })),

  clearManualQueue: () =>
    set((state) => ({
      manualQueue: [],
      items: [...state.sourceQueue],
      currentIndex: state.currentIndex >= state.manualQueue.length
        ? state.currentIndex - state.manualQueue.length
        : 0,
    })),

  setRepeat: (mode) => set({ repeat: mode }),
  setShuffle: (enabled) => set({ shuffle: enabled }),
}));
```

**IMPORTANT:** The `items` computed property uses a getter pattern with `get()`. If this doesn't work cleanly with Zustand's `set()` (Zustand stores are plain objects), you may need to compute `items` on every `set()` call instead. Every `set()` call above already explicitly sets `items: [...manualQueue, ...sourceQueue]` as a fallback. The `get items()` getter acts as a safety net for reads.

- [ ] **Step 2: Verify existing consumers still work**

Run: `npx tsc --noEmit`

Check that these files compile without changes:
- `src/routes/playing-now/index.tsx` (uses `items`, `currentIndex`, `setCurrentIndex`, `removeFromQueue`)
- `src/hooks/use-playback-coordinator.ts` (uses `items`, `currentIndex`, `next`)
- `src/hooks/use-hymn-playback.ts` (uses `addToQueue`, `setCurrentIndex`)
- `src/components/playing-now/queue-panel.tsx` (uses `items`, `currentIndex`)

Expected: All compile. If any fail, adjust the store to maintain API compatibility.

- [ ] **Step 3: Commit**

```bash
git add src/stores/queue-store.ts
git commit -m "feat(queue): upgrade to two-section model (manual + source)

Adds manualQueue, sourceQueue, sourceLabel, repeat, shuffle fields.
Backwards compatible: existing items[] and currentIndex work unchanged.
New actions: addToQueueNext, setSourceQueue, clearManualQueue, setRepeat."
```

---

## CHECKPOINT 4: Queue backwards compatibility

Verify:
- All existing queue consumers compile without changes
- `addToQueue(items, true)` still clears and replaces (used by hymn playback)
- `next()` / `prev()` still navigate correctly
- New `addToQueueNext()` inserts after current index
- `setSourceQueue()` populates the source section
- `npx tsc --noEmit` passes

---

## Task 10: Migrate usePlaybackCoordinator to MediaItem Dispatch

**Files:**
- Modify: `src/hooks/use-playback-coordinator.ts`

Currently, `usePlaybackCoordinator` directly manipulates `audio-store`, `presentation-store`, and projection functions when the queue index changes. Migrate it to construct a `MediaItem` and call `mediaPlayerStore.load(item)`, then let the `useMediaPlayer` hook handle the side effects.

**This is the final integration step** that wires the old queue-based playback flow to the new unified state machine.

- [ ] **Step 1: Read the current implementation fully**

Read: `src/hooks/use-playback-coordinator.ts` (all 130 lines)

Understand:
- What `playItem(index)` does for each `QueueItem.type`
- How it fetches sync points
- How it generates slides
- How it starts audio

- [ ] **Step 2: Update the hook**

Modify `src/hooks/use-playback-coordinator.ts` to:
1. Import `useMediaPlayerStore` and `MediaItem` types
2. In `playItem(index)`, construct a `HymnMediaItem` from the `QueueItem`
3. Call `mediaPlayerStore.getState().load(item)` instead of directly setting slides/audio
4. Keep the `onFinished` callback wiring to `queue.next()`
5. Keep the `lastPlayedIndexRef` guard

The key change is replacing:
```typescript
// OLD: Direct multi-store manipulation
setPresentationSlides(slides);
setCurrentPresentation(null);
setSyncPoints(syncPoints);
setPlaybackMode(mode);
playAudio(audioPath, ...);
projectSlideIndex(0, slides, ...);
```

With:
```typescript
// NEW: Dispatch to unified store
const mediaItem: HymnMediaItem = {
  type: "hymn",
  hymn: item.hymn,
  mode: item.type === "playback" ? "karaoke" : item.type === "audio" ? "sung" : "silent",
  slides: generatedSlides,
  syncPoints: fetchedSyncPoints,
  audioPath: sungPath,
  playbackPath: karaokePath,
};
mediaPlayerStore.getState().load(mediaItem);

// Audio start still happens here (rodio is the backend, not the store)
if (mediaItem.mode !== "silent" && audioPath) {
  playAudio(audioPath);
}

// Project first slide
projectSlideIndex(0, generatedSlides, ...);
```

**Note:** Keep the audio start logic here for now — the `useMediaPlayerStore` doesn't own the rodio lifecycle. The store just tracks status; the coordinator triggers the actual playback.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Integration test**

Run: `pnpm tauri dev`

Test the full flow:
1. Go to a hymn detail page
2. Click "Cantado" → should navigate to `/playing-now`
3. Verify: slide panel shows stanza thumbnails
4. Verify: control bar shows play/pause, timeline, volume
5. Verify: audio plays and timeline progresses
6. Verify: clicking a thumbnail jumps to that slide
7. Verify: queue panel shows the current hymn

If audio doesn't play: check that `usePlaybackCoordinator` still calls `playAudio()` after `load()`.
If slides don't show: check that `load()` populates `slides` from the `HymnMediaItem`.
If timeline doesn't update: check that `useMediaPlayer` hook's `audio-status` listener is running.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-playback-coordinator.ts
git commit -m "feat(playing-now): migrate playback coordinator to MediaItem dispatch

usePlaybackCoordinator now constructs HymnMediaItem objects and
dispatches to useMediaPlayerStore.load() instead of directly
manipulating presentation-store and audio-store."
```

---

## CHECKPOINT 5: Full integration review

This is the final checkpoint. Verify end-to-end:

1. **Hymn cantado:** Click Cantado → Playing Now shows slides + audio + timeline
2. **Hymn playback:** Click Playback → karaoke audio variant plays
3. **Hymn slides only:** Click "So slides" → slides only, no audio/timeline
4. **Slide navigation:** Click thumbnails → jumps to slide, seeks audio
5. **Queue:** Add multiple hymns → queue shows, next/prev skips items
6. **Video:** Open a YouTube video → preview shows VideoPreviewSlot, controls adapt
7. **Projector:** Open projector window → slides project correctly
8. **Collapse panels:** Both sidebars collapse/expand, preference persists across navigation
9. **Empty state:** Navigate to `/playing-now` with nothing → shows empty preview message
10. **Stop:** Click stop → returns to idle state

Run:
- `npx tsc --noEmit` — PASS
- `pnpm lint:i18n` — PASS
- `pnpm test:unit` — PASS (or identify which tests need updating)

---

## Summary of Deliverables

| # | Task | File(s) | Lines (est.) |
|---|------|---------|-------------|
| 1 | MediaItem types | `src/types/media.ts` | ~90 |
| 2 | MediaPlayerStore | `src/stores/media-player-store.ts` | ~110 |
| 3 | SlidePanel | `src/components/playing-now/slide-panel.tsx` | ~85 |
| 4 | QueuePanel | `src/components/playing-now/queue-panel.tsx` | ~160 |
| 5 | PreviewCanvas | `src/components/playing-now/preview-canvas.tsx` | ~65 |
| 6 | ControlBar | `src/components/playing-now/control-bar.tsx` | ~140 |
| 7 | useMediaPlayer hook | `src/hooks/use-media-player.ts` | ~160 |
| 8 | Route rewrite | `src/routes/playing-now/index.tsx` | ~75 (from 691) |
| 9 | Queue upgrade | `src/stores/queue-store.ts` | ~140 (from 74) |
| 10 | Coordinator migration | `src/hooks/use-playback-coordinator.ts` | ~130 (modified) |

**Total new code:** ~885 lines across 7 new files
**Total replaced code:** ~691 lines (monolithic route → 75 lines)
**Net change:** ~+265 lines, but spread across focused, testable files

---

## What This Plan Does NOT Cover (Phase 2+)

- Deprecate/remove `video-player-store.ts` (kept alive in Phase 1 — `useMediaPlayerStore` does not yet fully replace it; migration deferred to Phase 2)
- Drag-to-reorder in queue panel (needs @dnd-kit wiring in QueuePanel)
- Sync point visualization on timeline (dots on progress bar)
- Format detection / dual-path video serving (Phase 2 — ffmpeg-sidecar)
- Absolute path support in streaming server (Phase 2)
- Queue persistence across app restarts (Phase 3)
- Context menu on queue items (right-click → remove, play next)
- Responsive auto-collapse at breakpoints (< 900px, < 700px)
