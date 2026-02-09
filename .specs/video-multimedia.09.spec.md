# SPEC 09 — Video & Multimedia

**Phase:** 8
**Goal:** Video playback support in presentations and projector output.

---

## Files to CREATE

### Frontend — Components

#### `src/components/slides/video-player.tsx`
- Create HTML5 video player component
- Wraps the `<video>` element with custom controls
- Supports: play, pause, stop, seek, volume
- Progress bar with current time / total duration
- Format support: MP4, WebM (native to webview)
- Fullscreen toggle
- Auto-play option
- Loop option
- Props: `src`, `autoPlay`, `loop`, `controls`, `onEnded`, `onTimeUpdate`

#### `src/components/slides/video-slide.tsx`
- Create video slide component (used in presentations)
- Renders a slide with embedded video
- Video can be:
  - Background video (behind text)
  - Fullscreen video (no text overlay)
- Supports video files from local file system
- Plays automatically when slide is activated
- Pauses when slide is deactivated
- Sync with audio if both are present (stretch goal)

#### `src/components/slides/video-picker.tsx`
- Create video file picker/uploader component
- File browser dialog for selecting video files
- Drag-and-drop upload area
- Preview thumbnail generation (first frame of video)
- Shows video metadata: duration, resolution, file size
- Validates file format (MP4, WebM)
- Warning for unsupported formats (AVI, MKV, etc.) with conversion recommendation

### Frontend — Slide Editor

#### `src/components/slides/slide-editor.tsx` (UPDATE)
- Add support for video slide type
- Video tab in slide type selector
- Video file picker integration
- Video playback options: auto-play, loop, mute
- Background video vs fullscreen video toggle
- Preview of video in the editor

---

## Files to UPDATE

### Frontend — Types

#### `src/types/presentation.ts` (UPDATE)
- Add `'video'` to the `SlideType` union
- Add `VideoSlideContent` type:
  ```typescript
  type VideoSlideContent = {
    type: 'video';
    videoPath: string;
    autoPlay: boolean;
    loop: boolean;
    muted: boolean;
    mode: 'fullscreen' | 'background';
    text?: string; // For background mode
    textColor?: string;
    textSize?: number;
  }
  ```

### Frontend — Slide Renderer

#### `src/components/slides/slide-renderer.tsx` (UPDATE)
- Add rendering for `type: 'video'` slides
- For fullscreen mode: render video element at full size
- For background mode: render video with text overlay
- Handle video events: `onEnded` (advance to next slide if configured)
- Handle video loading states (spinner while buffering)

### Frontend — Presentation Editor

#### `src/routes/presentations/$presentationId.tsx` (UPDATE)
- Add video slide creation option in the slide type selector
- Handle video file uploads (copy to app data directory or embed in .slja archive)

### Backend — Archive Module

#### `src-tauri/src/archive/mod.rs` (UPDATE)
- Update .slja archive structure to include video files:
  ```
  presentation.slja (ZIP)
    manifest.json
    slides/
      001.json
      002.json (type: 'video', videoPath: 'media/video_001.mp4')
    media/
      background_001.png
      audio_track.mp3
      video_001.mp4         // Video files stored here
    thumbnails/
      001.png
  ```
- Update `read_slja()` to extract video files
- Update `write_slja()` to include video files in the archive

### Backend — File Handling

#### `src-tauri/src/commands/utility.rs` (UPDATE — or create if doesn't exist)
- Add command: `copy_video_to_media(video_path: String, presentation_id: i64) -> Result<String, AppError>`
  - Copies the selected video file to the app's media directory
  - Returns the relative path for storage in the slide content JSON
- Add command: `get_video_metadata(path: String) -> Result<VideoMetadata, AppError>`
  - Returns: duration, width, height, file size, format
  - Uses basic file I/O and path parsing (or a lightweight video metadata crate if needed)

### Backend — Models

#### `src-tauri/src/db/models.rs` (UPDATE)
- Add `VideoMetadata` struct: `{ duration_ms: u64, width: u32, height: u32, file_size: u64, format: String }`

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register video-related commands: `copy_video_to_media`, `get_video_metadata`

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `copyVideoToMedia(videoPath: string, presentationId: number): Promise<string>`
  - `getVideoMetadata(path: string): Promise<VideoMetadata>`

### Frontend — Projector View

#### `src/components/slides/projector-view.tsx` (UPDATE)
- Add video playback support in projector output
- Handle video slide transitions (fade out video before next slide)
- Auto-advance to next slide when video ends (if configured)

### Frontend — Video Format Validation

#### `src/lib/utils.ts` (UPDATE)
- Add `isVideoFormatSupported(filename: string): boolean` utility
  - Returns true for .mp4, .webm
  - Returns false for .avi, .mkv, .mov, etc.
- Add `getConversionRecommendation(format: string): string` utility
  - Returns a user-friendly message recommending FFmpeg or online converters for unsupported formats

---

## Notes

- **No FFmpeg bundling:** To keep the app size small and avoid licensing complexity, unsupported video formats will require user conversion before import.
- **Recommendation message:** "This video format is not supported. Please convert to MP4 or WebM using a tool like HandBrake or FFmpeg."
- **Performance consideration:** Large video files embedded in .slja archives can make files very large. Consider adding a warning when adding videos over 100MB.
