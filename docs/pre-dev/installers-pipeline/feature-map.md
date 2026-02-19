---
feature: installers-pipeline
gate: 2
date: 2026-02-18
status: draft
confidence: 88
prd: ./prd.md
ux_criteria: ./ux-criteria.md
research: ./research.md
---

# Feature Map: Installation Guide & Release Pipeline

## Overview

This map covers 12 features across 4 domains, derived from 9 user stories in the PRD. The feature scope splits into two distinct tracks: **infrastructure** (pipeline fixes, build improvements — no user-facing UI) and **user experience** (installation guides, update guard, error messaging — direct user impact). The infrastructure track unblocks everything else and must ship first.

---

## Feature Inventory

### Core Features (Must-Have for First Release)

| ID | Name | Description | User Value | Dependencies | Blocks |
|----|------|-------------|------------|--------------|--------|
| F-001 | Pipeline Bug Fixes | Fix 3 critical defects preventing working release artifacts | Without this, no installer exists for any platform | None (foundational) | F-002, F-003, F-004, F-005, F-006 |
| F-002 | Updater Permission Fix | Add missing capability permission so auto-update functions | Users can receive updates after initial install | F-001 | F-007 |
| F-003 | Linux Build Dependencies | Add required system packages so Linux builds succeed | Linux users can install the app | F-001 | F-005 |
| F-004 | Dual macOS Architecture | Build for both ARM and Intel Mac | All Mac users can install regardless of chip | F-001 | F-005 |
| F-005 | Installation Guides | Platform-specific, trilingual install instructions | Non-technical users can install without help | F-001, F-003, F-004 | None |
| F-007 | Service-Aware Update Guard | Suppress update notifications during live worship | Updates never interrupt a worship service | F-002 | None |

### Supporting Features (Enable Core Features)

| ID | Name | Description | User Value | Dependencies | Blocks |
|----|------|-------------|------------|--------------|--------|
| F-006 | Build Caching | Cache compiled artifacts between pipeline runs | Faster releases, more frequent updates possible | F-001 | None |
| F-008 | Pastoral Error Messaging | Structured, localized error messages for update failures | Non-technical users understand what happened and what to do | F-002 | None |
| F-009 | ARM Linux Build | Add ARM architecture target for Linux | Future-proofs for ARM devices in churches | F-003 | None |

### Enhancement Features (Improve Experience)

| ID | Name | Description | User Value | Dependencies | Blocks |
|----|------|-------------|------------|--------------|--------|
| F-010 | Onboarding Refinements | Ensure first-run works offline, verify install step | New users confirm successful installation | None | None |
| F-011 | Version Visibility | Display version number in accessible location | IT admins verify machines are in sync | None | None |

### Integration Features (Connect to External Systems)

| ID | Name | Description | User Value | Dependencies | Blocks |
|----|------|-------------|------------|--------------|--------|
| F-012 | Code Signing Documentation | Step-by-step guide for setting up platform signing | Future builds are trusted by operating systems (no warnings) | F-001 | None (documentation only) |

---

## Domain Groupings

### Domain 1: Release Pipeline

**Purpose:** Produce working, signed, multi-platform installers from source code automatically.

**Features:** F-001 (Pipeline Bug Fixes), F-003 (Linux Build Deps), F-004 (Dual macOS Architecture), F-006 (Build Caching), F-009 (ARM Linux Build)

**Boundaries:**
- **Owns:** Build configuration, platform targets, artifact generation, build performance
- **Consumes:** Source code, version number, signing credentials
- **Provides:** Working installers for all platforms, update signature files, release draft

**Integration Points:**
- → Auto-Update Domain: Provides signed artifacts + signature files that the updater consumes
- → User Guides Domain: Provides the actual installers that guides reference for download
- ← Version Management: Consumes version number from app configuration

### Domain 2: Auto-Update Experience

**Purpose:** Deliver updates safely without disrupting worship services.

**Features:** F-002 (Updater Permission Fix), F-007 (Service-Aware Update Guard), F-008 (Pastoral Error Messaging)

**Boundaries:**
- **Owns:** Update check behavior, notification timing, error communication, service-awareness
- **Consumes:** Signed artifacts from pipeline, presentation/projection state from app
- **Provides:** Safe, non-disruptive update experience

**Integration Points:**
- ← Release Pipeline Domain: Consumes signed artifacts and signature files
- ← Worship Projection (existing): Reads projector/service state to determine guard behavior
- → User Communication: Provides localized error messages and status indicators

