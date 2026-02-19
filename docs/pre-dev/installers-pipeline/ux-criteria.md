---
feature: installers-pipeline
gate: 1
date: 2026-02-18
mode: ux-validation
ui_library: "Radix UI primitives with CVA (class-variance-authority)"
styling: "Tailwind CSS v4 with CSS custom properties"
---

# UX Acceptance Criteria: Installation Guide & Release Pipeline

## UX Research Summary

This feature is predominantly infrastructure (CI/CD pipeline fixes, build artifacts, documentation). However, four areas have direct user-facing UI impact: (1) the update notification component needs a service-aware guard to suppress prompts during live worship, (2) error messaging during update failures must follow a pastoral, localized pattern, (3) first-run onboarding receives minor refinements for monitor setup, and (4) external installation guides must be structured for non-technical users in three languages. The highest-priority UX change is the service-aware update guard (US-004), which is a zero-tolerance safety requirement -- an update dialog appearing during a live worship service is a catastrophic UX failure with no recovery.

---

## Problem Validation

### Problem Statement

- **Who:** Church worship teams -- worship leaders (Carlos), non-technical volunteers (Dona Maria), and church IT administrators (Ricardo)
- **What:** Cannot install, update, or trust the application in production. The release pipeline produces broken artifacts (3 critical bugs), no installation guides exist, and the update notification can interrupt live worship services.
- **When:** Installation: when a church first adopts the app. Updates: after each release. Service disruption risk: every time an update is available during a worship service.
- **Impact:** Zero churches can currently install from official releases. 100% of update attempts silently fail (missing `updater:default` permission). Non-technical users have no guidance in their language.

### Evidence

1. **Pipeline bugs are verified in code:** `release.yml:48-49` uses wrong env var names, `capabilities/default.json` is missing `updater:default`, and Linux build has no system deps step.
2. **Existing update-notification.tsx (line 17-19)** enables update checks after a 1500ms delay with NO check for projector state or active service -- the notification WILL appear during live projection.
3. **Phase 10 smoke matrix** confirms most runtime tests are BLOCKED.
4. **Competitor analysis** confirms no competitor implements a service-aware update guard.
5. **Existing i18n keys** confirm the update UI is already localized but lacks error-specific and service-guard keys.

### Validation Status

**VALIDATED** -- The problem is confirmed by code inspection, existing test results, and competitive analysis.

---

## Personas (Installer-Specific Refinements)

### Persona 1: Carlos -- The Worship Leader (Tech-Comfortable)

- **Role:** Worship team leader, 32 years old
- **Goals:** Download, install, and have the app working within 5 minutes. Receive updates without disruption.
- **Pain Points (installer-specific):** OS security warnings erode trust; update prompts during service prep cause anxiety; no clear way to verify latest version across machines.
- **Installation behavior:** Comfortable with standard installers. Will read a one-page guide. Will NOT read a multi-page manual.
- **Update behavior:** Wants "update now" when convenient, "remind later" during prep. Would panic if update appeared during live projection.

### Persona 2: Dona Maria -- The Faithful Volunteer (Non-Technical)

- **Role:** Projection operator during services, 58 years old
- **Goals:** Follow written/visual instructions to install. Never see English-only errors.
- **Pain Points (installer-specific):** Security warnings in English cause freeze; "Install" vs "Run" vs "Open" distinctions are confusing; admin password prompts are terrifying; update dialogs during service cause panic.
- **Installation behavior:** Needs step-by-step visual guide in Portuguese with screenshots for EVERY system dialog.
- **Update behavior:** Should NEVER see update UI during a service. After service, gentle notification in Portuguese with one clear action button.

### Persona 3: Ricardo -- The Church IT Admin (Technical)

- **Role:** Deacon managing 3 church computers, 45 years old
- **Goals:** Standardized, repeatable installation. Version verification across machines. Documented procedures.
- **Pain Points (installer-specific):** Different versions on different machines; no silent install; cannot verify build authenticity; no release notes.
- **Installation behavior:** Will read technical documentation. Wants "verify your installation" checklist.
- **Update behavior:** Wants to review release notes before approving. Wants all machines to converge to the same version.

---

## User Flows

### Flow 1: Update Notification -- Service-Aware Guard (US-004)

This is the highest-priority UI change. The existing `UpdateNotification` component must read presentation store state before rendering.

**Steps:**
1. App starts, 1500ms delay, then checks for updates (existing behavior)
2. If update found, read `usePresentationStore.getState()` for `isProjectorOpen`, `isPlayingService`, `activeServiceId`
3. If ANY of those are active: suppress the notification banner, set `pendingUpdate` flag, show a minimal indicator in the status bar
4. When ALL guards clear: show the full notification banner
5. User interacts with banner (existing 3 buttons + close)
6. On install error: show structured error message following pastoral pattern

**Guard conditions (ALL must be false to show notification):**
- `isProjectorOpen === true`
- `isPlayingService === true`
- `activeServiceId !== null`

**Status bar indicator when guard is active:**
- Small download icon + green dot
- Tooltip: "Update available -- will notify after service"

