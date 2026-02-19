---
feature: installers-pipeline
gate: 9
date: 2026-02-18
status: approved
---

# Gate 9: Delivery Roadmap — Installation Guide & Release Pipeline

## Timeline Overview

| Phase | Name | Tasks | Critical Path | Estimated Duration |
|-------|------|-------|--------------|-------------------|
| A | Foundation | TASK-001 to TASK-006 | Yes — unblocks everything | COMPLETE |
| B | Safe Updates | TASK-007 to TASK-010 | Yes — core UX value | COMPLETE |
| C | User Guides | TASK-011 to TASK-014 | No — can ship without | COMPLETE |
| D | Polish | TASK-015 to TASK-016 | No — quality of life | COMPLETE |
| **Total** | | **16 tasks** | | **~2.5 hours implementation** |

## Critical Path

```
TASK-001 → TASK-002 → TASK-010 → TASK-007
(env vars)  (perm)     (i18n)     (guard)
```

This is the minimum path to "pipeline works + updates don't disrupt services." Everything else is parallel or non-blocking.

## Phase A: Foundation

**Goal:** Fix the pipeline so it produces working artifacts for all 5 platforms.
**Entry criteria:** None (start here)
**Exit criteria:** All 6 tasks complete, workflow file updated

| Task | Description | Depends On | Effort |
|------|-------------|-----------|--------|
| TASK-001 | Fix signing env var names | — | 2 min |
| TASK-002 | Add updater permission | — | 2 min |
| TASK-003 | Add Linux system deps | TASK-001 | 3 min |
| TASK-004 | Dual macOS architecture | TASK-001 | 5 min |
| TASK-005 | ARM Linux build | TASK-003 | 2 min |
| TASK-006 | Rust build caching | TASK-001 | 3 min |

**Parallelism:** TASK-001 and TASK-002 are independent (can be done simultaneously). TASK-003/004/005/006 all depend on TASK-001 but are independent of each other.

**Verification:** Commit and push tag → watch CI → all 5 platform jobs should pass (or at least start correctly).

---

## Phase B: Safe Updates

**Goal:** Update notifications respect live services; errors are friendly.
**Entry criteria:** Phase A complete (TASK-002 specifically for updater permission)
**Exit criteria:** Guard works, errors are pastoral, all i18n keys present

| Task | Description | Depends On | Effort |
|------|-------------|-----------|--------|
| TASK-010 | Add i18n keys (3 locales) | — | 13 min |
| TASK-008 | Pastoral error messaging | TASK-010 | 8 min |
| TASK-007 | Service-aware guard | TASK-010 | 10 min |
| TASK-009 | Status bar indicator | TASK-007 | 8 min |

**Parallelism:** TASK-008 and TASK-007 can run in parallel after TASK-010. TASK-009 depends on TASK-007.

**Verification:**
1. `pnpm vite build && npx tsc --noEmit` passes
2. `pnpm tauri dev` → open projector → verify no update banner appears
3. Close projector → verify banner appears (if update available)
4. Simulate error → verify pastoral toast in current language

---

## Phase C: User Guides

**Goal:** Users of all skill levels can install without help.
**Entry criteria:** Phase A complete (need to know exact artifact names)
**Exit criteria:** 9 guide files (3 platforms × 3 languages) + code signing guide

| Task | Description | Depends On | Effort |
|------|-------------|-----------|--------|
| TASK-011 | Windows guide (3 languages) | TASK-001 | 11 min |
| TASK-012 | macOS guide (3 languages) | TASK-004 | 11 min |
| TASK-013 | Linux guide (3 languages) | TASK-003 | 11 min |
| TASK-014 | Code signing guide | — | 5 min |

**Parallelism:** All 4 tasks are independent of each other. Can be done simultaneously.

**Verification:** Review each guide for ≤10 steps, security warning coverage, verify section, and non-technical language.

---

## Phase D: Polish

**Goal:** Offline onboarding verified, version visible.
**Entry criteria:** Phase B complete
**Exit criteria:** Onboarding offline-safe, version displayed

| Task | Description | Depends On | Effort |
|------|-------------|-----------|--------|
| TASK-015 | Verify onboarding offline | — | 9 min |
| TASK-016 | Version display | — | 5 min |

**Parallelism:** Both tasks are independent.

**Verification:** `pnpm tauri dev` with network disabled → onboarding works. Version visible in status bar.

---

## Resource Allocation

**Single developer** — all phases executed sequentially by one person (as specified in PRD).

**Recommended execution order:**
1. Phase A (all tasks) → commit
2. Phase B (TASK-010 first, then 007/008 parallel, then 009) → commit
3. Phase C (all guides parallel) → commit
4. Phase D (both tasks) → commit
5. Final verification → tag release

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| ARM Linux runner unavailable | Medium | Low (P2 feature) | Skip TASK-005, defer to next release |
| Update guard stale closure bug | Medium | Critical | Use documented `getState()` pattern; test with projector open/close |
| Existing updater returns unexpected errors | Low | Medium | Generic fallback always catches; error classifier is defensive |
| macOS dual-arch build fails | Low | Medium | Test one target first, add second; official Tauri docs have exact pattern |
| i18n keys missing in one locale | Low | Medium | Checklist verification; search for all 15 keys in each file |

---

## Definition of Done

The feature is complete when:

- [x] **Pipeline:** CI builds and produces artifacts for all 5 platforms
- [x] **Pipeline:** .sig signature files generated alongside all installers
- [x] **Pipeline:** Build time <20 min per platform (with cache)
- [x] **Pipeline:** Draft release created with all artifacts
- [x] **Updater:** Permission fix allows update checks at runtime
- [x] **Guard:** Update notification suppressed during projection/service
- [x] **Guard:** Status bar indicator visible when update deferred
- [x] **Guard:** Notification appears within 2s of guard clearing
- [x] **Errors:** Pastoral error messages in PT/EN/ES
- [x] **Errors:** Error toasts don't auto-dismiss
- [x] **Guides:** 9 installation guide files (3 platforms × 3 languages)
- [x] **Guides:** Code signing setup guide
- [x] **Polish:** Onboarding works offline
- [x] **Polish:** Version visible in app
- [x] **Code:** `pnpm vite build && npx tsc --noEmit` passes
- [x] **Code:** `cargo build --manifest-path src-tauri/Cargo.toml` passes

---

## Post-Delivery

After this feature ships:
- Monitor first CI release for platform-specific failures
- Collect feedback on installation guides from first church deployments
- Track update adoption rate across versions
- Consider code signing certificate purchase based on user feedback about OS warnings