### Domain 3: User Guides & Documentation

**Purpose:** Enable users of all technical levels to install and maintain the application.

**Features:** F-005 (Installation Guides), F-012 (Code Signing Documentation)

**Boundaries:**
- **Owns:** Installation instructions, troubleshooting guidance, signing setup procedures
- **Consumes:** Platform-specific installer details, version information
- **Provides:** Self-service installation capability for all user skill levels

**Integration Points:**
- ← Release Pipeline Domain: References installer types and download locations
- → Onboarding Domain: External guides complement in-app onboarding flow

### Domain 4: First-Run & Verification

**Purpose:** Confirm successful installation and guide new users through initial setup.

**Features:** F-010 (Onboarding Refinements), F-011 (Version Visibility)

**Boundaries:**
- **Owns:** First-launch detection, setup wizard, version display
- **Consumes:** Installation state, app version
- **Provides:** Confidence that installation succeeded, guided first experience

**Integration Points:**
- ← User Guides Domain: Guides direct users to in-app onboarding after install
- → Worship features (existing): Onboarding sets up monitors for projection

---

## User Journeys

### Journey 1: First-Time Installation (Carlos)

**User:** Worship leader (tech-comfortable)
**Goal:** Download, install, and project first slide within 5 minutes

| Step | Action | Feature | Domain | Success | Failure |
|------|--------|---------|--------|---------|---------|
| 1 | Find download page | - | External | Sees platform options | Can't find download |
| 2 | Download installer for his OS | F-005 | User Guides | Download starts, small file (~10MB) | Wrong platform selected |
| 3 | Run installer | F-001 | Release Pipeline | Installs without admin prompt | OS security warning |
| 4 | See security warning (if unsigned) | F-005 | User Guides | Guide explains how to proceed | User abandons |
| 5 | Launch app | F-010 | First-Run | App opens, onboarding starts | Crash or error |
| 6 | Complete onboarding | F-010 | First-Run | Language selected, monitors configured | Stuck on a step |
| 7 | Verify version | F-011 | First-Run | Version visible, matches latest | Can't find version |
| 8 | Project first slide | - | Existing | Success — worship ready | - |

**Cross-Domain Interactions:** Release Pipeline → User Guides (download links) → First-Run (onboarding) → Existing worship features

### Journey 2: Receiving an Update During Service Prep (Carlos)

**User:** Worship leader preparing for Sunday service
**Goal:** Be informed about update without disruption during service

| Step | Action | Feature | Domain | Success | Failure |
|------|--------|---------|--------|---------|---------|
| 1 | Open app to prepare service | - | Existing | App opens normally | - |
| 2 | App checks for update in background | F-002 | Auto-Update | Update found, notification shown | Permission error (silent fail) |
| 3 | See update notification | F-008 | Auto-Update | Clear version info + release notes | Cryptic error message |
| 4 | Click "Remind later" | F-002 | Auto-Update | Notification dismissed | - |
| 5 | Start projecting (open projector) | - | Existing | Projection active | - |
| 6 | (Update guard activates) | F-007 | Auto-Update | Status bar indicator only | Banner pops up mid-service |
| 7 | Finish service, close projector | - | Existing | Projection ends | - |
| 8 | (Guard releases) | F-007 | Auto-Update | Notification reappears gently | Notification lost |
| 9 | Click "Update now" | F-002 | Auto-Update | Update installs successfully | Error → pastoral message (F-008) |

**Cross-Domain Interactions:** Auto-Update ↔ Existing worship projection (guard reads state)

### Journey 3: Non-Technical Volunteer Installing (Dona Maria)

**User:** Non-technical volunteer, Portuguese speaker
**Goal:** Install app following Ricardo's printed instructions

| Step | Action | Feature | Domain | Success | Failure |
|------|--------|---------|--------|---------|---------|
| 1 | Receive printed guide from Ricardo | F-005 | User Guides | Guide is in Portuguese, has screenshots | Guide is in English |
| 2 | Download installer (following step 1) | F-005 | User Guides | Clicks correct link | Downloads wrong platform |
| 3 | Double-click installer | F-001 | Release Pipeline | Installer runs | Nothing happens |
| 4 | See OS security warning | F-005 | User Guides | Guide explains: "This is normal. Click here." | Freezes, closes everything |
| 5 | Complete installation wizard | F-001 | Release Pipeline | Per-user install, no admin needed | Admin prompt appears |
| 6 | Launch app | F-010 | First-Run | Onboarding in Portuguese | English interface |
| 7 | Tell Ricardo it worked | F-011 | First-Run | Can show version number as proof | Can't verify |

