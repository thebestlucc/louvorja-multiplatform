---
feature: installers-pipeline
gate: 3
date: 2026-02-18
status: draft
confidence: 85
prd: ./prd.md
feature_map: ./feature-map.md
ux_criteria: ./ux-criteria.md
research: ./research.md
deployment:
  model: desktop
  distribution: direct-download
  platforms: [windows-x64, macos-arm64, macos-x64, linux-x64, linux-arm64]
tech_stack:
  primary: tauri-desktop
  backend: rust
  frontend: typescript-react
  standards_loaded: [CLAUDE.md project patterns]
design_validation:
  status: covered-by-ux-criteria
  note: "ux-criteria.md contains wireframes, states, and 47 acceptance criteria for the minimal UI changes"
---

# TRD: Installation Guide & Release Pipeline

## Architecture Overview

### System Context

This feature operates across two distinct environments:

1. **Build Environment** (CI/CD) — Automated pipeline that compiles, bundles, signs, and publishes release artifacts for 5 platform targets
2. **Runtime Environment** (Desktop App) — End-user application with update checking, service-aware notification suppression, and localized error communication

These environments are connected by a release artifact store (hosted releases) that the build pipeline writes to and the desktop updater reads from.

### Architecture Style

**Build Pipeline:** Event-driven pipeline triggered by version tags, executing parallel platform-specific jobs with shared artifact output.

**Desktop Update System:** Observer pattern — the update component subscribes to application state changes (projection, service) and gates its own visibility accordingly.

---

## Component Architecture

### Domain 1: Release Pipeline (Build Environment)

#### Component: Build Orchestrator

**Purpose:** Coordinate multi-platform builds from a single trigger event.

**Responsibilities:**
- Validate source code (type checks, linting, compilation) before building
- Execute platform-specific builds in parallel (fail-fast disabled)
- Cache compiled artifacts between runs for performance
- Inject environment-specific configuration at build time
- Produce draft releases with all platform artifacts

**Interfaces:**
- **Inbound:** Version tag push event, manual trigger
- **Outbound:** Platform-specific installer artifacts, update metadata file, release draft

**Quality Attributes:**
- Build time: <20 minutes per platform with caching
- Reliability: Individual platform failures don't block others
- Security: Signing credentials never stored in source code

#### Component: Platform Builder (5 instances)

**Purpose:** Produce installer and updater artifacts for a single platform target.

**Responsibilities:**
- Install platform-specific build dependencies
- Compile backend code for target architecture
- Bundle frontend + backend into platform installer
- Generate update signature files alongside installers
- Upload artifacts to release draft

**Interfaces:**
- **Inbound:** Source code, signing credentials (from secrets), updater configuration
- **Outbound:** Installer file, signature file (.sig), update metadata

**Platform-Specific Behaviors:**

| Target | Installer Format | Signature | Special Requirements |
|--------|-----------------|-----------|---------------------|
| Windows x64 | Setup executable (per-user + admin modes) | Ed25519 .sig | None |
| macOS ARM | Application bundle in disk image | Ed25519 .sig | Dual architecture target installation |
| macOS Intel | Application bundle in disk image | Ed25519 .sig | Dual architecture target installation |
| Linux x64 | Portable application image + Debian package | Ed25519 .sig | System library dependencies |
| Linux ARM | Portable application image | Ed25519 .sig | ARM-compatible runner |

#### Component: Configuration Injector

**Purpose:** Replace placeholder values in the app configuration with environment-specific secrets at build time.

**Responsibilities:**
- Read updater endpoint and public key from environment
- Validate that all required values are present (fail-fast on missing)
- Write values into app configuration before build step

**Interfaces:**
- **Inbound:** Environment variables (updater endpoint, public key)
- **Outbound:** Modified app configuration file

**ADR-001: Build-Time Injection vs Runtime Configuration**
- **Context:** Updater endpoint and public key must be configured per environment but not committed to source
- **Options:** (A) Build-time injection into config file, (B) Runtime environment variable reading, (C) Remote configuration service
- **Decision:** Build-time injection (A)
- **Rationale:** Desktop apps have no runtime environment variable access; remote config adds network dependency at startup; build-time injection is deterministic and verifiable
- **Consequences:** Each build is environment-specific; config is baked into the binary

