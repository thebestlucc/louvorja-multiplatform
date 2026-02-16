# Phase 08 Specs — Video & Multimedia

## 1. Implementation Objective

Implement full video slide support from editor creation through projector playback and archive portability.

This spec converts the identified gaps into a file-level execution contract.

## 2. Current Gaps (Baseline)

1. Video type exists but model is minimal (`src` only).
2. Slide editor does not expose video slide option.
3. Slide renderer does not render video branch.
4. Video components are missing (`video-player`, `video-slide`, `video-picker`).
5. Backend video commands and metadata model are missing.
6. Frontend wrappers/queries for video commands are missing.
7. Archive read/write does not explicitly define video media handling contract.

## 3. Technical Scope

### 3.1 Data Model (Frontend Types)

Update:
- `src/types/presentation.ts`

Required shape:
- Keep `SlideType` with `"video"`.
- Expand `SlideContent` video variant to support:
  - `videoPath: string`
  - `autoPlay: boolean`
  - `loop: boolean`
  - `muted: boolean`
  - `mode: "fullscreen" | "background"`
  - `text?: string`
  - `textColor?: string`
  - `textSize?: number`

Mapping updates:
- `slideContentToFlat` and `flatToSlideContent` must preserve all video fields using JSON string payload strategy already used by slide content storage.

### 3.2 Backend Video Commands + Models

Update:
- `src-tauri/src/db/models.rs`
- `src-tauri/src/commands/utility.rs`
- `src-tauri/src/lib.rs`

Add model:
- `VideoMetadata { duration_ms, width, height, file_size, format }`

Add commands:
1. `copy_video_to_media(video_path: String, presentation_id: i64) -> Result<String, AppError>`
   - Copies selected file to app-managed media directory.
   - Returns relative media path for slide content.
2. `get_video_metadata(path: String) -> Result<VideoMetadata, AppError>`
   - Returns metadata needed by picker/editor validation UI.

Registration:
- Add both commands to `tauri::generate_handler![]` in `src-tauri/src/lib.rs`.

### 3.3 Frontend Tauri Wrappers + Query Hooks

Update:
- `src/lib/tauri.ts`
- `src/lib/queries.ts`

Add wrappers:
- `copyVideoToMedia(videoPath: string, presentationId: number): Promise<string>`
- `getVideoMetadata(path: string): Promise<VideoMetadata>`

Add query/mutation hooks:
- `useGetVideoMetadata(path)`
- `useCopyVideoToMedia()`

### 3.4 New Video Components

Create:
- `src/components/slides/video-player.tsx`
- `src/components/slides/video-slide.tsx`
- `src/components/slides/video-picker.tsx`

Component contracts:

1. `video-player.tsx`
- Wrap `<video>` element.
- Support props: `src`, `autoPlay`, `loop`, `muted`, `controls`, `onEnded`, `onTimeUpdate`.
- Expose loading/error visual state.

2. `video-slide.tsx`
- Render fullscreen mode or background mode.
- In background mode, allow text overlay rendering.
- Pause/cleanup behavior when slide deactivates.

3. `video-picker.tsx`
- Select file from dialog.
- Validate extension (`.mp4`, `.webm`).
- Display metadata preview (duration/resolution/size).
- Display unsupported-format guidance message.

### 3.5 Editor Integration

Update:
- `src/components/slides/slide-editor.tsx`
- `src/routes/presentations/$presentationId.tsx`

Requirements:
- Add `"video"` in `SLIDE_TYPES`.
- Add video field controls and mode options.
- Integrate video picker and metadata display.
- Persist updates through existing `usePresentation2` save pipeline.

### 3.6 Slide Rendering + Projector Behavior

Update:
- `src/components/slides/slide-renderer.tsx`
- `src/components/slides/projector-view.tsx`

Requirements:
- `slide-renderer` handles `slide.type === "video"` with explicit branch.
- Projector route supports playback lifecycle:
  - activate: play (when configured)
  - deactivate: pause/cleanup
  - end: configurable next-step callback (`onEnded`)

### 3.7 Archive Contract (`.slja`)

Update:
- `src-tauri/src/archive/mod.rs`
- related manifest handling if required

Requirements:
- Ensure video files are included under archive media paths.
- Ensure slide content references remain valid after import/export.
- Preserve relative media paths during roundtrip.

### 3.8 Utility Validation Helpers

Update:
- `src/lib/utils.ts`

Add:
- `isVideoFormatSupported(filename: string): boolean`
- `getConversionRecommendation(format: string): string`

## 4. Delivery Sequence (Kickoff Order)

1. Expand video data model in `src/types/presentation.ts`.
2. Implement backend commands + metadata model (`copy_video_to_media`, `get_video_metadata`).
3. Add frontend wrappers + query hooks.
4. Build `video-player` + `video-picker` and integrate into editor.
5. Add video rendering in `slide-renderer` and projector flow (`onEnded` behavior).
6. Update `.slja` import/export to include and preserve video media.

## 5. Acceptance Criteria

1. Video slide can be created, edited, and persisted in presentation editor.
2. Supported formats (MP4/WebM) play on projector view.
3. Unsupported formats are rejected with conversion recommendation.
4. `copy_video_to_media` returns stable path used by slide content.
5. `get_video_metadata` returns complete metadata used in UI.
6. `.slja` roundtrip keeps video references playable after import.
7. Existing non-video slides remain unaffected.

## 6. Verification Plan

### Static checks
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform vite build`

### Runtime smoke
1. Create video slide in presentation editor.
2. Select valid `.mp4` and confirm metadata appears.
3. Project slide and verify playback.
4. Move away from slide and confirm pause/cleanup.
5. Export `.slja`, re-import, and replay video slide.
6. Try unsupported extension and verify recommendation message.

## 7. Out-of-Spec Deferrals

- FFmpeg-based conversion.
- Advanced transition/effect editing for video timeline.
- Cross-device sync for playback position.