### Flow 2: Update Notification -- Error Path (US-008)

**Pastoral error message pattern (all localized):**

| Error Type | What Happened | Why | What to Do | Reassurance |
|------------|--------------|-----|------------|-------------|
| Network | "Could not download the update" | "Your internet connection may be unstable" | "Check your connection and try again" | "Your data and settings are safe" |
| Disk space | "Could not install the update" | "There is not enough disk space" | "Free up space and try again" | "Your data and settings are safe" |
| Permission | "Could not install the update" | "The app needs permission to write files" | "Try running as administrator, or contact your IT admin" | "Your data and settings are safe" |
| Generic | "Something went wrong with the update" | "An unexpected error occurred" | "Try again later, or download the latest version from our website" | "Your data and settings are safe" |

### Flow 3: First-Run Onboarding Refinements (US-007)

**No structural changes to onboarding flow.** Refinements limited to:
- Ensuring monitor setup step works offline
- Ensuring all onboarding copy is in all 3 locales
- Adding a "verify installation" confirmation at the end (version number visible)

---

## Wireframe Specifications

### Screen: Update Notification Banner (Modified)

**Normal state (no service active):**
```
┌──────────────────────────────────────────┐
│  Update available                    [X] │
│  Version 1.2.0 is ready to install.      │
│                                          │
│  Bug fixes and performance               │
│  improvements...                         │
│                                          │
│  [Update now] [Remind later] [Skip]      │
└──────────────────────────────────────────┘
Position: fixed bottom-5 right-5, z-50, w-80
```

**Guard active state (service or projector active):**
Banner is HIDDEN. Status bar shows:
```
┌──────────────────────────────────────────────────────┐
│ [Projector: ON] [Return: OFF] [Streaming: OFF] [↓●] │
└──────────────────────────────────────────────────────┘
Tooltip on [↓●]: "Update available -- will notify after service"
```

**Error state:**
```
┌──────────────────────────────────────────┐
│  ⚠ Could not download the update         │
│  Your internet connection may be          │
│  unstable.                                │
│  Check your connection and try again.     │
│  Your data and settings are safe.    [X]  │
└──────────────────────────────────────────┘
Shown as sonner toast (error variant), persistent
```

### Component Changes Required

- **Existing:** `src/components/update-notification.tsx` (91 lines)
  - Add service-aware guard using `usePresentationStore` state
  - Add `pendingUpdate` state for deferred notification
  - Replace raw error string (line 66) with structured pastoral error
  - Add new i18n keys for error types and guard indicator
- **New:** `StatusBarUpdateIndicator` component (~20 lines)
  - Download icon + green dot, shown only when guard is active
  - Tooltip with localized guard message

### UI States (Complete Matrix)

| State | Trigger | Visual | Interaction |
|-------|---------|--------|-------------|
| Hidden (no update) | No update available | Nothing rendered | None |
| Hidden (guard active) | Update available BUT service/projector active | Status bar indicator only | Tooltip on hover |
| Notification shown | Update available AND all guards false | Full banner card | 3 buttons + close |
| Installing | User clicked "Update now" | Spinner on button, all disabled | All buttons disabled |
| Install success | Mutation resolved | Banner dismissed, success toast | Toast auto-dismisses |
| Install error | Mutation rejected | Banner re-enabled, error toast (persistent) | Retry available |
| Dismissed | User clicked "Remind later" or close | Nothing rendered | None until next session |
| Skipped | User clicked "Skip this version" | Nothing rendered | Never shows for this version |

---

## i18n Keys Required (New)

Must be added to ALL THREE locale files (`en.json`, `pt.json`, `es.json`):

```
updater.guardActive
updater.errorNetwork
updater.errorNetworkWhy
updater.errorNetworkAction
updater.errorDiskSpace
updater.errorDiskSpaceWhy
updater.errorDiskSpaceAction
updater.errorPermission
updater.errorPermissionWhy
updater.errorPermissionAction
updater.errorGeneric
updater.errorGenericWhy
updater.errorGenericAction
updater.errorDataSafe
updater.tryAgain
```

---

## UX Acceptance Criteria

### US-001: Download and Install
- [ ] AC-001-1: Download links clearly labeled per platform with OS icons
- [ ] AC-001-2: File sizes displayed next to download links
- [ ] AC-001-3: Installation guide link adjacent to each download button
- [ ] AC-001-4: Post-install, version number visible in the app

### US-002: Platform-Specific Installation Guide
- [ ] AC-002-1: Single-page document with numbered steps per platform
- [ ] AC-002-2: Every OS dialog step includes screenshot/description
- [ ] AC-002-3: Security warnings highlighted with callout: "This is normal. Click [button]."
- [ ] AC-002-4: Language switcher (PT/EN/ES) visible at top of each guide
- [ ] AC-002-5: No more than 10 steps per platform
- [ ] AC-002-6: No technical jargon; "installer" not "NSIS executable"
- [ ] AC-002-7: "Verify your installation" section at end
- [ ] AC-002-8: Addresses no-admin-rights scenario (per-user install)