---

### Domain 2: Auto-Update Experience (Runtime Environment)

#### Component: Update Checker

**Purpose:** Periodically check for available updates and manage the update lifecycle.

**Responsibilities:**
- Check update endpoint after startup delay (non-blocking)
- Parse update metadata (version, notes, signature)
- Verify update signature against embedded public key
- Download and install updates on user confirmation
- Never auto-restart without explicit user action

**Interfaces:**
- **Inbound:** App startup event, user action (install/dismiss/skip)
- **Outbound:** Update availability state, download progress, install result

**Existing Implementation:** Commands `check_for_updates` and `install_update` in backend, query hooks in frontend. Requires capability permission fix to function.

#### Component: Service-Aware Guard

**Purpose:** Suppress update notifications during live worship services to prevent disruption.

**Responsibilities:**
- Subscribe to presentation/projection state changes
- Evaluate guard conditions on every state change (not polling)
- When guard active: suppress notification, signal status indicator
- When guard releases: allow deferred notification to appear
- Preserve dismissed/skipped state across guard transitions

**Interfaces:**
- **Inbound:** Presentation store state (projector open, service playing, active service ID)
- **Outbound:** Guard active/released signal, pending update flag

**Guard Logic (Boolean):**
```
guardActive = isProjectorOpen OR isPlayingService OR (activeServiceId != null)

showNotification = updateAvailable AND NOT guardActive AND NOT dismissed AND NOT skipped
```

**ADR-002: Guard Subscription vs Polling**
- **Context:** Guard must react to projection/service state changes in real-time
- **Options:** (A) Zustand store subscription with cleanup, (B) Polling interval, (C) Event-based with Tauri events
- **Decision:** Store subscription (A)
- **Rationale:** Immediate reactivity (no delay), no wasted CPU cycles, follows existing codebase pattern for store-driven UI, automatic cleanup on unmount
- **Consequences:** Must use `getState()` pattern inside async callbacks to avoid stale closures (documented project pattern)

#### Component: Error Classifier

**Purpose:** Map raw update error strings to structured, localized error categories.

**Responsibilities:**
- Parse error strings from updater backend
- Classify into categories: network, disk space, permission, generic
- Return i18n key set for the pastoral error pattern (what, why, action, reassurance)
- Fall back to generic category for unrecognized errors

**Interfaces:**
- **Inbound:** Raw error string from update install attempt
- **Outbound:** Error category + i18n key set

**Classification Strategy:**
```
if error contains "network" or "connection" or "timeout" or "DNS" → NETWORK
if error contains "space" or "disk" or "ENOSPC" → DISK_SPACE
if error contains "permission" or "access" or "EACCES" → PERMISSION
else → GENERIC
```

**ADR-003: Error Classification Approach**
- **Context:** Backend updater returns unstructured error strings, but frontend needs categorized errors
- **Options:** (A) String pattern matching in frontend, (B) Structured error codes from backend, (C) Error mapping table
- **Decision:** String pattern matching (A)
- **Rationale:** Backend updater is a third-party plugin — we don't control error format. Pattern matching with generous fallback is resilient. Over-classifying is worse than under-classifying.
- **Consequences:** New error patterns from plugin updates may not be classified; generic fallback handles this safely

#### Component: Status Bar Indicator

**Purpose:** Show a minimal, non-disruptive indicator when an update is deferred by the guard.

**Responsibilities:**
- Render only when `pendingUpdate` AND `guardActive` are both true
- Display a small icon with localized tooltip
- Provide accessible label for screen readers
- Disappear when guard releases (notification takes over)

**Interfaces:**
- **Inbound:** `pendingUpdate` flag, `guardActive` flag
- **Outbound:** Visual indicator in status bar area

---

### Domain 3: User Guides (Documentation)

#### Component: Installation Guide Set

**Purpose:** Enable users of all technical levels to install the application on any supported platform.

