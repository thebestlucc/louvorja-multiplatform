---
feature: installers-pipeline
gate: 6
date: 2026-02-18
status: approved
---

# Gate 6: Dependency Map — Installation Guide & Release Pipeline

## Overview

This feature requires **no new application dependencies**. All changes use existing project packages and CI/CD tooling. The dependency map focuses on:
1. CI/CD action versions (GitHub Actions marketplace)
2. Existing project dependencies leveraged
3. External service dependencies

## CI/CD Dependencies (New)

| Dependency | Version | Purpose | License | Risk |
|------------|---------|---------|---------|------|
| `swatinem/rust-cache` | `v2` | Cache Rust compilation between CI runs | MIT | Low — widely adopted, official recommendation |
| `pnpm/action-setup` | `v4` | Install pnpm in CI (already in workflow) | MIT | Low — already used |
| `actions/setup-node` | `v4` | Install Node.js in CI (already in workflow) | MIT | Low — GitHub official |
| `dtolnay/rust-toolchain` | `stable` | Install Rust toolchain (already in workflow) | MIT | Low — already used |
| `tauri-apps/tauri-action` | `v0` | Build Tauri bundles + create release (already in workflow) | MIT | Low — official Tauri action |
| `actions/checkout` | `v4` | Clone repository (already in workflow) | MIT | Low — GitHub official |

**New addition:** Only `swatinem/rust-cache@v2` is new. All others are already in the workflow.

## Existing Application Dependencies (No Changes)

| Dependency | Layer | Version | Used For |
|------------|-------|---------|----------|
| `tauri-plugin-updater` | Rust | `2.x` | Update checking and installation |
| `@tauri-apps/api` | Frontend | `^2` | Tauri IPC bridge |
| `sonner` | Frontend | existing | Toast notifications (error display) |
| `i18next` | Frontend | existing | Localization (new keys, no version change) |
| `zustand` | Frontend | existing | Presentation store (guard reads state) |
| `lucide-react` | Frontend | existing | Icons (Download, X, Loader2) |
| `class-variance-authority` | Frontend | existing | Button variants |

## External Service Dependencies

| Service | Purpose | Required | Cost |
|---------|---------|----------|------|
| GitHub Actions | CI/CD build runners | Yes | Free for public repos, included in plan for private |
| GitHub Releases | Artifact hosting + updater endpoint | Yes | Free (included with repo) |
| GitHub ARM Runner (`ubuntu-22.04-arm`) | ARM Linux builds | Yes | Free for public repos |
| Apple Developer Program | macOS code signing (future) | No — documented only | $99/year |
| Windows OV/EV Certificate | Windows code signing (future) | No — documented only | $100-400/year |

## GitHub Secrets Required

| Secret | Purpose | Status | Required For |
|--------|---------|--------|--------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Ed25519 updater signing | Must exist | Update signatures |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing key password | Must exist | Update signatures |
| `TAURI_UPDATER_ENDPOINT` | Update check URL | Must exist | Updater configuration |
| `TAURI_UPDATER_PUBLIC_KEY` | Signature verification | Must exist | Updater configuration |
| `GITHUB_TOKEN` | Release creation | Auto-provided | Release draft |
| `APPLE_CERTIFICATE` | macOS signing (future) | Not configured | Code signing docs |
| `APPLE_CERTIFICATE_PASSWORD` | macOS cert password (future) | Not configured | Code signing docs |
| `APPLE_SIGNING_IDENTITY` | macOS identity (future) | Not configured | Code signing docs |
| `APPLE_API_ISSUER` | macOS notarization (future) | Not configured | Code signing docs |
| `APPLE_API_KEY` | macOS notarization (future) | Not configured | Code signing docs |
| `APPLE_API_KEY_PATH` | macOS notarization (future) | Not configured | Code signing docs |

## System Dependencies (Linux CI)

Packages required on Ubuntu 22.04 for Tauri builds:

| Package | Purpose |
|---------|---------|
| `libwebkit2gtk-4.1-dev` | WebView rendering engine |
| `libappindicator3-dev` | System tray support |
| `librsvg2-dev` | SVG rendering for icons |
| `patchelf` | ELF binary patching for AppImage |
| `build-essential` | C/C++ compiler toolchain |
| `libssl-dev` | OpenSSL development headers |
| `curl`, `wget`, `file` | Standard utilities |

## Version Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Ubuntu CI runner | Pin `22.04` (NOT `latest`) | glibc compatibility with older user systems |
| macOS CI runner | `macos-latest` | Supports both ARM and Intel targets |
| Windows CI runner | `windows-latest` | MSVC toolchain included |
| Rust toolchain | `stable` | Project minimum: 1.77.2 |
| Node.js | `22` (LTS) | Matches project requirements |
| pnpm | `10` | Matches project `packageManager` field |

## Compatibility Matrix

| Platform | Min User OS | WebView | Installer Format |
|----------|------------|---------|-----------------|
| Windows x64 | Windows 10 (21H2+) | WebView2 (included) | NSIS setup.exe |
| macOS ARM | macOS 10.13+ | WebKit (included) | DMG |
| macOS Intel | macOS 10.13+ | WebKit (included) | DMG |
| Linux x64 | Ubuntu 22.04+ | webkit2gtk-4.1 | AppImage + .deb |
| Linux ARM | Ubuntu 22.04+ | webkit2gtk-4.1 | AppImage |

## Gate 6 Validation

| Check | Status |
|-------|--------|
| All dependencies identified | Yes — 1 new CI dep, rest existing |
| Versions specified | Yes — pinned where stability matters |
| Licenses documented | Yes — all MIT |
| External services listed | Yes — GitHub services + future signing |
| System deps documented | Yes — Linux packages for CI |
| Risk assessment | Low — minimal new dependencies |

**Gate Result:** PASS
