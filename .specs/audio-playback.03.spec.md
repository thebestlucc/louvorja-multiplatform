# SPEC 03 — Audio Playback & Synchronization

**Phase:** 2
**Goal:** Replace the Delphi BASS library audio with Rust-native `rodio` and implement audio-slide sync.

---

## Files to CREATE

### Frontend — Components

#### `src/components/music/audio-controls.tsx`
- Create audio playback controls component
- UI elements: play/pause button, stop button, progress bar (Radix Slider), volume slider, current time / total time display
- Playback modes selector: "Sung" (with audio), "Karaoke" (audio with muted vocals if separate track), "Silent" (no audio, manual slide advance)
- Progress bar is interactive — click/drag to seek
- Volume slider with mute toggle
- Uses `useAudio` hook for all interactions
- Displays current audio file name

#### `src/components/music/audio-sync-editor.tsx`
- Create the audio-slide timestamp synchronization editor
- UI: audio waveform/progress bar at top, slide thumbnails below
- "Record" mode: play audio and tap (keyboard/click) to mark timestamps for each slide transition
- Displays existing sync points as markers on the progress bar
- Edit mode: drag markers to adjust timestamps, or type exact millisecond values
- "Clear All" and "Clear Selected" buttons
- Save/discard controls
- Preview button: plays audio and auto-advances slides based on recorded timestamps

### Frontend — Hooks

#### `src/hooks/use-audio.ts`
- Create audio playback hook wrapping Tauri commands
- State (synced from `audio-store`): `status`, `currentFile`, `positionMs`, `durationMs`, `volume`
- Actions: `play(filePath)`, `pause()`, `resume()`, `stop()`, `seek(ms)`, `setVolume(0-1)`
- Sets up polling interval (100ms) to fetch current position from Rust backend
- Listens to Tauri events for playback status changes
- Auto-advances slides when audio reaches sync points (uses `SyncPoint[]` from presentation store)

### Frontend — Types

#### `src/types/audio.ts` (UPDATE)
- Add `SyncPoint` type: `{ slideIndex: number; timestampMs: number }`
- Add `PlaybackMode` type: `'sung' | 'karaoke' | 'silent'`
- Refine `AudioState` type with all fields: `status`, `currentFile`, `positionMs`, `durationMs`, `volume`, `syncPoints`

---

## Files to UPDATE

### Backend — Audio Engine

#### `src-tauri/src/audio/player.rs`
- Implement the full `AudioPlayer` struct:
  ```rust
  pub struct AudioPlayer {
      sink: Option<Sink>,
      _stream: OutputStream,
      stream_handle: OutputStreamHandle,
      current_file: Option<PathBuf>,
      duration_ms: Option<u64>,
  }
  ```
- Implement methods:
  - `new() -> Result<Self>` — initialize audio output stream
  - `play(path: &Path) -> Result<()>` — load and play audio file (MP3, WAV, FLAC, OGG)
  - `pause()` — pause current playback
  - `resume()` — resume paused playback
  - `stop()` — stop and reset
  - `seek(ms: u64) -> Result<()>` — seek to position (rodio limitation: may need to reload and skip)
  - `set_volume(volume: f32)` — set volume (0.0 to 1.0)
  - `position_ms() -> u64` — get current playback position in milliseconds
  - `duration_ms() -> Option<u64>` — get total duration
  - `is_playing() -> bool` — check if currently playing
  - `is_paused() -> bool` — check if paused

#### `src-tauri/src/audio/sync.rs`
- Implement audio-slide synchronization logic
- `SyncPoint` struct: `{ slide_index: usize, timestamp_ms: u64 }`
- `SyncTimeline` struct: holds a sorted `Vec<SyncPoint>`
- Methods:
  - `new(points: Vec<SyncPoint>) -> Self`
  - `slide_at(position_ms: u64) -> usize` — returns the slide index for the given audio position
  - `add_point(point: SyncPoint)` — add a sync point
  - `remove_point(index: usize)` — remove a sync point
  - `update_point(index: usize, timestamp_ms: u64)` — modify a sync point's timestamp
  - `to_vec() -> Vec<SyncPoint>` — export all points

