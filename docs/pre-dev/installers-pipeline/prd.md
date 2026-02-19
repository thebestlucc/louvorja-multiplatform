---
feature: installers-pipeline
gate: 1
date: 2026-02-18
status: draft
confidence: 82
track: large
research: ./research.md
---

# PRD: Installation Guide & Release Pipeline

## Executive Summary

LouvorJA needs a reliable way to distribute the application to churches across Windows, macOS, and Linux, with clear installation instructions for users of all technical levels. The existing release infrastructure has critical defects that prevent production use, and no user-facing installation documentation exists. This feature fixes the release pipeline, creates platform-specific installation guides, and ensures the update experience respects live worship services.

## Problem Definition

**Core problem:** Churches cannot install or update LouvorJA because the release pipeline produces broken artifacts, there are no installation guides, and the update system lacks the permissions needed to function.

**Impact:**
- Zero churches can currently install from an official release — all testing is developer-only
- The auto-updater silently fails due to missing permissions, leaving users stuck on old versions
- Non-technical volunteers (the primary operators during services) have no installation guidance
- No signed builds means operating system warnings scare users away during installation

**Current workarounds:**
- Developer builds the app locally and manually copies it to church computers
- No update mechanism — reinstall from scratch for every version
- Verbal instructions passed between church tech volunteers

## User Personas

### Carlos — The Worship Leader (Tech-Comfortable)
- **Age:** 32 | **Role:** Worship team leader
- **Goals:** Reliable projection of lyrics/verses; quick pre-service setup; smooth transitions
- **Frustrations:** Software crashes; losing curated 400+ hymn library; fighting with the computer before service
- **Context:** Sets up 30 minutes before service on one machine with two monitors. Moderate internet.
- **Quote:** "I just need it to work. If I have to fight the software, I'll go back to PowerPoint."

### Dona Maria — The Faithful Volunteer (Non-Technical)
- **Age:** 58 | **Role:** Projection operator during services
- **Goals:** Follow the service order; advance slides on cue; not break anything
- **Frustrations:** English-only error messages; fear of clicking the wrong thing; anxiety when dialogs appear
- **Context:** Arrives 15 minutes before service. Carlos has set everything up. Sometimes asked to install updates.
- **Quote:** "When the computer shows me something I don't understand, I freeze."

### Ricardo — The Church IT Admin (Technical)
- **Age:** 45 | **Role:** Deacon managing 3 church computers
- **Goals:** Standardized installation across machines; minimal maintenance; documented procedures
- **Frustrations:** Different versions on different machines; no unattended install; no way to verify updates are genuine
- **Context:** Visits church on Saturdays. Cannot always be present for issues. Wants to document procedures for others.
- **Quote:** "I need to set it up once, document the procedure, and trust it keeps working."

## User Stories

### US-001: Download and Install (All Platforms)
**As** Carlos, **I want** to download and install LouvorJA from a single official source **so that** I know I'm getting the genuine, latest version.

**Acceptance Criteria:**
- Official download page/location lists installers for all supported platforms
- Each platform has a clear, labeled download link
- Installation completes without requiring advanced technical knowledge
- Application launches successfully after installation

### US-002: Platform-Specific Installation Guide
**As** Dona Maria, **I want** step-by-step installation instructions in my language **so that** I can install the app without needing someone else's help.

**Acceptance Criteria:**
- Installation guide available in Portuguese, English, and Spanish
- Separate instructions for each operating system
- Includes screenshots or visual indicators for key steps
- Addresses common obstacles (security warnings, permission prompts)
- Written at a level understandable by non-technical users

### US-003: Automatic Update Notification
**As** Carlos, **I want** to be notified when a new version is available **so that** I can update at a convenient time.

**Acceptance Criteria:**
- App checks for updates after startup (not blocking the main interface)
- Notification shows version number and what changed
- User can choose: "Update now", "Remind me later", or "Skip this version"
- Update downloads and installs without losing any data

### US-004: Service-Aware Update Guard
**As** Carlos, **I want** updates to NEVER interrupt a live worship service **so that** projection doesn't go black during worship.

**Acceptance Criteria:**
- When projection is active or a service is loaded, ALL update notifications are suppressed
- A subtle indicator shows "Update available — will notify after service"
- After projection closes and service ends, the notification appears
- The app NEVER auto-restarts without explicit user confirmation

