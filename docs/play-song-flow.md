# Play Song Flow

## Overview

The entire system is queue-driven: `useQueueStore.currentIndex` is the single source of truth. Setting it (by any means: button click, song finish, manual skip) triggers the playback coordinator which re-orchestrates everything — audio, slides, and sync points.

The 50ms `audio-status` loop is the heartbeat: it drives both the progress bar UI and slide auto-sync (when syncPoints exist), using a `seekLock` pattern to suppress stale payloads after seeks.

---

## Entry Points (`src/routes/hymnal/$hymnId.tsx`)

```
User clicks "Cantado" / "Playback" / "Só Slides"
  └── useHymnPlayback().handleStart[Cantado|Playback|SlidesOnly](hymn)
        ├── clearQueue()              → useQueueStore: items=[], currentIndex=-1
        ├── addToQueue([item])        → useQueueStore: currentIndex=0  ← TRIGGER
        └── router.navigate("/operator")
```

Item types:
- `"audio"` — Cantado (sung mode, uses `hymn.audioPath`)
- `"playback"` — Karaoke (uses `hymn.playbackPath`)
- `"projection"` — Só slides (no audio)

---

## Core Orchestrator (`src/hooks/use-playback-coordinator.ts`)

The `/operator` route mounts this hook, which watches `currentIndex`. Any change fires `playItem(index)`:

```
playItem(index)
  │
  ├─ 1. FETCH SYNC POINTS
  │    getSyncPoints(hymnId)  →  invoke("get_sync_points")
  │    → Rust: db::queries::music::get_sync_points()  [src-tauri/src/commands/audio.rs:250]
  │    useAudioStore.setSyncPoints(points)
  │
  ├─ 2. START AUDIO (if type !== "projection")
  │    audioPath = type === "playback" ? hymn.playbackPath : hymn.audioPath
  │    setPlaybackMode("karaoke" | "sung" | "silent")
  │    useAudioStore.play(filePath, 0)
  │      ├── startStatusSubscription()  →  listen("audio-status", applyPayload)
  │      └── audioPlay()  →  invoke("audio_play")
  │            → Rust: audio_play()  [src-tauri/src/commands/audio.rs:118]
  │              ├── resolve_audio_path()
  │              ├── AudioPlayer::play()  →  rodio Sink::append()  ← sound starts
  │              └── start_audio_status_stream()
  │                    → std::thread::spawn: emit("audio-status") every 50ms
  │
  ├─ 3. BUILD SLIDES
  │    hymnToSlides(title, lyrics, album, coverPath)
  │      → [cover slide, ...stanza slides (split on \n\n), pause slide]
  │    usePresentationStore.setPresentationSlides(slides)
  │
  └─ 4. PROJECT FIRST SLIDE
       projectSlideIndex(0)  [src/lib/projection-playback.ts:72]
         → invoke("set_current_slide")
         → Rust: app.emit("slide-changed", &slide_data)
         → ProjectorView, OperatorScreen, ReturnView listen and render
```

Guards:
- `lastPlayedIndexRef` — prevents re-triggering for the same index if `items.length` changes
- `isMountedRef` — prevents state updates after unmount

---

## 50ms Audio-Status Loop (Rust → Frontend)

```
Rust thread (every 50ms):
  snapshot_audio_status() → AudioStatusPayload {
    position_ms, duration_ms, is_playing, is_paused, volume, current_file
  }
  if any field changed: app.emit("audio-status", payload)
  if !is_playing && !is_paused: break  ← stream self-terminates
                      │
                      ▼
src/stores/audio-store.ts  applyPayload()
  ├── SEEK LOCK check: discard stale payloads within 1s after a seek
  ├── set({ positionMs, durationMs, status, volume, currentFile })
  ├── if syncPoints.length > 0:
  │     targetSlide = findSlideAtPosition(syncPoints, positionMs)
  │     if targetSlide !== lastSyncSlide:
  │       queueSlideProjection(targetSlide)
  │         → projectSlideIndex(slideIndex)  →  invoke("set_current_slide")
  └── if !isPlaying && !isPaused:
        onFinished()     ← auto-advance queue
        stopStatusSubscription()
```

---

## Auto-Advance (Song Ends)

```
onFinished()
  └── registered by usePlaybackCoordinator on mount:
      setOnFinished(() => { next() })

useQueueStore.next()  →  set({ currentIndex: currentIndex + 1 })
                                    │
                                    ▼
          usePlaybackCoordinator useEffect fires (watches currentIndex)
          playItem(newIndex)  ← full cycle restarts
```

---

## Play/Pause Controls

### AudioControls component (`src/components/music/audio-controls.tsx`)

Local playback (hymn detail page, no projection):