**Cross-Domain Interactions:** User Guides → Release Pipeline (installer quality) → First-Run (language detection)

### Journey 4: IT Admin Deploying to Multiple Machines (Ricardo)

**User:** Church IT admin managing 3 computers
**Goal:** Same version installed on all machines, documented procedure

| Step | Action | Feature | Domain | Success | Failure |
|------|--------|---------|--------|---------|---------|
| 1 | Read installation guide | F-005 | User Guides | Clear, per-platform instructions | Incomplete guide |
| 2 | Download installer once | F-001 | Release Pipeline | Single download, carry on USB | Different file per machine |
| 3 | Install on Machine 1 | F-001 | Release Pipeline | Consistent experience | Different behavior |
| 4 | Verify version on Machine 1 | F-011 | First-Run | Version matches expected | Can't find version |
| 5 | Repeat for Machines 2-3 | F-001 | Release Pipeline | Same process, same result | Inconsistency |
| 6 | Document procedure for volunteers | F-005 | User Guides | Guide serves as documentation base | Has to write from scratch |
| 7 | Read code signing guide for future | F-012 | User Guides | Understands setup steps | Too vague |

**Cross-Domain Interactions:** User Guides → Release Pipeline (consistent artifacts) → First-Run (version verification)

---

## Feature Interaction Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    RELEASE PIPELINE DOMAIN                       │
│                                                                  │
│  F-001 Pipeline ──┬──→ F-003 Linux Deps ──→ F-009 ARM Linux    │
│  Bug Fixes        │                                              │
│  (FOUNDATIONAL)   ├──→ F-004 Dual macOS                         │
│                   │                                              │
│                   └──→ F-006 Build Caching                       │
│                                                                  │
│  Provides: working installers + .sig files                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    artifacts + signatures
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AUTO-UPDATE DOMAIN                             │
│                                                                  │
│  F-002 Updater ──────→ F-007 Service-Aware Guard                │
│  Permission Fix        (reads projection state)                  │
│                  │                                               │
│                  └───→ F-008 Pastoral Error Messaging            │
│                                                                  │
│  Consumes: projection/service state from existing app            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  USER GUIDES DOMAIN                              │
│                                                                  │
│  F-005 Installation ←── references ──── Release Pipeline         │
│  Guides (PT/EN/ES)                                              │
│                                                                  │
│  F-012 Code Signing ←── references ──── Release Pipeline         │
│  Documentation                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                FIRST-RUN & VERIFICATION DOMAIN                   │
│                                                                  │
│  F-010 Onboarding ←── follows ──── Installation Guides           │
│  Refinements                                                     │
│                                                                  │
│  F-011 Version ←── referenced by ──── Installation Guides        │
│  Visibility                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Matrix

| Feature | Depends On | Blocks | Optional Deps |
|---------|-----------|--------|---------------|
| F-001 Pipeline Bug Fixes | None | F-002, F-003, F-004, F-005, F-006 | - |
| F-002 Updater Permission | F-001 | F-007, F-008 | - |
| F-003 Linux Build Deps | F-001 | F-005, F-009 | - |
| F-004 Dual macOS | F-001 | F-005 | - |
| F-005 Installation Guides | F-001, F-003, F-004 | None | F-012 |
| F-006 Build Caching | F-001 | None | - |
| F-007 Service-Aware Guard | F-002 | None | - |
| F-008 Pastoral Errors | F-002 | None | - |
| F-009 ARM Linux | F-003 | None | - |
| F-010 Onboarding Refinements | None | None | F-005 |
| F-011 Version Visibility | None | None | - |
| F-012 Code Signing Docs | None | None | F-001 |

---

## Phasing Strategy

### Phase A: Foundation (Unblocks Everything)

**Goal:** Produce working release artifacts for all platforms
**Features:** F-001 (Pipeline Bug Fixes), F-003 (Linux Build Deps), F-004 (Dual macOS), F-006 (Build Caching)
**User Value:** First ever working official release possible
**Success Criteria:** Pipeline succeeds on all 5 targets (Win x64, macOS ARM, macOS Intel, Linux x64, Linux ARM), artifacts downloadable, build time under 20 min with cache
**Triggers next phase when:** All platform builds pass and draft release created

### Phase B: Safe Updates (Critical UX)