### US-005: Multi-Machine Consistent Installation
**As** Ricardo, **I want** the same installation process across all church computers **so that** I can document it once and have volunteers follow it.

**Acceptance Criteria:**
- Installation process is identical per platform regardless of machine
- Version number is visible in the app so machines can be verified to match
- Installation does not require administrator privileges by default
- Guide includes a "verify your installation" checklist

### US-006: Reliable Release Artifacts
**As** a developer/maintainer, **I want** the automated build pipeline to produce working installers for all platforms **so that** every release is trustworthy and complete.

**Acceptance Criteria:**
- Pipeline builds for Windows (x86_64), macOS (ARM + Intel), Linux (x86_64 + ARM)
- All artifacts include update signatures for the auto-updater
- Releases are created as drafts for human review before publishing
- Build failures on one platform don't block other platforms
- Build times are reasonable (under 20 minutes per platform with caching)

### US-007: In-App First-Run Onboarding
**As** a new user, **I want** the app to guide me through initial setup **so that** I can start using it immediately without reading external docs.

**Acceptance Criteria:**
- First launch detects fresh installation and shows onboarding flow
- Language selection is the first step
- Migration from legacy data is offered (if applicable)
- Monitor setup assistance is provided
- Onboarding is skippable for experienced users
- Onboarding works completely offline

### US-008: Graceful Error Communication
**As** Dona Maria, **I want** error messages during installation or updates to be in my language and tell me what to do **so that** I don't panic and give up.

**Acceptance Criteria:**
- All error messages are localized (PT/EN/ES)
- Error messages follow the pattern: what happened → why → what to do → reassurance
- Installation/update errors never show raw technical output
- "Your data is safe" reassurance is prominently displayed when relevant

### US-009: Code Signing Documentation
**As** Ricardo, **I want** documentation on how to set up code signing for official releases **so that** future builds can be signed and users won't see security warnings.

**Acceptance Criteria:**
- Step-by-step guide for setting up macOS code signing and notarization
- Step-by-step guide for setting up Windows code signing
- Required accounts, certificates, and costs clearly documented
- CI/CD secret configuration instructions included
- Guide is maintainer-facing (technical audience)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Installation success rate | >95% of download-to-launch attempts succeed | Release download count vs. first-launch telemetry |
| Build pipeline reliability | >90% of release builds succeed on all platforms | CI/CD success rate tracking |
| Update adoption rate | >80% of users update within 2 weeks of release | Version distribution in update checks |
| Zero service interruptions from updates | 0 incidents of update UI during active projection | User-reported incidents |
| Time-to-first-use | <5 minutes from download to first slide projected | First-run onboarding tracking |

## Scope

### In Scope
- Fix existing release pipeline defects (3 critical bugs)
- Add missing platform targets (macOS dual architecture, ARM Linux)
- Build caching for faster pipeline execution
- External installation guides (all 3 platforms, all 3 languages)
- In-app first-run onboarding improvements
- Service-aware update guard
- Localized error messaging for install/update flows
- Code signing setup documentation (guide only, not implementation)
- Release process documentation for maintainers

### Out of Scope
- Code signing certificate purchase and configuration (documented as future)
- Auto-update server (using existing free hosting via releases)
- Flatpak/Snap packaging (future consideration)
- Silent/unattended enterprise deployment
- Delta/differential updates (full updates only for now)
- Version bump automation (manual version management for now)
- App store distribution (Microsoft Store, Mac App Store)

## Business Dependencies

- Access to CI/CD platform with multi-platform build runners (including ARM Linux)
- Existing updater infrastructure (already integrated in Phase 10)
- Translation resources for installation guides in 3 languages

## Differentiation

LouvorJA's installation and update experience differentiates from competitors through:

1. **Service-aware update guard** — No competitor (ProPresenter, EasyWorship, OpenLP, FreeShow) guards updates against live service disruption
2. **Tiny download size** (~10MB vs 150-200MB competitors) — critical advantage for Brazilian churches with slow internet
3. **No admin rights needed** — Per-user installation works on locked-down shared church computers
4. **True cross-platform** — Windows + macOS + Linux (including ARM), while most competitors are Windows-only or Windows+macOS
5. **Trilingual installation** — PT/EN/ES from first launch, not English-only

## Release Strategy

- Ship as version 0.1.0 (beta/preview)
- Draft releases reviewed by maintainer before publishing
- Installation guides published alongside first release
- Code signing documented but not implemented (future enhancement when certificates are obtained)
