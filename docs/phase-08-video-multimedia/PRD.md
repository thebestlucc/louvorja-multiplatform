# Phase 08 PRD — Video & Multimedia

## 1. Context

LouvorJA already supports text, lyrics, Bible, and image projection. Worship teams now need native video slides inside presentations so they can run complete services without external media tools for common scenarios.

## 2. Problem Statement

Operators cannot reliably run video moments (openings, backgrounds, testimonies, transitions) in the same slide workflow used for projection and return monitors.

Current pain points:
- Video slide type is not fully supported in editor and projection flows.
- There is no first-class media import/metadata flow for videos.
- Projector behavior is not defined for video lifecycle (activation, deactivation, end).

## 3. Goals

1. Allow operators to create and edit video slides in the same presentation editor flow.
2. Ensure projector output can render video slides reliably in worship context.
3. Provide a safe media ingestion path with format validation and clear user feedback.
4. Keep archive portability (`.slja`) when presentations include video assets.

## 4. Non-Goals

- No FFmpeg bundling in this phase.
- No advanced NLE timeline editing features.
- No cross-device live video sync protocol beyond current projector/return architecture.
- No streaming video transcoding pipeline.

## 5. Users and Primary Jobs

### Primary user
- Worship operator who prepares and runs service media.

### Jobs to be done
- Add a video slide to a presentation quickly.
- Configure playback behavior (autoplay, loop, muted, mode).
- Run video in projector without leaving LouvorJA.
- Preserve videos when exporting/importing presentation archives.

## 6. User Stories

1. As an operator, I want to pick a video file for a slide, so I can use multimedia moments in my service flow.
2. As an operator, I want to preview video behavior in the editor, so I trust what will happen on projector.
3. As an operator, I want format validation and metadata feedback, so I know whether a file is usable before projection.
4. As an operator, I want video slides to open/export/import with the presentation archive, so teams can share content between machines.
5. As an operator, I want clear projector behavior when a video ends, so service flow remains predictable.

## 7. Success Metrics

### Product metrics
- 100% of newly created video slides can be reopened and edited without data loss.
- 100% of valid MP4/WebM samples play on projector in manual smoke tests.
- 0 critical regressions in existing non-video slide types after release.

### UX metrics
- Operator can add and configure a video slide in under 30 seconds (manual usability walkthrough).
- Unsupported format errors are explicit and actionable (no silent failure).

## 8. Scope

### In scope
- Video slide data model expansion.
- Video metadata command support.
- Video file copy-to-media workflow.
- Editor components for video picking and configuration.
- Renderer/projector support for video mode and lifecycle.
- `.slja` archive support for video media.

### Out of scope
- Video trimming, filters, subtitle timeline editing.
- Automatic format conversion.
- Cloud/offline sync for large media libraries.

## 9. Dependencies

- Depends on existing presentation architecture (Phase 3).
- Reuses current projector/return event model (Phase 6) and command wrapper pattern.

## 10. Risks and Mitigations

1. Large files may degrade UX.
   - Mitigation: metadata surface + warning threshold for large files.
2. Unsupported formats may frustrate operators.
   - Mitigation: clear recommendation text for MP4/WebM conversion path.
3. Playback regressions on projector route.
   - Mitigation: explicit acceptance suite for slide activation/deactivation/end behavior.

## 11. Phase Exit Criteria

Phase 08 is complete when:
1. Operators can create/edit/project video slides in editor + projector flow.
2. Video file validation and metadata retrieval are available in-app.
3. `.slja` import/export preserves video slides and media files.
4. Build and check commands pass and targeted manual video smoke scenarios pass.