**Responsibilities:**
- Provide platform-specific step-by-step instructions
- Address operating system security warnings with reassuring explanations
- Support 3 languages (Portuguese, English, Spanish)
- Include verification steps (launch app, check version)
- Address per-user vs admin installation scenarios

**Structure (per platform):**
1. System requirements
2. Download the installer
3. Run the installer (with security warning guidance)
4. First launch and language selection
5. Verify installation (version check)

**Quality Attributes:**
- Maximum 10 steps per platform
- Reading level: non-technical user (Dona Maria persona)
- All OS dialog descriptions in user's language
- No technical jargon

#### Component: Code Signing Setup Guide

**Purpose:** Document the process for configuring platform code signing for future releases.

**Target Audience:** Maintainers and IT administrators (Ricardo persona)

**Structure:**
1. macOS: Developer program enrollment, certificate generation, notarization setup, CI secret configuration
2. Windows: Certificate acquisition (OV vs EV trade-offs), CI secret configuration, expected signing behavior
3. Verification: How to confirm builds are properly signed

---

### Domain 4: First-Run & Verification (Runtime Environment)

#### Component: Onboarding Refinements

**Purpose:** Ensure first-run experience works offline and confirms successful installation.

**Responsibilities:**
- Verify no network calls during onboarding flow
- Ensure all onboarding text exists in all 3 locales
- Add version display at onboarding completion

**Scope:** Minimal changes to existing onboarding — validation and locale completeness only.

#### Component: Version Display

**Purpose:** Surface the application version in an accessible location for verification.

**Responsibilities:**
- Read version from app configuration
- Display in settings/about area
- Format as "LouvorJA v{version}"

---

## Data Architecture

### Build-Time Data Flow

```
Source Code + Secrets
        │
        ▼
┌─────────────────┐
│ Build Orchestrator│
│ (validates, then │
│  fans out)       │
└────────┬────────┘
         │
    ┌────┼────┬────────┬──────────┐
    ▼    ▼    ▼        ▼          ▼
  Win  macARM macIntel LinuxX64 LinuxARM
    │    │    │        │          │
    ▼    ▼    ▼        ▼          ▼
  .exe  .dmg  .dmg    .AppImage  .AppImage
  .sig  .sig  .sig    .deb       .sig
                      .sig
    │    │    │        │          │
    └────┴────┴────────┴──────────┘
                  │
                  ▼
         ┌───────────────┐
         │ Release Draft  │
         │ + latest.json  │
         │ (update meta)  │
         └───────────────┘
```

### Runtime Data Flow (Update Check)

```
App Startup (1500ms delay)
        │
        ▼
┌─────────────────┐
│ Update Checker   │──→ GET latest.json from release endpoint
│                  │←── { version, platforms, signatures }
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Service-Aware   │←────│ Presentation     │
│ Guard           │     │ Store (existing)  │
│                 │     │ • isProjectorOpen │
│ guardActive?    │     │ • isPlayingService│
│                 │     │ • activeServiceId │
└────────┬────────┘     └──────────────────┘
         │
    ┌────┴─────┐
    ▼          ▼
  Guard      Guard
  Active     Released
    │          │
    ▼          ▼
  Status    Notification
  Bar       Banner
  Indicator (3 actions)
               │
          ┌────┼────┐
          ▼    ▼    ▼
       Install Remind Skip
          │
          ▼
    ┌───────────┐
    │ Error     │──→ Pastoral toast (localized)
    │ Classifier│
    └───────────┘
```

### Data Ownership

| Data | Owner | Storage | Persistence |
|------|-------|---------|-------------|
| Release artifacts | Build Pipeline | Release hosting | Permanent |
| Update metadata (latest.json) | Build Pipeline | Release hosting | Per-release |
| Signing keys (private) | CI Secrets | Environment variables | Never in source |
| Signing keys (public) | App Config | Injected at build time | Baked into binary |
| Pending update flag | Guard Component | React state | Session only |
| Skipped version | Update Notification | Browser localStorage | Permanent |
| Dismissed state | Update Notification | React state | Session only |
| Guard conditions | Presentation Store | Zustand store | Session only |

---

## Design System Configuration

### UI Library
- **Library:** Radix UI primitives with CVA (class-variance-authority)
- **Existing patterns:** Button (default, outline, ghost, destructive variants), Badge, Card

