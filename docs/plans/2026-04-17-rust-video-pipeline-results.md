# Rust Video Pipeline Migration — QA Results

**Plan:** [2026-04-17-rust-video-pipeline.md](./2026-04-17-rust-video-pipeline.md)
**Branch:** `feat/rust-video-pipeline`
**Status:** Pending first pass — template ready for operator fill-in

---

## 6.1 Test Matrix

Run each scenario on each platform with `useRustVideoPipeline` flag **ON** (Settings → Experimental).
Tick the checkbox after manual verification; add notes for any deviation.

| # | Scenario | macOS (arm/intel) | Windows 10/11 | Linux (Ubuntu 22.04) | Notes |
|---|---|---|---|---|---|
| 1 | YouTube video, 3 screens, control via main window | [ ] | [ ] | [ ] | — |
| 2 | Local downloaded video, 3 screens | [ ] | [ ] | [ ] | — |
| 3 | Play → pause → seek → resume | [ ] | [ ] | [ ] | — |
| 4 | Loop mode (Repeat/Repeat1 toggle) | [ ] | [ ] | [ ] | — |
| 5 | Queue advance to next video (EOS) | [ ] | [ ] | [ ] | — |
| 6 | Blackscreen overlay mid-playback (B key) | [ ] | [ ] | [ ] | — |
| 7 | App restart preserves flag state | [ ] | [ ] | [ ] | — |
| 8 | Disconnect projector mid-play (monitor unplug) | [ ] | [ ] | [ ] | — |

### Known issues / deviations

- _(fill during testing)_

---

## 6.2 Perf Benchmarks

Baseline: measure with flag **OFF** (legacy pipeline) first, then compare with flag **ON** (Rust pipeline).

| Metric | Target (Rust vs legacy) | Baseline (flag OFF) | Rust (flag ON) | Δ | Pass? |
|---|---|---|---|---|---|
| CPU % during 1080p YouTube playback | ≤ legacy - 20% | TBD | TBD | TBD | [ ] |
| Memory RSS during playback | ≤ legacy + 100 MB | TBD | TBD | TBD | [ ] |
| Inter-screen sync delta | < 50 ms | TBD | TBD | — | [ ] |
| Control latency (click Play → first frame) | < 200 ms | TBD | TBD | TBD | [ ] |

### Measurement methodology

- **CPU / memory:** `Activity Monitor` (macOS), `Task Manager` / `perfmon` (Windows), `top` / `htop` (Linux). Sample over 60 s of steady playback; record the median value.
- **Sync delta:** high-speed camera capturing both screens side-by-side, OR a frame-ID overlay burned into the stream (requires adding a debug filter to the pipeline — out of scope for this phase).
- **Control latency:** instrumented log timestamps on click event + first `videoPipelineState` event with `paused=false`. Use `console.time` / `performance.now()` on the frontend side.

### Environment

- Machine specs: _(fill: CPU model, RAM, GPU, OS version)_
- Video test asset: _(URL or filename — recommended: 1080p60 YouTube clip + a downloaded 1080p MP4 mirror of it for parity)_
- Network: _(LAN / wifi / tethered)_
- Build under test: _(commit SHA + build type — release bundle preferred)_

---

## Smoke test checklist (per platform)

Run before declaring a platform "verified":

1. Install release build on a clean machine (no GStreamer previously installed on macOS/Windows).
2. Enable `useRustVideoPipeline` in Settings → Experimental.
3. Open projector window (`F5`).
4. Add a YouTube video to the Playing Now queue.
5. Verify live playback on both main + projector (and return monitor if configured).
6. Press `B` for blackscreen — projector blacks out, audio continues.
7. Press `B` again — video resumes visibly in sync.
8. Toggle loop → icon changes to `Repeat1`.
9. Fast-seek near end, wait for EOS, verify video loops back to 0 (loop = one).
10. Toggle loop off, wait for EOS, verify queue advances to next item.
11. Close projector window — verify app stays responsive.
12. Restart app — verify `useRustVideoPipeline` flag state persists.

---

## References

- Plan: [`docs/plans/2026-04-17-rust-video-pipeline.md`](./2026-04-17-rust-video-pipeline.md)
- Implementation commits: `fedda74`..`0d1815e` on `feat/rust-video-pipeline`
- Phase 3 audit: verbal audit in chat log (not archived separately)
- Phase 4 flag-gate changes: see `useRustVideoPipeline` references in `src/stores/` and `src-tauri/src/video/`
- Phase 5 follower changes: see `VideoFollowerElement` + `video-control-cmd` event contract

---

## Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Operator (manual QA) | _(fill)_ | _(fill)_ | — |
| Reviewer | _(fill)_ | _(fill)_ | — |
