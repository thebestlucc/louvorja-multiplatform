---
feature: installers-pipeline
gate: 7
date: 2026-02-18
status: approved
phase_map: feature-map.md
---

# Gate 7: Task Breakdown — Installation Guide & Release Pipeline

## Phase A: Foundation (Pipeline Fixes)

### TASK-001: Fix signing environment variable names in release workflow
**Category:** Bug fix
**Feature:** F-001 (Pipeline Bug Fixes)
**Priority:** P0 — Critical (blocks all update signatures)
**Value:** Without this fix, .sig files are not generated, breaking the entire auto-updater.

**Success Criteria:**
- [ ] `TAURI_PRIVATE_KEY` renamed to `TAURI_SIGNING_PRIVATE_KEY` in release.yml:48
- [ ] `TAURI_KEY_PASSWORD` renamed to `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in release.yml:49
- [ ] Build produces .sig files alongside installers

**Files:** `.github/workflows/release.yml` (lines 48-49)

---

### TASK-002: Add updater permission to capabilities
**Category:** Bug fix
**Feature:** F-002 (Updater Permission Fix)
**Priority:** P0 — Critical (blocks updater at runtime)
**Value:** Without this, `check_for_updates` and `install_update` commands silently fail.

**Success Criteria:**
- [ ] `"updater:default"` added to permissions array in capabilities/default.json (after line 28)
- [ ] Update check succeeds at runtime (no permission error)

**Files:** `src-tauri/capabilities/default.json` (permissions array, line 10-29)

---

### TASK-003: Add Linux system dependencies to CI workflow
**Category:** Bug fix
**Feature:** F-003 (Linux Build Dependencies)
**Priority:** P0 — Critical (Linux build fails without this)
**Value:** Enables Linux builds to succeed in CI.

**Success Criteria:**
- [ ] Conditional `apt-get install` step added for ubuntu platforms
- [ ] Packages: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
- [ ] Step runs before `pnpm install` in the tauri-release job
- [ ] Linux build job succeeds

**Files:** `.github/workflows/release.yml` (insert after toolchain setup, before pnpm install)

---

### TASK-004: Add dual macOS architecture builds
**Category:** Enhancement
**Feature:** F-004 (Dual macOS Architecture)
**Priority:** P1 — High
**Value:** Intel Mac users can install the app.

**Success Criteria:**
- [ ] Matrix split into two macOS entries: `--target aarch64-apple-darwin` and `--target x86_64-apple-darwin`
- [ ] Rust toolchain step installs both targets on macOS
- [ ] Both macOS builds produce .dmg + .sig files
- [ ] Linux deps step condition updated to match both ubuntu entries

**Files:** `.github/workflows/release.yml` (matrix section, lines 38-45)

---

### TASK-005: Add ARM Linux build target
**Category:** Enhancement
**Feature:** F-009 (ARM Linux Build)
**Priority:** P2 — Medium
**Value:** Future-proofs for ARM devices in churches.

**Success Criteria:**
- [ ] New matrix entry for `ubuntu-22.04-arm` with appropriate args
- [ ] Linux deps condition covers both ubuntu entries
- [ ] ARM build produces AppImage + .sig

**Files:** `.github/workflows/release.yml` (matrix section)

---

### TASK-006: Add Rust build caching to CI
**Category:** Enhancement
**Feature:** F-006 (Build Caching)
**Priority:** P1 — High
**Value:** Reduces build time from ~30min to ~15min per platform.

**Success Criteria:**
- [ ] `swatinem/rust-cache@v2` step added after Rust toolchain setup
- [ ] Configured with `workspaces: './src-tauri -> target'`
- [ ] Cache hit on second run of same platform

**Files:** `.github/workflows/release.yml` (insert after dtolnay/rust-toolchain step)

---

## Phase B: Safe Updates (UX)

### TASK-007: Implement service-aware update guard
**Category:** Feature
**Feature:** F-007 (Service-Aware Update Guard)
**Priority:** P0 — Critical (zero tolerance for service disruption)
**Value:** Updates NEVER interrupt live worship services.

**Success Criteria:**
- [ ] UpdateNotification reads `isProjectorOpen`, `isPlayingService`, `activeServiceId` from presentation store
- [ ] When any guard condition is true, banner is suppressed
- [ ] `pendingUpdate` state tracks deferred update
- [ ] Uses Zustand subscribe pattern (not stale closure)
- [ ] Guard subscription cleans up on unmount
- [ ] Dismissed/skipped state preserved across guard transitions
- [ ] Banner appears within 2 seconds of all guards clearing

**Files:** `src/components/update-notification.tsx` (major modification)

---

### TASK-008: Implement pastoral error messaging
**Category:** Feature
**Feature:** F-008 (Pastoral Error Messaging)
**Priority:** P1 — High
**Value:** Non-technical users understand what happened during update failures.

**Success Criteria:**
- [ ] `classifyUpdateError()` utility function created
- [ ] Classifies errors into: network, disk_space, permission, generic
- [ ] Error toast uses 4-part pastoral pattern (what, why, action, reassurance)
- [ ] Error toasts are persistent (no auto-dismiss)
- [ ] Raw `String(error)` on line 65 replaced with structured message
- [ ] All error messages localized in PT/EN/ES

**Files:**
- `src/lib/update-errors.ts` (new ~15 lines)
- `src/components/update-notification.tsx` (modify error handler, line 58-66)
- `src/locales/en.json`, `pt.json`, `es.json` (add 15 new keys each)

---

### TASK-009: Add status bar update indicator
**Category:** Feature
**Feature:** F-007 (Service-Aware Update Guard — indicator)
**Priority:** P1 — High
**Value:** Users know an update is waiting without being distracted during service.

**Success Criteria:**
- [ ] `StatusBarUpdateIndicator` component created (~20 lines)
- [ ] Shows download icon + green dot when `pendingUpdate && guardActive`
- [ ] Tooltip with localized text: "Update available — will notify after service"
- [ ] `aria-label` matches tooltip
- [ ] Integrated in status-bar.tsx (after ProjectorControls, ~line 55)
- [ ] Follows existing status bar indicator pattern (same styling as timer/streaming buttons)

**Files:**
- `src/components/layout/status-bar-update-indicator.tsx` (new ~20 lines)
- `src/components/layout/status-bar.tsx` (add import + render, ~line 55)

---

### TASK-010: Add i18n keys for update guard and errors
**Category:** Feature
**Feature:** F-007, F-008
**Priority:** P1 — High (blocks TASK-007, TASK-008, TASK-009)
**Value:** All update UI text localized in 3 languages.

**Success Criteria:**
- [ ] 15 new keys added to `updater` namespace in `en.json` (lines 630-636)
- [ ] Same 15 keys added to `pt.json` with Portuguese translations
- [ ] Same 15 keys added to `es.json` with Spanish translations
- [ ] Keys: guardActive, errorNetwork, errorNetworkWhy, errorNetworkAction, errorDiskSpace, errorDiskSpaceWhy, errorDiskSpaceAction, errorPermission, errorPermissionWhy, errorPermissionAction, errorGeneric, errorGenericWhy, errorGenericAction, errorDataSafe, tryAgain

**Files:** `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`

---

## Phase C: User Guides (Documentation)

### TASK-011: Write Windows installation guide
**Category:** Documentation
**Feature:** F-005 (Installation Guides)
**Priority:** P1 — High
**Value:** Windows users (largest audience) can self-install.

**Success Criteria:**
- [ ] Step-by-step guide in English, Portuguese, Spanish
- [ ] Addresses SmartScreen warning with screenshots/descriptions
- [ ] Covers per-user install (no admin) and admin install options
- [ ] Includes "Verify your installation" section
- [ ] Maximum 10 steps
- [ ] Written for Dona Maria persona (non-technical)

**Files:** `docs/installation/windows.md` (new), `docs/installation/windows-pt.md` (new), `docs/installation/windows-es.md` (new)

---

### TASK-012: Write macOS installation guide
**Category:** Documentation
**Feature:** F-005 (Installation Guides)
**Priority:** P1 — High
**Value:** macOS users can self-install despite Gatekeeper warnings.

**Success Criteria:**
- [ ] Step-by-step guide in 3 languages
- [ ] Addresses Gatekeeper "unidentified developer" warning
- [ ] Standard drag-to-Applications pattern
- [ ] Includes "Verify your installation" section
- [ ] Maximum 10 steps

**Files:** `docs/installation/macos.md` (new), `docs/installation/macos-pt.md` (new), `docs/installation/macos-es.md` (new)

---

### TASK-013: Write Linux installation guide
**Category:** Documentation
**Feature:** F-005 (Installation Guides)
**Priority:** P1 — High
**Value:** Linux users can install from AppImage or .deb.

**Success Criteria:**
- [ ] Step-by-step guide in 3 languages
- [ ] Covers AppImage (download, make executable, run) and .deb (dpkg -i)
- [ ] Addresses missing dependencies
- [ ] Includes "Verify your installation" section
- [ ] Maximum 10 steps

**Files:** `docs/installation/linux.md` (new), `docs/installation/linux-pt.md` (new), `docs/installation/linux-es.md` (new)

---

### TASK-014: Write code signing setup guide
**Category:** Documentation
**Feature:** F-012 (Code Signing Documentation)
**Priority:** P2 — Medium
**Value:** Maintainers have a roadmap for future code signing.

**Success Criteria:**
- [ ] macOS: Developer program, certificate generation, notarization, CI secrets
- [ ] Windows: OV vs EV trade-offs, certificate acquisition, CI secrets
- [ ] Costs documented
- [ ] Written for Ricardo persona (technical)

**Files:** `docs/code-signing-guide.md` (new)

---

## Phase D: Polish

### TASK-015: Verify onboarding works offline
**Category:** Verification
**Feature:** F-010 (Onboarding Refinements)
**Priority:** P2 — Medium
**Value:** New users in churches with no internet can still onboard.

**Success Criteria:**
- [ ] Audit onboarding flow for network calls
- [ ] All onboarding text exists in all 3 locales
- [ ] No error on first launch with network disabled

**Files:** `src/lib/onboarding.ts`, `src/stores/onboarding-store.ts`, locale files

---

### TASK-016: Add version display
**Category:** Feature
**Feature:** F-011 (Version Visibility)
**Priority:** P2 — Medium
**Value:** IT admins can verify machine versions match.

**Success Criteria:**
- [ ] Version number visible in settings or status bar
- [ ] Format: "LouvorJA v0.1.0"
- [ ] Reads from Tauri app info

**Files:** `src/components/layout/status-bar.tsx` or settings page

---

## Task Dependency Graph

```
TASK-001 (env vars) ──┬──→ TASK-003 (linux deps) ──→ TASK-005 (ARM linux)
                      ├──→ TASK-004 (dual macOS)
                      ├──→ TASK-006 (caching)
                      └──→ TASK-002 (updater perm) ──→ TASK-010 (i18n) ──┬──→ TASK-007 (guard)
                                                                          ├──→ TASK-008 (errors)
                                                                          └──→ TASK-009 (indicator)

TASK-001 + TASK-003 + TASK-004 ──→ TASK-011 (Windows guide)
                                    TASK-012 (macOS guide)
                                    TASK-013 (Linux guide)

Independent: TASK-014, TASK-015, TASK-016
```

## Summary

| Phase | Tasks | Priority | Estimated Effort |
|-------|-------|----------|-----------------|
| A: Foundation | TASK-001 to TASK-006 | P0-P2 | Small (config changes) |
| B: Safe Updates | TASK-007 to TASK-010 | P0-P1 | Medium (~100 lines code + i18n) |
| C: User Guides | TASK-011 to TASK-014 | P1-P2 | Medium (documentation) |
| D: Polish | TASK-015 to TASK-016 | P2 | Small (verification + minor) |
| **Total** | **16 tasks** | | |