### US-003: Automatic Update Notification
- [ ] AC-003-1: Update check after 1500ms delay, non-blocking (existing)
- [ ] AC-003-2: Version number and release notes displayed (existing)
- [ ] AC-003-3: Three actions: "Update now", "Remind later", "Skip version" (existing)
- [ ] AC-003-4: App NEVER auto-restarts without explicit user confirmation

### US-004: Service-Aware Update Guard
- [ ] AC-004-1: When `isProjectorOpen === true`, banner NOT rendered
- [ ] AC-004-2: When `isPlayingService === true`, banner NOT rendered
- [ ] AC-004-3: When `activeServiceId !== null`, banner NOT rendered
- [ ] AC-004-4: Guard active → status bar indicator (download icon + green dot)
- [ ] AC-004-5: Indicator has localized tooltip
- [ ] AC-004-6: Indicator has accessible `aria-label`
- [ ] AC-004-7: When ALL guards clear, banner appears within 2 seconds
- [ ] AC-004-8: Guard reads via `usePresentationStore` subscribe (not stale closure)
- [ ] AC-004-9: Dismissed state preserved across guard cycles
- [ ] AC-004-10: Guard check runs on store state changes (subscribe), not just on mount
- [ ] AC-004-11: Zero update UI during active projection/service

### US-005: Multi-Machine Consistent Installation
- [ ] AC-005-1: Version number visible in Settings/About
- [ ] AC-005-2: Version format matches `tauri.conf.json`

### US-006: Reliable Release Artifacts
- (No UX criteria -- pipeline-only)

### US-007: In-App First-Run Onboarding
- [ ] AC-007-1: Onboarding works completely offline
- [ ] AC-007-2: All onboarding text present in all 3 locales
- [ ] AC-007-3: Version number visible after onboarding completes

### US-008: Graceful Error Communication
- [ ] AC-008-1: ALL errors follow 4-part pastoral pattern
- [ ] AC-008-2: Errors fully localized in PT, EN, ES
- [ ] AC-008-3: Raw technical strings NEVER shown to users
- [ ] AC-008-4: Error toasts persistent (no auto-dismiss)
- [ ] AC-008-5: Network errors suggest checking connection
- [ ] AC-008-6: Permission errors suggest admin or IT contact
- [ ] AC-008-7: All errors include "Your data and settings are safe"
- [ ] AC-008-8: Error classification maps Tauri errors to i18n keys
- [ ] AC-008-9: Generic fallback includes website download instruction

### US-009: Code Signing Documentation
- (No UX criteria -- documentation-only)

---

### Functional Criteria (Cross-Cutting)
- [ ] UX-F-01: Update notification reads presentation store before rendering
- [ ] UX-F-02: Status bar indicator renders only when pending AND guard active
- [ ] UX-F-03: Error classification maps error strings to i18n keys
- [ ] UX-F-04: All new i18n keys in en.json, pt.json, es.json
- [ ] UX-F-05: `pendingUpdate` flag is component state (not localStorage)
- [ ] UX-F-06: Guard subscription cleans up on unmount (no leaks)

### Usability Criteria
- [ ] UX-U-01: "Update now" is visually prominent (default button variant)
- [ ] UX-U-02: Secondary actions use outline variant
- [ ] UX-U-03: Banner doesn't overlap fixed elements (SlideNavBar, StatusBar)
- [ ] UX-U-04: Status bar indicator is visible but not distracting
- [ ] UX-U-05: Error messages use plain language (no HTTP codes)
- [ ] UX-U-06: Guard-to-notification transition uses fade-in (not jarring)
- [ ] UX-U-07: Banner respects current theme (CSS custom properties)

### Accessibility Criteria
- [ ] UX-A-01: Banner has `role="alert"` and `aria-live="polite"`
- [ ] UX-A-02: Close button has `aria-label` from i18n
- [ ] UX-A-03: Status bar indicator has `aria-label`
- [ ] UX-A-04: All text meets WCAG AA 4.5:1 contrast
- [ ] UX-A-05: Banner keyboard navigable (Tab, Escape)
- [ ] UX-A-06: Logical focus order: close, update, remind, skip
- [ ] UX-A-07: Installing state sets `aria-busy="true"`
- [ ] UX-A-08: Error toasts announced by screen readers
- [ ] UX-A-09: No info conveyed by color alone (icon + text supplement)

### Responsive Criteria
- [ ] UX-R-01: Desktop-only app, no mobile breakpoints
- [ ] UX-R-02: Banner (w-80) doesn't overflow at minimum window width
- [ ] UX-R-03: Button row wraps gracefully (flex-wrap)
- [ ] UX-R-04: Status bar indicator visible at all window sizes

---

## Estimated UI Change Scope

| Component | Lines | Type |
|-----------|-------|------|
| `update-notification.tsx` | ~20 added | Modify (guard logic + error classification) |
| `StatusBarUpdateIndicator` | ~20 new | New component in status bar |
| `en.json` / `pt.json` / `es.json` | ~15 keys each | Add new i18n keys |
| **Total** | ~50-60 lines | Small, focused change |
