# Playing Now: System Design Architecture

*Generated: 2026-03-25 | Sources: 30+ | Confidence: High*

## Executive Summary

This document defines the architecture for the refactored "Playing Now" screen — the central media hub of LouvorJA. It unifies audio playback (hymns/collections with synchronized lyrics), online video (YouTube), offline video (local files via streaming server), image display, and slide-based presentations into a single coherent experience. The design serves 4 consumers: Playing Now route, Projector window, Return monitor, and Streaming (SSE) clients.

**Key decisions:**
- **Local video**: Dual-path serving — direct HTTP range for MP4/WebM, ffmpeg-sidecar remux/transcode for other formats (MKV/AVI/WMV/FLV)
- **Online video**: YouTube IFrame API via `youtube-nocookie.com` (current approach, proven)
- **State management**: Zustand media state machine + Tauri event broadcast (no XState — keeps existing patterns)
- **UI library**: Vidstack for unified video controls (optional); custom controls built on existing Radix primitives (pragmatic)
- **Queue**: Spotify-style right sidebar with two-section model (manual queue + source context)
- **Slides**: Left sidebar with @dnd-kit sortable thumbnails (already a dependency)

---

## Table of Contents

1. [Media Types & Content Model](#1-media-types--content-model)
2. [Layout Architecture](#2-layout-architecture)
3. [Media State Machine](#3-media-state-machine)
4. [Video Subsystem](#4-video-subsystem)
5. [Audio Subsystem](#5-audio-subsystem)
6. [Slide Subsystem](#6-slide-subsystem)
7. [Multi-Consumer Broadcasting](#7-multi-consumer-broadcasting)
8. [Queue System](#8-queue-system)
9. [Control Bar](#9-control-bar)
10. [Streaming Server Evolution](#10-streaming-server-evolution)
11. [Migration Strategy](#11-migration-strategy)
12. [Technology Decisions](#12-technology-decisions)

---

## 1. Media Types & Content Model

### Unified Media Item

Every item in the Playing Now system is a `MediaItem` — a discriminated union that the state machine processes uniformly:

```typescript
type MediaItem =
  | { type: "hymn"; hymnId: number; mode: "sung" | "karaoke" | "silent"; slides: SlideContent[]; syncPoints: SyncPoint[]; audioPath?: string }
  | { type: "online_video"; videoId: string; videoSource: "youtube"; title: string; thumbnailUrl?: string }
  | { type: "offline_video"; videoPath: string; title: string; thumbnailUrl?: string; isManaged: boolean }
  | { type: "presentation"; presentationId: number; slides: SlideContent[] }
  | { type: "image"; imagePath: string; title: string; isManaged: boolean }
  | { type: "bible"; reference: string; text: string; version: string }
  | { type: "annotation"; text: string; title: string }
```

**Path contracts:**
- `isManaged: true` → relative path under `app_data_dir` (e.g., `media/videos/youtube/abc.mp4`)
- `isManaged: false` → absolute path anywhere on disk (e.g., `/Users/foo/Movies/sermon.mp4`)
- Both resolve through the streaming server for playback

### Content Capabilities Matrix

| Media Type | Has Slides | Has Timeline | Has Audio | Has Video | Projectable |
|-----------|-----------|-------------|----------|----------|------------|
| Hymn (sung/karaoke) | Yes (stanzas) | Yes (sync points) | Yes (rodio) | No | Yes |
| Hymn (silent) | Yes (stanzas) | No | No | No | Yes |
| Online Video | No | Yes (video duration) | Yes (embedded) | Yes (iframe) | Yes |
| Offline Video | No | Yes (video duration) | Yes (embedded) | Yes (streaming) | Yes |
| Presentation | Yes (custom slides) | No (manual advance) | No | No | Yes |
| Image | No | No | No | No | Yes |
| Bible | No | No | No | No | Yes |
| Annotation | No | No | No | No | Yes |

---

## 2. Layout Architecture

### Three-Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                          Header Bar                              │
├──────────┬────────────────────────────────────┬─────────────────┤
│          │                                    │                 │
│  Slide   │         Main Preview Area          │    Playing      │
│  Panel   │                                    │    Queue        │
│          │   ┌────────────────────────────┐   │                 │
│  Thumb 1 │   │                            │   │  Now Playing    │
│  ------  │   │    Video / Slide / Image   │   │  ───────────   │
│  Thumb 2 │   │       Preview Canvas       │   │  ▶ Hymn A      │
│  ------  │   │                            │   │                 │
│  Thumb 3 │   │                            │   │  Next Up        │
│  ------  │   └────────────────────────────┘   │  ───────────   │
│  Thumb 4 │                                    │  • Hymn B       │
│  ------  │   ┌────────────────────────────┐   │  • Video C      │
│  Thumb 5 │   │  ◀◀  ▶/❚❚  ▶▶  ████░░  🔊 │   │  • Hymn D       │
│          │   └────────────────────────────┘   │                 │
│          │         Control Bar                │  From Service   │
│          │                                    │  ───────────   │
│          │                                    │  • Hymn E       │
│          │                                    │  • Bible F      │
├──────────┴────────────────────────────────────┴─────────────────┤
│                          Status Bar                              │
└─────────────────────────────────────────────────────────────────┘
```

### Panel Behavior

| Panel | Width | Collapsible | Content |
|-------|-------|-------------|---------|
| Slide Panel (left) | 200px default, 160–300px resizable | Yes (toggle icon) | Thumbnails of current item's slides. Hidden when media has no slides (video, image, bible). |
| Main Preview (center) | Flex fill | No | Aspect-ratio-locked preview of what's projected. Renders video player, slide canvas, or image viewer. |
| Queue Panel (right) | 280px default, 220–400px resizable | Yes (toggle icon) | Two-section queue: "Next Up" (manually queued) + "From [Source]" (service/playlist context). |

### Responsive Collapse

- **< 900px width**: Auto-collapse slide panel (icon-only toggle remains)
- **< 700px width**: Auto-collapse queue panel
- Panel collapse state persisted via Tauri plugin-store

---

## 3. Media State Machine

### States

```
                    ┌──────────┐
          LOAD      │          │
     ┌──────────────│   IDLE   │
     │              │          │
     ▼              └──────────┘
┌──────────┐              ▲
│ LOADING  │──── ERROR ───┘
└──────────┘
     │
     │ LOADED
     ▼
┌──────────┐   PLAY    ┌──────────┐   PAUSE   ┌──────────┐
│  READY   │──────────▶│ PLAYING  │◀─────────▶│  PAUSED  │
└──────────┘           └──────────┘           └──────────┘
                            │                      │
                            │ ENDED                │ STOP
                            ▼                      ▼
                       ┌──────────┐          ┌──────────┐
                       │  ENDED   │          │   IDLE   │
                       └──────────┘          └──────────┘
                            │
                            │ autoplay next
                            ▼
                       [Queue.next() → LOAD]
```

### Zustand Implementation (`useMediaPlayerStore`)

```typescript
interface MediaPlayerState {
  // Current item
  currentItem: MediaItem | null;
  status: "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

  // Timeline (shared between audio and video)
  currentTime: number;     // ms for audio, seconds for video
  duration: number;

  // Slides (for items with slides)
  slides: SlideContent[];
  activeSlideIndex: number;
  syncPoints: SyncPoint[];

  // Error
  error: string | null;

  // Actions
  load(item: MediaItem): void;
  play(): void;
  pause(): void;
  stop(): void;
  seek(position: number): void;
  goToSlide(index: number): void;
  nextSlide(): void;
  prevSlide(): void;
}
```

### Transition Rules

| From | Event | To | Side Effects |
|------|-------|----|-------------|
| IDLE | LOAD | LOADING | Fetch item data, resolve paths |
| LOADING | LOADED | READY | Auto-play if queue is active |
| LOADING | ERROR | IDLE | Show toast, log error |
| READY | PLAY | PLAYING | Start audio/video, broadcast to consumers |
| PLAYING | PAUSE | PAUSED | Pause audio/video, broadcast |
| PLAYING | ENDED | ENDED | Broadcast clear, trigger queue.next() |
| PAUSED | PLAY | PLAYING | Resume audio/video, broadcast |
| PAUSED | STOP | IDLE | Clear projection, stop audio/video |
| ENDED | (auto) | LOADING | Queue advances, loads next item |
| ANY | LOAD | LOADING | Interrupts current, loads new item |

---

## 4. Video Subsystem

### Architecture Decision: Dual-Path Video Serving

Users can open **any video file** from their machine (`isManaged: false`), not just yt-dlp-downloaded MP4s. Webview `<video>` elements only support a subset of formats natively:

| Format | Container | Codec | Webview Support |
|--------|-----------|-------|-----------------|
| MP4 | .mp4 | H.264/AAC | Universal — direct serve via Range requests |
| WebM | .webm | VP8/VP9/Opus | Universal — direct serve via Range requests |
| MOV | .mov | H.264/AAC | Partial (macOS yes, Windows/Linux no) |
| MKV | .mkv | H.264/AAC | Not supported (container issue, even if codec is compatible) |
| MKV | .mkv | H.265/VP9 | Not supported |
| AVI | .avi | Any | Not supported |
| WMV | .wmv | WMV/WMA | Not supported |
| FLV | .flv | H.264/AAC | Not supported |

**Strategy: detect format → choose path:**

```
User opens any video file
  │
  ▼
Rust command: probe_video_format(path) → { container, videoCodec, audioCodec, needsTranscode }
  │
  ├─ MP4/WebM with H.264/VP8/VP9 → DIRECT PATH
  │   └─ Streaming server serves file via Range requests (current behavior)
  │
  ├─ MKV with H.264+AAC → REMUX PATH (fast, no re-encoding)
  │   └─ ffmpeg-sidecar: -c copy -f mp4 -movflags frag_keyframe+empty_moov pipe:1
  │   └─ Streaming server pipes ffmpeg stdout as response (streaming remux)
  │
  └─ AVI/WMV/FLV/exotic codecs → TRANSCODE PATH (slower, CPU-intensive)
      └─ ffmpeg-sidecar: -c:v libx264 -preset veryfast -crf 23 -c:a aac -f mp4 -movflags frag_keyframe+empty_moov pipe:1
      └─ Streaming server pipes ffmpeg stdout as response (streaming transcode)
```

**Key principles:**
- **Zero-copy when possible** — MP4/WebM go through existing Range request path (no ffmpeg involvement)
- **Remux over transcode** — When the codec is web-compatible but the container isn't (MKV+H.264), just repackage the container (`-c copy`, near-instant, zero CPU)
- **Transcode as last resort** — Only re-encode when the codec itself is incompatible (WMV, MPEG-2, etc.)
- **ffmpeg-sidecar binary** — Auto-downloaded on first need (~100MB), not bundled with the app. Uses `ffmpeg-sidecar` v2.4.0 (MIT, 520+ stars) with the same cancellable async run pattern as yt-dlp
- **No GPU assumptions** — Use CPU-based `libx264` preset `veryfast`, not NVIDIA NVENC. Works on all hardware.

### Format Detection Command

```rust
#[tauri::command]
pub fn probe_video_format(path: String) -> Result<VideoProbe, AppError> {
    // Uses ffprobe (bundled with ffmpeg-sidecar) to detect:
    // - container format (mp4, matroska, avi, wmv, flv)
    // - video codec (h264, vp8, vp9, hevc, wmv3, mpeg2)
    // - audio codec (aac, opus, vorbis, mp3, wma)
    // Returns { container, videoCodec, audioCodec, duration, needsRemux, needsTranscode }
}
```

### Streaming Server: Piped Transcoding Route

New route: `/media-transcode/{path}?mode=remux|transcode`

```
GET /media-transcode/path/to/video.mkv?mode=remux
  │
  ▼
Server spawns: ffmpeg -i /path/to/video.mkv -c copy -f mp4 -movflags frag_keyframe+empty_moov pipe:1
  │
  ▼
Pipes ffmpeg stdout → HTTP response (Content-Type: video/mp4, Transfer-Encoding: chunked)
  │
  ▼
<video> element plays the piped MP4 stream
```

**Seeking limitation:** Piped transcode/remux does NOT support Range requests. For seeking:
- Frontend tracks current playback position
- On seek: kill current ffmpeg process, spawn new one with `-ss {seekTime}` flag
- Small latency on seek (~200ms for remux, ~1-2s for transcode) — acceptable tradeoff

**Fallback:** If `ffmpeg-sidecar` binary is not available, show a user-friendly message: "This video format requires ffmpeg. Download now?" with a one-click install (same pattern as yt-dlp binary management).

### Online Video (YouTube)

```
User selects YouTube video
  │
  ▼
MediaPlayerStore.load({ type: "online_video", videoId: "abc123", videoSource: "youtube" })
  │
  ▼
PersistentVideoPlayer detects videoSource === "youtube"
  │
  ├─ Creates YT.Player container (imperatively, outside React tree)
  ├─ Loads YouTube IFrame API if not cached
  ├─ new YT.Player(container, { videoId, events: { onReady, onStateChange } })
  │
  ▼
YT.Player.onReady:
  ├─ Start polling: every 250ms → getCurrentTime(), getDuration()
  ├─ Emit Tauri event "media-state" with { currentTime, duration, paused, source: "youtube" }
  └─ Broadcast to all consumers
  │
  ▼
Projector/Return windows:
  ├─ Projector: Renders its own YT.Player iframe (slave mode, synced via events)
  └─ Return: Shows title + thumbnail (no iframe — lighter weight)
```

**YouTube sync strategy between windows:**
- Main window is the **controller** (user interactions happen here)
- Projector window creates its own YT.Player, receives `"video-sync"` events from main
- Periodic resync every 2s: main emits `{ action: "sync", currentTime, paused }`, projector corrects if drift > 0.5s
- Commands: `play`, `pause`, `seek(time)`, `sync(time, paused)`

### Offline Video (Local Files)

```
User selects local video
  │
  ▼
MediaPlayerStore.load({ type: "offline_video", videoPath: "/path/to/video.mkv", isManaged: false })
  │
  ▼
probe_video_format(videoPath) → { needsRemux: true, needsTranscode: false }
  │
  ▼
useMediaSource hook:
  ├─ Checks streaming server status
  ├─ If not running → startStreamingServer() (on-demand)
  ├─ Waits for port assignment
  ├─ Evaluates probe result:
  │   ├─ needsRemux=false, needsTranscode=false → Direct URL
  │   │   └─ http://127.0.0.1:{port}/media/{path}
  │   ├─ needsRemux=true → Remux URL (fast, -c copy)
  │   │   └─ http://127.0.0.1:{port}/media-transcode/{path}?mode=remux
  │   └─ needsTranscode=true → Transcode URL (slower, re-encode)
  │       └─ http://127.0.0.1:{port}/media-transcode/{path}?mode=transcode
  │
  ▼
<video> element:
  ├─ Direct path: Range requests → 206 Partial Content (instant seeking)
  ├─ Remux/transcode path: piped ffmpeg → chunked response (seek = restart ffmpeg with -ss)
  │
  ▼
Polling loop (250ms):
  ├─ Read video.currentTime, video.duration, video.paused
  ├─ Emit "media-state" event
  └─ All consumers receive playback state
```

**Format-specific UX indicators:**
- Direct path: no indicator (seamless)
- Remux path: brief "Preparing video..." toast (~1s), then plays normally
- Transcode path: "Converting video format..." progress indicator, warn about seek latency
- No ffmpeg installed: "This video format requires ffmpeg. Download now?" prompt

**Multi-window local video:**
- All windows hit the same streaming server URL
- Each window has its own `<video>` element
- Sync via `"video-sync"` events (same as YouTube pattern)
- Main window is controller, others are followers
- For remux/transcode paths: only ONE ffmpeg process serves all windows (shared pipe)

### External File Access

For videos outside `app_data_dir` (`isManaged: false`):
- Streaming server's `resolve_serve_path()` already handles absolute paths
- Security: validate paths don't contain `..` or null bytes (already implemented)
- No file copying — stream directly from original location
- Format detection runs on the original file path (no copy needed)

---

## 5. Audio Subsystem

### Current Architecture (Keep)

The rodio-based audio system is solid and should remain unchanged:

```
Frontend: play(file, mode) → Rust command
  │
  ▼
Rust: rodio::OutputStream → Decoder → Sink
  ├─ Spawns on background thread (Windows audio init pattern)
  ├─ Polls position every 100ms
  └─ Emits "audio-status" event: { positionMs, durationMs, isPlaying, volume }
  │
  ▼
Frontend: useAudioStore subscribes to "audio-status"
  ├─ Updates currentTime, duration, isPlaying
  └─ syncToPosition() maps time → slide index via sync points
```

### Unified Timeline

The `MediaPlayerStore` normalizes audio and video timelines:

```typescript
// Audio events (from rodio via Tauri events)
listen("audio-status", (event) => {
  mediaPlayerStore.getState().updateTimeline({
    currentTime: event.positionMs,
    duration: event.durationMs,
    source: "audio"
  });
});

// Video events (from PersistentVideoPlayer polling)
listen("media-state", (event) => {
  mediaPlayerStore.getState().updateTimeline({
    currentTime: event.currentTime * 1000, // normalize to ms
    duration: event.duration * 1000,
    source: "video"
  });
});
```

### Sync Points Integration

For hymns with lyrics synchronization:
1. Sync points define time windows for each slide (stanza)
2. `MediaPlayerStore.updateTimeline()` checks if current time crosses a sync boundary
3. If yes → auto-advances `activeSlideIndex` and broadcasts new slide to consumers
4. User can also manually click slides in the slide panel → seeks audio to that sync point

---

## 6. Slide Subsystem

### Slide Panel (Left Sidebar)

```
┌──────────────────┐
│ ≡ Slides    [><] │  ← Header with collapse toggle
├──────────────────┤
│ ┌──────────────┐ │
│ │  ■■■■■■■■■■  │ │  ← Active slide (highlighted border)
│ │  Verse 1     │ │
│ │  ■■■■■■■■■■  │ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │  ░░░░░░░░░░  │ │
│ │  Verse 2     │ │
│ │  ░░░░░░░░░░  │ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │  ░░░░░░░░░░  │ │
│ │  Chorus      │ │
│ │  ░░░░░░░░░░  │ │
│ └──────────────┘ │
│        ...       │
└──────────────────┘
```

**Behavior by media type:**

| Media Type | Slide Panel Shows | Click Action |
|-----------|------------------|-------------|
| Hymn (any mode) | Stanza thumbnails with lyrics preview | Go to stanza, seek audio if sync points exist |
| Presentation | Slide thumbnails | Go to slide (manual advance) |
| Online/Offline Video | Hidden (no slides) | N/A |
| Image | Hidden (single item) | N/A |
| Bible | Hidden (single item) | N/A |

**Implementation:** `@dnd-kit/sortable` for reorderable slides (presentations). Hymn stanzas are read-only order. Each thumbnail uses existing `<SlideThumbnail>` component with 16:9 aspect ratio.

### Slide Projection Flow

```
User clicks slide thumbnail OR sync auto-advances
  │
  ▼
MediaPlayerStore.goToSlide(index)
  ├─ Updates activeSlideIndex
  ├─ If has sync points + audio playing: seek audio to sync point time
  │
  ▼
Broadcast to consumers:
  ├─ Rust: setCurrentSlide(slides[index]) → emit("slide-changed")
  ├─ Rust: setSlideContext(slides[index+1], index, total, title) → emit("slide-context")
  │
  ▼
Consumers render:
  ├─ Projector: Full slide (background + text)
  ├─ Return: Current + next slide (70/30 split)
  └─ Streaming: SSE broadcast to music/return channels
```

---

## 7. Multi-Consumer Broadcasting

### Event-Driven Architecture (Existing Pattern, Extended)

```
┌──────────────────────────────────────────────────────┐
│                   Rust Event Hub                      │
│                                                      │
│  MediaPlayerStore action                             │
│       │                                              │
│       ├─ emit("slide-changed", slide_data)           │
│       ├─ emit("slide-context", context_data)         │
│       ├─ emit("video-sync", { action, time, paused })│
│       ├─ emit("media-state", { time, duration })     │
│       └─ emit("overlay-changed", overlay_type)       │
│                                                      │
└──────────┬──────────┬──────────┬────────────────────┘
           │          │          │
     ┌─────┴───┐ ┌───┴────┐ ┌──┴──────┐ ┌───────────┐
     │ Playing │ │Projector│ │ Return  │ │ Streaming │
     │   Now   │ │ Window  │ │ Monitor │ │   (SSE)   │
     │         │ │         │ │         │ │           │
     │ listen()│ │ listen()│ │ listen()│ │ broadcast │
     │ + store │ │ + render│ │ + render│ │ to clients│
     └─────────┘ └────────┘ └────────┘ └───────────┘
```

### Consumer Responsibilities

| Consumer | Slide Rendering | Video | Audio | Controls |
|----------|----------------|-------|-------|----------|
| Playing Now | Preview canvas (scaled) | VideoPreviewSlot (main player) | Progress bar + controls | Full control bar |
| Projector | Full resolution slide | Own video element (synced) | None (audio from main) | None (keyboard shortcuts only) |
| Return | Current + next (70/30) | Title + thumbnail only | None | None |
| Streaming | HTML via SSE | Not supported (bandwidth) | Not supported | None |

### Video Sync Protocol

New Tauri event `"video-sync"` for multi-window video coordination:

```typescript
// Emitted by main window (controller)
type VideoSyncEvent = {
  action: "play" | "pause" | "seek" | "sync" | "stop";
  currentTime: number;  // seconds
  paused: boolean;
  videoId?: string;     // for YouTube
  videoUrl?: string;    // for local video (streaming URL)
};

// Periodic sync (every 2s while playing)
// Projector corrects if abs(localTime - syncTime) > 0.5s
```

---

## 8. Queue System

### Two-Section Queue Model (Spotify Pattern)

```typescript
interface QueueState {
  // Manual queue (user-added items, highest priority)
  manualQueue: QueueItem[];

  // Source context (service items, playlist, album — lower priority)
  sourceQueue: QueueItem[];
  sourceLabel: string; // "Service: Sunday Morning" or "Playlist: Worship Set"

  // Current
  currentIndex: number; // -1 = nothing playing
  currentSection: "manual" | "source";

  // Playback
  repeat: "off" | "one" | "all";
  shuffle: boolean;

  // Actions
  addToQueue(item: MediaItem): void;           // Adds to manual queue
  addToQueueNext(item: MediaItem): void;       // Adds to top of manual queue
  setSourceQueue(items: MediaItem[], label: string): void;
  removeFromQueue(index: number, section: "manual" | "source"): void;
  reorder(from: number, to: number, section: "manual" | "source"): void;
  next(): QueueItem | null;
  prev(): QueueItem | null;
  clear(): void;
}
```

### Queue Resolution Order

```
1. If manualQueue is not empty → play next from manualQueue
2. If manualQueue is empty → play next from sourceQueue
3. If both empty:
   a. repeat === "all" → restart sourceQueue from beginning
   b. repeat === "off" → ENDED state, stop playback
```

### Queue Panel UI

```
┌──────────────────────┐
│ Queue           [><] │ ← Collapse toggle
├──────────────────────┤
│                      │
│ ▶ NOW PLAYING        │
│ ┌──────────────────┐ │
│ │ 🎵 Amazing Grace │ │ ← Highlighted, playing indicator
│ │    Hymn #215     │ │
│ └──────────────────┘ │
│                      │
│ NEXT UP         [✕]  │ ← Clear manual queue
│ ┌──────────────────┐ │
│ │ ≡ 🎵 How Great   │ │ ← Drag handle + type icon
│ │   Thou Art       │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ ≡ 🎬 Sermon Clip │ │
│ │   Part 2         │ │
│ └──────────────────┘ │
│                      │
│ FROM: Sunday Service │ ← Source context label
│ ┌──────────────────┐ │
│ │   📖 John 3:16   │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │   🎵 Blessed     │ │
│ │   Assurance      │ │
│ └──────────────────┘ │
│                      │
└──────────────────────┘
```

**Type icons:** 🎵 hymn, 🎬 video, 📖 bible, 📝 annotation, 🖼 image, 📊 presentation

**Interactions:**
- Drag to reorder (within each section, not across)
- Hover → show remove (X) button
- Click → jump to that item (skipping queue)
- Right-click → context menu (remove, move to top, play next)

---

## 9. Control Bar

### Adaptive Controls

The control bar adapts based on the current `MediaItem.type`:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [◀◀] [▶/❚❚] [▶▶]    ████████░░░░░░░  0:42 / 3:15   🔊━━ │
│                                                             │
│  [◀ Slide] [Slide ▶]  Verse 2 of 5                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Control Visibility Matrix

| Control | Hymn (sung/karaoke) | Hymn (silent) | Video | Presentation | Image/Bible |
|---------|-------------------|--------------|-------|-------------|------------|
| Play/Pause | Yes (audio) | No | Yes (video) | No | No |
| Prev/Next (time) | Yes (prev/next hymn) | No | Yes (±10s skip) | No | No |
| Progress bar | Yes (audio timeline) | No | Yes (video timeline) | No | No |
| Time display | Yes (mm:ss) | No | Yes (mm:ss) | No | No |
| Volume | Yes | No | Yes | No | No |
| Prev/Next Slide | Yes | Yes | No | Yes | No |
| Slide counter | Yes ("Verse 2/5") | Yes | No | Yes ("Slide 3/12") | No |
| Sync indicators | Yes (dots on timeline) | No | No | No | No |

### Sync Point Visualization

For hymns with sync points, the progress bar shows markers:

```
────●──────●──────●──────●──────●────────
    V1     V2     Ch     V3     Ch
    ▲ current position
```

Each marker is clickable → jumps to that stanza + seeks audio.

---

## 10. Streaming Server Evolution

### Current State (Keep)

The existing `streaming/mod.rs` is solid:
- Raw `TcpListener` with `TcpStream::write_all()` + `flush()`
- 6 SSE channels (music, bible, return, alert, utility, ui)
- HTTP range requests for video files (64KB chunks)
- Path traversal protection
- CORS headers
- On-demand startup via `useMediaSource` hook

### Enhancements Needed

| Enhancement | Priority | Description |
|------------|----------|-------------|
| Video sync channel | High | New SSE channel `video` for streaming clients that shows video title/thumbnail (no actual video stream) |
| Absolute path support | High | `resolve_serve_path()` should accept absolute paths for `isManaged: false` videos |
| MIME type for more formats | Medium | Add `.webm`, `.mkv`, `.mov`, `.avi` to content-type detection |
| Auth token | Low | Generate random token on startup, require in query param for `/media/*` routes |
| Chunk size cap | Low | Cap max response chunk at 32MB (prevents WebView2 from requesting huge chunks) |

### Future: ffmpeg-sidecar for Transcoding (Not Phase 1)

When needed (non-web-compatible formats):

```
User opens MKV/AVI file
  │
  ▼
Streaming server detects non-web-compatible format
  │
  ▼
ffmpeg-sidecar: remux to MP4 (container change only, fast)
  ├─ ffmpeg -i input.mkv -c copy -f mp4 -movflags frag_keyframe+empty_moov pipe:1
  └─ Pipe output directly to HTTP response (streaming transcode)
  │
  ▼
<video> plays fragmented MP4 stream
```

This requires `ffmpeg-sidecar` v2.4.0 (MIT, 520+ stars, actively maintained, auto-downloads ~100MB binary). The async variant (`async-ffmpeg-sidecar`) is too immature (10 stars, v0.0.4).

#### Reference: vserve Transcoding Server (Evaluated)

The [vserve](https://github.com/user/vserve) project demonstrates a full ffmpeg-powered transcoding media server (axum + tokio + MSE) that validates our Phase 3 approach:

**What vserve does:**
- `/video-data` endpoint: runs `ffprobe` for metadata (tracks, duration, subtitles)
- `/video?timestamp=X&duration=10`: spawns ffmpeg processes per stream (video/audio/subs), transcodes 10-second chunks
- Frontend uses MediaSource Extensions (MSE) to append chunked buffers to `<video>`
- Supports multi-track audio switching + subtitle cycling

**Patterns to adopt in Phase 3:**
1. **Metadata extraction via ffprobe** — probe format/tracks before deciding transcode strategy (use `ffmpeg-sidecar`'s built-in probe, not raw `Command::new`)
2. **Piped remuxing** — `ffmpeg -c copy -f mp4 -movflags frag_keyframe+empty_moov pipe:1` confirms our planned approach works for container remuxing

**Patterns to NOT adopt:**
- NVIDIA-specific transcoding (cuda/nvenc) — desktop app can't assume GPU hardware
- Custom binary protocol for multi-track packing — overengineered for our single-track use case
- MSE chunked playback model — adds latency vs native HTTP Range seeking
- 10-second chunk re-transcoding on seek — our Range request seeking is instant
- axum/tokio server — we already have a proven raw TCP server optimized for SSE
- video.js dependency — we use native `<video>` elements

**Key difference:** vserve is designed for **universal format playback** (any input → browser-compatible output). Our Phase 3 only needs **container remuxing** (`-c copy`, no re-encoding) for MKV→MP4, which is near-instant and CPU-free.

---

## 11. Migration Strategy

### Phase 1: Core Refactor (MVP)

1. **Create `useMediaPlayerStore`** — unified state machine replacing scattered state across `usePresentationStore`, `useAudioStore`, and `useVideoPlayerStore`
2. **Refactor Playing Now layout** — three-panel with collapsible sidebars
3. **Implement slide panel** — thumbnails with @dnd-kit sortable
4. **Implement queue panel** — two-section model, drag-to-reorder
5. **Unify control bar** — adaptive controls based on media type
6. **Add `"video-sync"` event** — multi-window video synchronization

### Phase 2: Video Improvements + Format Support

7. **Absolute path support** — serve any video file on disk through streaming server
8. **Format detection + dual-path serving** — `probe_video_format` command (ffprobe via ffmpeg-sidecar), direct serve for MP4/WebM, remux for MKV+H.264, transcode for AVI/WMV/FLV (see Section 4.2)
9. **ffmpeg-sidecar auto-download** — on-demand binary download (~100MB), same pattern as yt-dlp
10. **Projector video rendering** — own `<video>` element synced via events
11. **Return monitor video** — title + thumbnail display (no video playback)

### Phase 3: Enhanced Experience

12. **Sync point visualization** — markers on timeline, click-to-jump
13. **Queue persistence** — save/restore queue across app restarts

### What NOT to Change

- **rodio audio engine** — working well, no reason to replace
- **YouTube IFrame approach** — `youtube-nocookie.com` works, avoid overengineering
- **SSE streaming server** — raw TcpListener is the right choice (CLAUDE.md explicitly warns against buffered HTTP libs for SSE)
- **Tauri event system** — proven pattern for multi-window communication
- **SlideContent model** — flat Rust struct / discriminated union TS pattern is solid

---

## 12. Technology Decisions

### Evaluated and Rejected

| Technology | Reason for Rejection |
|-----------|---------------------|
| **ffmpeg-sidecar (for direct playback replacement)** | Not used to replace `<video>` element. Instead adopted for dual-path serving: ffprobe format detection + piped remux/transcode for non-web formats (MKV/AVI/WMV/FLV). Web-compatible formats (MP4/WebM) still served directly via streaming server. See Section 4.2. |
| **async-ffmpeg-sidecar** | Too immature (v0.0.4, 10 stars, 25 commits). Use sync version on background thread if needed. |
| **XState** | Adds a new paradigm. Zustand state machine is consistent with existing codebase. |
| **Vidstack** | Good library but adds complexity. Custom controls on Radix primitives match existing UI patterns. |
| **react-player** | Same YouTube Error 153 issue in Tauri production builds. No advantage over current iframe approach. |
| **MediaSource Extensions (MSE)** | Requires fragmented MP4 remuxing. HTTP range requests achieve same result with less complexity. |
| **HLS/DASH** | Overkill for local file playback. Only useful for adaptive bitrate streaming to external devices. |
| **Tauri asset protocol** | Known crashes with large files (>3.5GB). Memory issues on seek. Streaming server is superior. |
| **tauri-plugin-libmpv** | Limited platform support, poor documentation, requires runtime library bundling. |
| **Axum/Actix embedded server** | Requires tokio runtime. Raw TcpListener is zero-dep and already proven. |
| **vserve-style MSE transcoding** | ffmpeg chunk-based transcoding + MediaSource Extensions adds latency, GPU assumptions, and complexity. Our HTTP Range requests achieve instant seeking with zero transcoding for web-compatible formats. Useful patterns (ffprobe metadata, piped remuxing) adopted into Phase 2 dual-path architecture. |

### Confirmed Technologies

| Decision | Technology | Rationale |
|----------|-----------|-----------|
| Local video serving | Existing streaming server (HTTP range) | Already works, 64KB chunks, zero additional deps |
| Online video | YouTube IFrame API via `youtube-nocookie.com` | Proven approach, handles CSP correctly |
| Audio playback | rodio (Rust) | Working well, background thread pattern established |
| State management | Zustand (`useMediaPlayerStore`) | Consistent with existing stores, `getState()` for stale closure safety |
| Multi-window sync | Tauri events (`emit`/`listen`) | Existing pattern, low latency, reliable |
| Queue UI | @dnd-kit/sortable | Already a dependency, handles drag-to-reorder |
| Slide thumbnails | Existing `<SlideThumbnail>` component | Proven, 16:9 aspect ratio |
| Control bar | Custom on Radix primitives | Matches existing UI design system |
| SSE streaming | Raw TcpListener (existing) | CLAUDE.md mandates no buffered HTTP libs for SSE |

---

## Appendix A: Event Reference

| Event Name | Emitter | Payload | Consumers |
|-----------|---------|---------|-----------|
| `slide-changed` | Rust (setCurrentSlide) | `SlideContentFlat` | Projector, Return, Streaming |
| `slide-context` | Rust (setSlideContext) | `{ next, index, total, title }` | Return |
| `slide-cleared` | Rust (clearCurrentSlide) | None | All |
| `overlay-changed` | Rust | `{ type: "black" \| "logo" \| null }` | Projector |
| `audio-status` | Rust (rodio) | `{ positionMs, durationMs, isPlaying, volume }` | Playing Now |
| `video-sync` | Main window | `{ action, currentTime, paused, videoId?, videoUrl? }` | Projector |
| `media-state` | PersistentVideoPlayer | `{ currentTime, duration, paused, volume, source }` | Playing Now |
| `video-control` | Playing Now controls | `{ action: "play"\|"pause"\|"seek"\|"volume", value? }` | PersistentVideoPlayer |

## Appendix B: File Impact Map

### New Files

| File | Purpose |
|------|---------|
| `src/stores/media-player-store.ts` | Unified media state machine |
| `src/components/playing-now/slide-panel.tsx` | Left sidebar slide thumbnails |
| `src/components/playing-now/queue-panel.tsx` | Right sidebar queue |
| `src/components/playing-now/control-bar.tsx` | Adaptive control bar |
| `src/components/playing-now/preview-canvas.tsx` | Main preview area |
| `src/hooks/use-media-player.ts` | Hook bridging store + Tauri events + side effects |

### Modified Files

| File | Changes |
|------|---------|
| `src/routes/playing-now/index.tsx` | Complete rewrite: three-panel layout |
| `src/stores/queue-store.ts` | Extend with two-section model + source context |
| `src/components/online-videos/persistent-video-player.tsx` | Integrate with MediaPlayerStore, add video-sync emit |
| `src/routes/projector.tsx` | Add video-sync listener for video playback |
| `src-tauri/src/streaming/mod.rs` | Add video SSE channel, absolute path support |

### Deprecated (Absorb into new system)

| File | Absorbed By |
|------|-------------|
| `src/stores/video-player-store.ts` | `media-player-store.ts` |
| Parts of `src/stores/audio-store.ts` (timeline) | `media-player-store.ts` |
| Parts of `src/hooks/use-slides.ts` (projection) | `use-media-player.ts` |

---

## Sources

1. [ffmpeg-sidecar GitHub](https://github.com/nathanbabcock/ffmpeg-sidecar) — v2.4.0, MIT, 520+ stars
2. [Tauri asset protocol crash with large videos (#6375)](https://github.com/tauri-apps/tauri/issues/6375)
3. [YouTube IFrame Error 153 in Tauri (#14422)](https://github.com/tauri-apps/tauri/issues/14422)
4. [Tauri Zustand multi-window sync](https://www.gethopp.app/blog/tauri-window-state-sync)
5. [Vidstack Player](https://vidstack.io/) — Modern React video player
6. [Spotify Queue Management](https://support.spotify.com/us/article/play-queue/)
7. [Apple Music Up Next](https://support.apple.com/guide/music-web/queue-up-your-songs-apdm275ada6c/web)
8. [XState video player model](https://dev.to/matiasfha/quick-post-modeling-a-video-player-with-xstate-eko)
9. [ProPresenter Screen Configuration](https://support.renewedvision.com/hc/en-us/articles/360041879173)
10. [MSE WebView support](https://caniwebview.com/features/web-feature-media-source/)
11. [Bundled localhost server for Tauri (gist)](https://gist.github.com/nathanbabcock/c819ff70803c70708687196b4fe658ac)
12. [Custom protocol handlers in Tauri 2](https://docs.rs/tauri/2.10.2/tauri/struct.Builder.html)
13. [Tauri discussion: local video display (#9235)](https://github.com/tauri-apps/tauri/discussions/9235)
14. [vserve — ffmpeg transcoding media server](https://github.com/user/vserve) — Evaluated for MSE chunked transcoding approach; adopted metadata/remuxing patterns for Phase 2 dual-path architecture