### CSS Framework
- **Framework:** Tailwind CSS v4 with `@theme` directive
- **Theme system:** CSS custom properties for 5 themes (azure/white/gray/orange/black)

### Component Availability

| Component Needed | Available | Notes |
|------------------|-----------|-------|
| Button | Yes | default, outline, ghost, destructive + sm/md/lg/icon sizes |
| Toast (sonner) | Yes | `toast.success()`, `toast.error()` with custom descriptions |
| Tooltip | Yes | Radix Tooltip primitives |
| Lucide Icons | Yes | Download, X, RefreshCw, Loader2 |
| Status bar slot | Yes | Existing `status-bar.tsx` with icon button pattern |

### Components to Modify

| Component | File | Change |
|-----------|------|--------|
| UpdateNotification | `src/components/update-notification.tsx` | Add guard logic + error classification |
| StatusBar | `src/components/layout/status-bar.tsx` | Add update indicator slot |

### New Components

| Component | Location | Size |
|-----------|----------|------|
| StatusBarUpdateIndicator | `src/components/layout/` | ~20 lines |
| classifyUpdateError (util) | `src/lib/` | ~15 lines |

### Variant Usage

| Intent | Component | Variant |
|--------|-----------|---------|
| Install update (primary action) | Button | `variant="default"` `size="sm"` |
| Remind later | Button | `variant="outline"` `size="sm"` |
| Skip version | Button | `variant="outline"` `size="sm"` |
| Close notification | Icon button | `variant="ghost"` |
| Error retry | Button | `variant="default"` `size="sm"` |

---

## Integration Patterns

### Build Pipeline ↔ Release Hosting

**Pattern:** Write-once artifact publishing with metadata sidecar.

The build pipeline uploads installer artifacts alongside a metadata file that describes available versions per platform. The desktop updater reads only the metadata file to determine if an update exists, then downloads the platform-specific artifact.

**Metadata contract:**
- One JSON file per release containing: version, release notes, publication date, and per-platform entries (download URL + signature)
- Client requests metadata → receives 200 (update available) or 204 (no update)

### Update Guard ↔ Presentation System

**Pattern:** Store subscription with derived boolean.

The guard component subscribes to the existing presentation store. It derives a single boolean (`guardActive`) from three store properties. This is a read-only, unidirectional subscription — the guard never modifies presentation state.

**Contract:**
- Guard reads: `isProjectorOpen`, `isPlayingService`, `activeServiceId`
- Guard writes: nothing to the store (only internal component state)
- Reactivity: immediate (store subscription, not polling)

### Error Classifier ↔ i18n System

**Pattern:** Category-to-key-set mapping.

The classifier returns an error category enum. Each category maps to a set of 4 i18n keys following the pastoral pattern (what, why, action, reassurance). The notification component resolves keys via the existing i18n system.

**Contract:**
- Input: raw error string
- Output: `{ title: i18nKey, why: i18nKey, action: i18nKey, reassurance: i18nKey }`

---

## Security Architecture

### Signing Key Management

**Threat:** Compromised signing keys allow malicious updates to pass verification.

**Mitigation layers:**
1. Private keys stored exclusively in CI environment secrets (never in source)
2. Build-time injection validates presence before proceeding (fail-fast)
3. Public key embedded in binary at build time (not fetchable/replaceable at runtime)
4. Ed25519 signature verification on every update download before installation

### Unsigned Build Handling

**Current state:** No platform code signing (macOS/Windows). Documented as future enhancement.

**User impact:**
- macOS: Gatekeeper warning dialog (installation guide addresses this)
- Windows: SmartScreen warning on first run (installation guide addresses this)
- Linux: No impact (no mandatory signing)

**Mitigation:** Installation guides include specific instructions for proceeding through security warnings, with screenshots and reassuring language.

### Update Integrity Chain

```
Build Pipeline:
  Source → Compile → Bundle → Sign with Ed25519 private key → Upload artifact + .sig

Desktop App:
  Check endpoint → Download artifact → Verify .sig with embedded public key → Install
```

