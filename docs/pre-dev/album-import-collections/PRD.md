# PRD — Album-Based Import: API Albums → Collections

**Feature:** Album Import as Collections with Slide Backgrounds
**Date:** 2026-02-22
**Status:** Ready for Implementation
**Track:** Large (≥2 days, new data model, new import flow)

---

## 1. Problem Statement

The current legacy fetch wizard imports musics/hymns from the LouvorJA API but completely ignores albums. Albums are fetched by a dead-code function (`fetch_albums`), the `album` field is never populated, and hymns have no organizational grouping tied to the API source.

Users who import from the API end up with a flat list of hymns in the Hymnal tab — no album art, no grouping, no visual differentiation. The Collections feature (Phase 11) was built for file-based imports only.

---

## 2. Goals

1. **Group imported hymns by album** — each API album becomes a Collection (coletânea) with cover art.
2. **Download and display cover images** — per-album and per-hymn `url_image` from the API used as slide backgrounds.
3. **Enable "Restore from API"** — users can re-fetch a hymn's original data (lyrics, cover, audio) after manual edits.
4. **Unify Collections page** — file-based (`.slja`/`.pptx`) and API-imported albums share one page with tab separation.
5. **Backward compatibility** — existing data and file-based collections are entirely unaffected.

---

## 3. Non-Goals

- Editing album membership (hymn ↔ collection links) — read-only from API perspective.
- Converting `.bmp` album covers to JPEG — download as-is.
- Streaming or syncing albums in real-time — import is a one-time (or re-runnable) wizard step.
- Online-first browsing of the API — app remains offline after import.

---

## 4. User Stories

### US-01 — Album Import via Wizard
> As a worship leader, I want to import albums from the LouvorJA API so that my hymns are organized by album with cover art, not as a flat list.

**Acceptance Criteria:**
- The Legacy Fetch Wizard has an "Import Albums as Collections" toggle (default: on).
- Running the wizard with this option creates one Collection per API album.
- Each Collection has a cover image (downloaded from `url_image`).
- All hymns within an album are imported and linked to that Collection.
- Re-running the wizard does not create duplicate collections or hymns.
- Progress events are shown per-album and per-hymn during import.

---

### US-02 — Browse Albums in Collections Page
> As a user, I want to see API-imported albums and file-based collections in separate tabs on the Collections page.

**Acceptance Criteria:**
- Collections page has two tabs: "Albums" and "Custom Collections".
- "Albums" tab shows only API-imported collections (`source_type = 'api'`).
- "Custom Collections" tab shows only file-based collections (`source_type = 'file'`).
- Each album card displays cover art and hymn count.
- The create/import button is only available in "Custom Collections".

---

### US-03 — Album Collection Detail View
> As a user, I want to open an album and see all its hymns with covers and track numbers, and navigate to each hymn.

**Acceptance Criteria:**
- Collection detail page renders a hymn list when `source_type = 'api'`.
- Each hymn card shows: cover image, title, track number.
- Clicking a hymn card navigates to `/hymnal/{hymnId}`.
- File-based collection detail is unchanged.

---

### US-04 — Lyrics Slides with Album Art Background
> As a projectionist, I want hymn lyrics slides to automatically use the hymn's cover image as background, so slides look polished without manual setup.

**Acceptance Criteria:**
- When a hymn has a `cover_path`, `hymnToSlides()` sets `backgroundImage` on all lyrics and cover slides.
- The background applies at projection time (projector window renders the image).
- Users can override background per-slide manually via the slide editor — this is pre-existing behavior.

---

### US-05 — Restore Hymn from API
> As a user, I want to restore a hymn's original data (lyrics, cover, audio URL) from the LouvorJA API in case I edited it by mistake.

**Acceptance Criteria:**
- Hymn detail page shows a "Restore from API" button when the hymn has an `api_music_id`.
- Clicking it re-fetches data from `/{lang}/musics/{api_music_id}` and updates the hymn.
- A success toast is shown on completion.
- The hymn query cache is invalidated so the UI reflects fresh data.

---

## 5. Success Metrics

| Metric | Target |
|--------|--------|
| Albums imported per run (pt locale) | ~75 albums, ~525 hymns |
| Duplicate collections on re-import | 0 |
| Duplicate hymns on re-import | 0 |
| Existing file-based collections broken | 0 |
| Existing hymnal (Hinário) import broken | 0 |
| Projection shows background images | 100% of hymns with `cover_path` |

---

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API rate limiting (~525 calls) | Medium | Medium | Sequential processing with cancel support |
| Album covers are `.bmp` (large files) | High | Low | Download as-is; renderer handles any format |
| Same music in multiple albums | High | Low | Dedup by `api_music_id`; multiple `collection_hymns` links allowed |
| Existing `collections` rows have no `source_type` | Certain | None | `DEFAULT 'file'` ensures backward compat |

---

## 7. Dependencies

- Phase 11 (Hymn CRUD + Collections) — **COMPLETE**
- `legacy_fetch` module with `reqwest` HTTP client — **EXISTS**
- `collections` table and CRUD queries — **EXISTS**
- `StyledSlideMetadata.backgroundImage` in `SlideContent` — **EXISTS**