```
handlePlay()
  ├── if paused  → useAudio().resume()
  │     → audioResume()  →  invoke("audio_resume")
  │     → Rust: sink.play()  [commands/audio.rs:171]
  │     → start_audio_status_stream() + emit_audio_status()
  │
  ├── if playing → useAudio().pause()
  │     → audioPause()  →  invoke("audio_pause")
  │     → Rust: sink.pause()  [commands/audio.rs:157]
  │     → emit_audio_status()  (one immediate snapshot)
  │
  └── else (new play) → useAudio().play(filePath)
        → full audio_play chain (see above)
```

### Operator screen (`src/routes/operator/index.tsx:304`)

```
togglePlayPause()  [src/hooks/use-audio.ts:7]
  → if playing: useAudioStore.pause()
  → if paused:  useAudioStore.resume()
```

---

## Manual Queue Navigation

```
PlayingQueue [src/components/operator/playing-queue.tsx:60]
  onItemClick  →  useQueueStore.setCurrentIndex(i)

OperatorScreen skip buttons [operator/index.tsx:285/334]
  prevQueueItem() / nextQueueItem()
    →  useQueueStore.prev() / next()
    →  set({ currentIndex: currentIndex ± 1 })
                │
                ▼  same trigger as auto-advance
      usePlaybackCoordinator fires playItem()
```

---

## Slide Navigation (Operator Prev/Next Slide)

```
ChevronRight/Left  →  useSlides().nextSlide() / prevSlide()  [src/hooks/use-slides.ts:103]
  └── goToSlide(index, { seekAudio: true })
        ├── seekAudioToSlideSyncPoint(index)
        │     → resolveSlideSeekTimestamp(syncPoints, index)
        │     → useAudioStore.seek(timestampMs)
        │           set({ seekLock: { targetMs, expiresAtMs } })  ← suppress stale events
        │           → audioSeek(ms)  →  invoke("audio_seek")
        │           → Rust: sink.try_seek(duration)  [commands/audio.rs:183]
        │           → emit_audio_status()
        ├── usePresentationStore.setActiveSlideIndex(index)
        └── projectSlideWithContext(slide, next, index, total, title)
              → invoke("set_current_slide")  →  "slide-changed" event
              → invoke("set_slide_context")  →  "slide-context" event
```

---

## Tauri Events

| Event | Emitter (Rust) | Listeners (Frontend) |
|---|---|---|
| `audio-status` | `commands/audio.rs` background thread (50ms) | `audio-store.ts` `startStatusSubscription()` |
| `slide-changed` | `commands/display.rs` `set_current_slide()` | `OperatorScreen`, `ProjectorView`, `ReturnView` |
| `slide-cleared` | `commands/display.rs` `clear_current_slide()` | `OperatorScreen` |
| `slide-context` | `commands/display.rs` `set_slide_context()` | `OperatorScreen` |
| `overlay-changed` | `commands/display.rs` toggle_*_screen() | `OperatorScreen`, `ProjectorView` |

---

## Full Data Flow (Summary)

```
User click
  └── QueueStore.currentIndex changes
        └── PlaybackCoordinator.playItem()
              ├── [parallel] AudioStore.play()
              │     └── invoke("audio_play")
              │           └── Rust: AudioPlayer + 50ms stream
              │                 └── emit("audio-status")  every 50ms
              │                       └── applyPayload()
              │                             ├── update UI state
              │                             ├── queueSlideProjection()  (if syncPoints)
              │                             └── onFinished()  (if song ended)
              │                                   └── QueueStore.next()  → loop
              │
              └── [parallel] PresentationStore.setSlides()
                    └── projectSlideIndex(0)
                          └── invoke("set_current_slide")
                                └── Rust: app.emit("slide-changed")
                                      └── ProjectorView renders
```

---

## Key Files

| File | Role |
|---|---|
| `src/routes/hymnal/$hymnId.tsx` | 4 action buttons, `isProjecting` gate |
| `src/hooks/use-hymn-playback.ts` | Entry point — populates queue |
| `src/hooks/use-playback-coordinator.ts` | Core orchestrator — reacts to queue index changes |
| `src/stores/queue-store.ts` | Queue state (`items`, `currentIndex`, `next/prev/setCurrentIndex`) |
| `src/stores/audio-store.ts` | Audio state + 50ms event subscription + slide sync logic |
| `src/hooks/use-audio.ts` | Thin hook exposing audio store actions |
| `src/components/music/audio-controls.tsx` | Local playback UI (non-projecting) |
| `src/lib/tauri.ts` | All `invoke()` wrappers |
| `src/lib/projection-playback.ts` | `projectSlideIndex`, `projectSlideWithType` |
| `src/hooks/use-slides.ts` | `goToSlide`, `nextSlide`, `prevSlide`, audio-seek sync |
| `src-tauri/src/commands/audio.rs` | `audio_play/pause/resume/stop/seek` + 50ms stream |
| `src-tauri/src/audio/player.rs` | `AudioPlayer` (rodio `Sink` wrapper) |
| `src/routes/operator/index.tsx` | Operator UI — slide/queue controls, event listeners |
| `src/components/operator/playing-queue.tsx` | Queue list, `setCurrentIndex` on click |
