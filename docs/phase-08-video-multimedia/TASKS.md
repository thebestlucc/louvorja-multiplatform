# Phase 08 Tasks — Video & Multimedia

## Execution Rules

1. Execute batches in order.
2. Do not start the next batch until the current batch verification passes.
3. Keep all existing behavior for non-video slides unchanged.
4. Every new user-facing string must be added to `en.json`, `pt.json`, and `es.json`.

## Global Verification Commands

Run after each completed batch (or at least each integration batch):

```bash
pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform tsc --noEmit
cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml
pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform vite build
```

---

## Batch 0 — Baseline Snapshot

### Goal
Confirm baseline before Phase 08 coding starts.

### Tasks
1. Run global verification commands.
2. Capture `git status` snapshot in implementation notes/PR description.

### Exit Criteria
1. Build/check commands pass.
2. Baseline state documented.

---

## Batch 1 — Video Data Contract (Frontend Types)

### Goal
Expand `video` slide shape so editor and renderer can express required behavior.

### Files
- `src/types/presentation.ts`

### Tasks
1. Replace minimal video variant with full `VideoSlideContent` shape:
   - `videoPath`, `autoPlay`, `loop`, `muted`, `mode`, `text?`, `textColor?`, `textSize?`.
2. Update `SlideContent` union to use expanded video variant.
3. Update conversion helpers:
   - `slideContentToFlat`
   - `flatToSlideContent`
4. Keep backward compatibility for existing saved data when possible.

### Exit Criteria
1. TypeScript compiles with the new model.
2. Existing non-video conversion paths remain unchanged.

---

## Batch 2 — Backend Video Metadata and Media Copy Commands

### Goal
Create backend primitives to ingest video files and provide metadata.

### Files
- `src-tauri/src/db/models.rs`
- `src-tauri/src/commands/utility.rs`
- `src-tauri/src/lib.rs`

### Tasks
1. Add `VideoMetadata` model in Rust.
2. Implement `copy_video_to_media(video_path, presentation_id)`:
   - validate source path exists
   - copy into app-managed media folder
   - return relative media path
3. Implement `get_video_metadata(path)`:
   - return `duration_ms`, `width`, `height`, `file_size`, `format`
   - return explicit error on invalid file
4. Register both commands in Tauri invoke handler.

### Exit Criteria
1. Commands compile and are callable via Tauri.
2. Errors are returned through `AppError` (no panics).

---

## Batch 3 — Frontend Wrappers, Queries, and Validation Utilities

### Goal
Expose backend video capabilities to React and add shared format helpers.

### Files
- `src/lib/tauri.ts`
- `src/lib/queries.ts`
- `src/lib/utils.ts`
- `src/types` (if a dedicated `VideoMetadata` TS type is added)

### Tasks
1. Add wrappers:
   - `copyVideoToMedia(videoPath, presentationId)`
   - `getVideoMetadata(path)`
2. Add query/mutation hooks for metadata and media copy.
3. Add utility helpers:
   - `isVideoFormatSupported(filename)`
   - `getConversionRecommendation(format)`
4. Ensure wrappers and hooks follow existing naming/style patterns.

### Exit Criteria
1. Hooks compile and can be imported from editor components.
2. Utility helpers return deterministic values for supported/unsupported formats.

---

## Batch 4 — Create Video Components

### Goal
Build reusable UI components for playback and media selection.

### Files
- `src/components/slides/video-player.tsx`
- `src/components/slides/video-slide.tsx`
- `src/components/slides/video-picker.tsx`

### Tasks
1. Implement `video-player.tsx` with HTML5 `<video>` wrapper and playback events.
2. Implement `video-slide.tsx`:
   - fullscreen mode
   - background mode with optional text overlay
3. Implement `video-picker.tsx`:
   - select file
   - format validation
   - metadata display
   - unsupported format guidance

### Exit Criteria
1. Components render independently without runtime errors.
2. `video-picker` blocks unsupported formats with clear message.

---

## Batch 5 — Integrate Video into Slide Editor

### Goal
Enable creating and editing video slides in the existing presentation editor.

### Files
- `src/components/slides/slide-editor.tsx`
- `src/routes/presentations/$presentationId.tsx`
- `src/hooks/use-presentation.ts` (if behavior adjustments are needed)
- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`

### Tasks
1. Add `"video"` option in editor slide type selector.
2. Wire `video-picker` and video-specific fields.
3. Persist full video config through existing save pipeline.
4. Add all new i18n keys in 3 locales.

### Exit Criteria
1. Operator can create a video slide and save it.
2. Reopening the presentation preserves all video fields.

---

## Batch 6 — Slide Renderer + Projector Playback Lifecycle

### Goal
Render video slides in projection flow with predictable lifecycle behavior.

### Files
- `src/components/slides/slide-renderer.tsx`
- `src/components/slides/projector-view.tsx`
- `src/components/slides/video-slide.tsx` (if lifecycle wiring lives there)

### Tasks
1. Add `video` branch in `slide-renderer`.
2. Ensure projector activation/deactivation controls playback state correctly.
3. Handle `onEnded` behavior for configured auto-advance policy.
4. Preserve overlay behavior (black/logo) compatibility.

### Exit Criteria
1. Video plays correctly in projector mode.
2. Moving away from video slide pauses/stops playback cleanly.

---

## Batch 7 — Archive Roundtrip Support for Video Media

### Goal
Guarantee `.slja` export/import preserves video slides and media files.

### Files
- `src-tauri/src/archive/mod.rs`
- `src-tauri/src/archive/manifest.rs` (if needed)
- `src-tauri/src/commands/slides.rs` (if path handling changes are required)

### Tasks
1. Ensure export includes referenced video files under media paths.
2. Ensure import restores video references usable by renderer.
3. Keep compatibility with existing `.slja` presentations.

### Exit Criteria
1. Exported + re-imported presentation keeps playable video slides.
2. No regressions in non-video archives.

---

## Batch 8 — End-to-End Smoke and Completion

### Goal
Validate Phase 08 acceptance criteria and close documentation.

### Tasks
1. Run global verification commands.
2. Manual smoke:
   - create video slide
   - project video
   - verify end behavior
   - export/import archive and re-project
   - test unsupported format warning
3. Update progress docs once acceptance is met.

### Exit Criteria
1. All Phase 08 acceptance criteria from `SPECS.md` are met.
2. Docs/status are synchronized with implementation.

---

## Suggested Commit Slicing

1. `phase-08: video model + backend commands`
2. `phase-08: wrappers hooks and utils`
3. `phase-08: video components and editor integration`
4. `phase-08: renderer projector archive roundtrip`
5. `phase-08: docs and validation`