**Goal:** Ensure the update system works and never disrupts worship
**Features:** F-002 (Updater Permission), F-007 (Service-Aware Guard), F-008 (Pastoral Errors)
**User Value:** Users receive updates safely; zero service interruptions; friendly error messages
**Success Criteria:** Update check succeeds; guard suppresses notification during projection; errors show localized pastoral messages
**Triggers next phase when:** Update flow tested end-to-end with guard active

### Phase C: User Guides (Adoption Enabler)

**Goal:** Enable self-service installation for users of all skill levels
**Features:** F-005 (Installation Guides), F-012 (Code Signing Docs)
**User Value:** Any church volunteer can install following the guide; IT admins have signing roadmap
**Success Criteria:** Guides exist for all 3 platforms in all 3 languages; code signing docs complete
**Triggers next phase when:** Guides reviewed and published alongside release

### Phase D: Polish (Quality of Life)

**Goal:** Refine first-run experience and verification
**Features:** F-009 (ARM Linux), F-010 (Onboarding Refinements), F-011 (Version Visibility)
**User Value:** ARM Linux support; offline onboarding; version verification for IT admins
**Success Criteria:** ARM builds pass; onboarding works offline; version visible in app
**Triggers completion when:** All 12 features delivered

---

## Scope Boundaries

### In Scope
- All 12 features listed above across 4 domains
- 5 platform targets: Windows x64, macOS ARM, macOS Intel, Linux x64, Linux ARM
- 3 languages: Portuguese, English, Spanish
- External documentation (markdown guides)
- In-app UX improvements (guard, errors, onboarding, version display)

### Out of Scope (with Rationale)
- **Code signing implementation** — Requires paid certificates; documented as future guide (F-012)
- **App store distribution** — Low priority; direct download is standard for church software
- **Silent/unattended install** — Enterprise feature; per-user install covers most churches
- **Delta updates** — Full updates sufficient at ~10MB bundle size
- **Version bump automation** — Manual versioning appropriate for beta stage
- **Flatpak/Snap packaging** — AppImage covers Linux needs; can add later

### Assumptions
- GitHub Actions runners support all 5 target platforms (including `ubuntu-22.04-arm`)
- Churches have internet for initial download (offline install not a separate deliverable)
- The existing onboarding flow (Phase 10) is structurally sound and needs only refinements

### Constraints
- Code signing is documentation-only (no certificate purchase)
- Version stays at 0.1.0 (beta/preview release)
- All user-facing text must exist in 3 locales

---

## Risk Assessment

### Feature Complexity Risks

| Feature | Risk Level | Risk | Mitigation |
|---------|-----------|------|------------|
| F-001 Pipeline Bug Fixes | Low | Well-understood fixes (env vars, deps, permission) | Fixes are documented in research.md with exact locations |
| F-004 Dual macOS | Medium | Two separate build matrix entries, Rust target configuration | Follow official Tauri docs pattern exactly |
| F-007 Service-Aware Guard | Medium | Must correctly read multiple state signals without stale closures | Use documented Zustand subscribe pattern from CLAUDE.md |
| F-008 Pastoral Errors | Low | Error classification from string matching | Generous fallback to generic error |
| F-009 ARM Linux | Medium | GitHub ARM runner availability, potential dependency differences | Can defer if runner unavailable; not a blocker for release |

### Integration Risks

| Domain Interaction | Risk | Impact | Mitigation |
|-------------------|------|--------|------------|
| Auto-Update ↔ Worship Projection | Guard misreads state → notification during service | Critical (service disruption) | Test with all guard conditions; use subscribe not snapshot |
| Release Pipeline → Auto-Update | Missing .sig files → updater rejects artifacts | High (updates broken) | Verify .sig files exist in draft release before publishing |
| Installation Guides → Release Pipeline | Guide references wrong installer names/paths | Medium (user confusion) | Generate guide after confirming artifact names |

---

## Gate 2 Validation

| Check | Status |
|-------|--------|
| All PRD features mapped | Yes — 9 user stories → 12 features |
| Categories assigned | Yes — 6 Core, 3 Supporting, 2 Enhancement, 1 Integration |
| Domains logically cohesive | Yes — 4 domains by business capability |
| User journeys documented | Yes — 4 journeys covering all personas |
| Integration points identified | Yes — inter-domain flows mapped |
| Boundaries clear | Yes — owns/consumes/provides per domain |
| Priorities support phased delivery | Yes — 4 phases, A unblocks all |
| No technical details | Yes — business-level only |
| Confidence score | 88/100 |

**Gate Result:** ✅ PASS — Proceed to TRD (Gate 3)