#### `src-tauri/src/audio/mod.rs`
- Ensure `player` and `sync` modules are properly exported
- Add any shared audio types

### Backend — Audio Commands

#### `src-tauri/src/commands/audio.rs`
- Implement all audio commands:
  - `audio_play(path: String, state: State<AudioState>) -> Result<(), AppError>` — load and play file
  - `audio_pause(state: State<AudioState>) -> Result<(), AppError>` — pause playback
  - `audio_resume(state: State<AudioState>) -> Result<(), AppError>` — resume playback
  - `audio_stop(state: State<AudioState>) -> Result<(), AppError>` — stop playback
  - `audio_seek(position_ms: u64, state: State<AudioState>) -> Result<(), AppError>` — seek to position
  - `audio_set_volume(volume: f32, state: State<AudioState>) -> Result<(), AppError>` — set volume
  - `audio_get_position(state: State<AudioState>) -> Result<u64, AppError>` — get current position
  - `audio_get_status(state: State<AudioState>) -> Result<AudioStatusPayload, AppError>` — get full status (position, duration, is_playing, volume)
- Add `AudioStatusPayload` struct for returning status

### Backend — State

#### `src-tauri/src/state.rs`
- Implement `AudioState` struct:
  - `player: Mutex<AudioPlayer>`
  - `sync_timeline: Mutex<Option<SyncTimeline>>`
- Add `AudioState` to Tauri managed state in `lib.rs`

### Backend — Cargo

#### `src-tauri/Cargo.toml`
- Add `rodio = "0.19"` dependency

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register audio commands: `audio_play`, `audio_pause`, `audio_resume`, `audio_stop`, `audio_seek`, `audio_set_volume`, `audio_get_position`, `audio_get_status`
- Initialize `AudioState` in Tauri managed state
- Set up periodic event emission for audio position (or let frontend poll)

### Frontend — Stores

#### `src/stores/audio-store.ts`
- Implement full audio state management:
  - Sync `positionMs` via polling (100ms interval)
  - Track `syncPoints` for the current hymn
  - `setPlaybackMode(mode)` action
  - Auto-slide-advance logic: when `positionMs` crosses a sync point, trigger `presentationStore.goToSlide()`

#### `src/stores/presentation-store.ts`
- Add `syncPoints: SyncPoint[]` to state
- Add `setSyncPoints(points)` action
- Add `loadHymnSlides(hymn)` — parse hymn lyrics into slides and load sync points from database

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `audioPlay(path: string): Promise<void>`
  - `audioPause(): Promise<void>`
  - `audioResume(): Promise<void>`
  - `audioStop(): Promise<void>`
  - `audioSeek(positionMs: number): Promise<void>`
  - `audioSetVolume(volume: number): Promise<void>`
  - `audioGetPosition(): Promise<number>`
  - `audioGetStatus(): Promise<AudioStatus>`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query for audio status polling:
  - `useAudioStatus()` — polls `audioGetStatus` every 100ms when audio is playing
- Add mutation for sync points:
  - `useSaveSyncPoints()` — persists sync points to database

### Backend — Database

#### `src-tauri/src/db/queries/music.rs`
- Add `get_sync_points(conn: &Connection, hymn_id: i64) -> Result<Vec<SyncPoint>>`
- Add `save_sync_points(conn: &Connection, hymn_id: i64, points: &[SyncPoint]) -> Result<()>`
  - Deletes existing points for the hymn and inserts new ones

#### `src-tauri/src/db/migrations.rs`
- Add migration for sync points table:
  ```sql
  CREATE TABLE audio_sync_points (
    id INTEGER PRIMARY KEY,
    hymn_id INTEGER REFERENCES hymns(id) ON DELETE CASCADE,
    slide_index INTEGER NOT NULL,
    timestamp_ms INTEGER NOT NULL
  );
  CREATE INDEX idx_sync_points_hymn ON audio_sync_points(hymn_id);
  ```