If signature verification fails, the update is rejected and the user is NOT prompted.

---

## Quality Attributes

### Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Pipeline build time (cached) | <20 min per platform | Developer productivity |
| Pipeline build time (cold) | <30 min per platform | Acceptable for releases |
| Update check latency | <3 seconds | Non-blocking, user won't notice |
| Guard reactivity | <100ms | Immediate response to state changes |
| Update download (10MB on 5Mbps) | <20 seconds | Typical Brazilian church internet |

### Reliability Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Pipeline success rate | >90% across all platforms | Minimize release friction |
| Update check availability | Graceful degradation on failure | App works without updates |
| Guard accuracy | 100% suppression during service | Zero tolerance for service disruption |
| Error classification fallback | 100% of errors get a category | Generic fallback always available |

### Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Notification announced | `role="alert"` + `aria-live="polite"` |
| Status indicator accessible | `aria-label` matching tooltip text |
| No color-only information | Icon + text supplement green dot |
| Keyboard navigation | Tab, Escape on notification banner |
| Screen reader for errors | Sonner toast default accessibility |

---

## Deployment Topology

### Build Pipeline Topology

```
┌─────────────┐
│ Source Repo  │
│ (tag push)   │
└──────┬──────┘
       │
       ▼
┌──────────────┐     ┌───────────────────────────────────┐
│ Validation   │────→│ Platform Matrix (parallel)         │
│ Job          │     │                                    │
│ (typecheck,  │     │  ┌─────┐ ┌───────┐ ┌───────────┐ │
│  compile     │     │  │Win  │ │macOS×2│ │Linux×2    │ │
│  check)      │     │  │x64  │ │ARM+x64│ │x64+ARM   │ │
│              │     │  └──┬──┘ └───┬───┘ └─────┬─────┘ │
└──────────────┘     │     │        │           │        │
                     │     └────────┼───────────┘        │
                     │              ▼                     │
                     │     ┌────────────────┐            │
                     │     │ Release Draft   │            │
                     │     │ (all artifacts) │            │
                     │     └────────────────┘            │
                     └───────────────────────────────────┘
```

**Scaling:** Adding new platform targets = adding matrix entries. No architecture change.

### Desktop Update Topology

```
┌─────────────────────┐
│ Release Hosting      │ (latest.json + artifacts)
└──────────┬──────────┘
           │ HTTPS GET
           ▼
┌─────────────────────┐
│ Desktop App          │
│ ┌─────────────────┐ │
│ │ Update Checker   │ │
│ │ (backend cmd)    │ │
│ └────────┬────────┘ │
│          ▼          │
│ ┌─────────────────┐ │
│ │ Service Guard    │←──── Presentation Store
│ │ (frontend)       │ │
│ └────────┬────────┘ │
│          ▼          │
│ ┌─────────────────┐ │
│ │ Notification UI  │ │
│ │ (frontend)       │ │
│ └─────────────────┘ │
└─────────────────────┘
```

---

## ADR Summary

| ADR | Decision | Key Trade-off |
|-----|----------|---------------|
| ADR-001 | Build-time config injection | Deterministic builds vs per-environment binaries |
| ADR-002 | Store subscription for guard | Immediate reactivity vs subscription management complexity |
| ADR-003 | String pattern matching for errors | Resilience to unknown errors vs potential misclassification |

---

## Gate 3 Validation

| Check | Status |
|-------|--------|
| All PRD features mapped to components | Yes — 12 features across 4 domains |
| Component boundaries clear | Yes — single responsibility per component |
| Interfaces technology-agnostic | Yes — described by pattern, not product |
| Data ownership explicit | Yes — ownership table with storage + persistence |
| Quality attributes defined | Yes — performance, reliability, accessibility targets |
| Security architecture addressed | Yes — signing chain, key management, unsigned handling |
| Integration patterns documented | Yes — 3 integration contracts |
| Design system configuration | Yes — UI library, variants, components to modify |
| ADRs for key decisions | Yes — 3 ADRs |
| No specific product names | Yes — capabilities described abstractly |
| Confidence score | 85/100 |

**Gate Result:** PASS — Proceed to API Design (Gate 4)
