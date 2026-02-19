---
feature: installers-pipeline
gate: 0
date: 2026-02-18
research_mode: greenfield
agents_dispatched: 4
topology:
  scope: fullstack
  structure: single-repo
  doc_organization: unified
---

# Gate 0: Research — Installation Guide & CI/CD Pipeline

## Executive Summary

The LouvorJA project already has a partially-implemented release pipeline from Phase 10, including a GitHub Actions workflow, Tauri updater plugin integration, and update notification UI. However, **3 critical bugs** prevent it from working in production: wrong signing env var names in CI, missing `updater:default` capability permission, and missing Linux system dependencies in the workflow. Beyond fixes, the feature scope includes hardening the pipeline (dual macOS architecture, Rust caching, code signing), creating comprehensive installation guides for all 3 OS platforms, and documenting the release process for maintainers.

## Research Mode

**Greenfield** — While Phase 10 created a foundation, the installation guide, code signing, and production-grade pipeline are new capabilities.

---

## Codebase Research

### Existing Infrastructure (Phase 10)

| Component | Location | Status |
|-----------|----------|--------|
| Bundle config | `src-tauri/tauri.conf.json:37-48` | Working (`targets: "all"`, `createUpdaterArtifacts: true`) |
| Updater plugin config | `src-tauri/tauri.conf.json:49-57` | Placeholder endpoint/pubkey (injected at CI time) |
| GitHub Actions workflow | `.github/workflows/release.yml:1-75` | 3 critical bugs (see below) |
| Updater config injector | `.github/scripts/inject-updater-config.mjs:1-24` | Working |
| Rust updater commands | `src-tauri/src/commands/updater.rs:1-55` | Working (`check_for_updates`, `install_update`) |
| Frontend update notification | `src/components/update-notification.tsx:1-91` | Working (skip version, remind later) |
| Query hooks | `src/lib/queries.ts:654-669` | Working (`useCheckForUpdates`, `useInstallUpdate`) |
| Plugin registration | `src-tauri/src/lib.rs:30` | Working |
| App identity | `src-tauri/tauri.conf.json:3-5` | `productName: "LouvorJA"`, `version: "0.1.0"`, `identifier: "com.louvorja"` |
| Icon set | `src-tauri/icons/` (16 files) | Complete (icns, ico, png, all Windows sizes) |
| Capabilities | `src-tauri/capabilities/default.json:1-30` | Missing `updater:default` permission |
| Updater setup guide | `docs/UPDATER_SETUP.md` | Documents 4 required GitHub secrets |

### Critical Bugs Found

1. **CRITICAL — Wrong signing env var names** (`release.yml:48-49`):
   - Uses `TAURI_PRIVATE_KEY` → should be `TAURI_SIGNING_PRIVATE_KEY`
   - Uses `TAURI_KEY_PASSWORD` → should be `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - Effect: Builds produce bundles WITHOUT `.sig` signature files, breaking the updater

2. **CRITICAL — Missing updater capability** (`capabilities/default.json`):
   - `updater:default` not in permissions array
   - Effect: Updater Rust commands will fail at runtime

3. **HIGH — Missing Linux system deps** (`release.yml`):
   - No `apt-get install` step for `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
   - Effect: Ubuntu build job WILL FAIL

### Additional Gaps

- macOS builds only target runner architecture (arm64), missing x86_64
- No `swatinem/rust-cache@v2` — Rust compilation from scratch (~15-30 min per platform)
- No macOS code signing (unsigned apps trigger Gatekeeper warnings)
- No Windows code signing (SmartScreen warnings)
- `Cargo.toml:6-7` — empty `license` and `repository` fields
- Phase 10 smoke matrix (`SMOKE-2026-02-17.md`) shows most runtime tests BLOCKED

---

## Best Practices Research

### CI/CD Pipeline Standards

- Use `fail-fast: false` matrix for independent platform builds
- Separate macOS matrix entries for `aarch64-apple-darwin` and `x86_64-apple-darwin`
- Pin `ubuntu-22.04` (not `ubuntu-latest`) for glibc compatibility
- Use `swatinem/rust-cache@v2` with `workspaces: './src-tauri -> target'`
- `releaseDraft: true` — review artifacts before publishing
- `tauri-action@v0` auto-generates `latest.json` for updater when `uploadUpdaterJson: true`

### Installer Types per Platform

| Platform | Primary | Secondary | Notes |
|----------|---------|-----------|-------|
| Windows | NSIS (.exe) | MSI | NSIS supports per-user install, cross-compilation |
| macOS | DMG (.dmg) | .app bundle | Standard drag-to-Applications pattern |
| Linux | AppImage | .deb, .rpm | AppImage = no install step, maximum compatibility |

### Code Signing

| Platform | Requirement | Cost | CI Secrets Needed |
|----------|-------------|------|-------------------|
| macOS | Apple Developer ID + notarization | $99/year | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH` |
| Windows | OV/EV certificate or Azure Trusted Signing | $100-400/year | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` |
| Linux | Not mandatory | Free | GPG key (optional) |

### Auto-Update Best Practices

- Use GitHub Releases as updater endpoint (free, `latest.json` auto-generated)
- Ed25519 signature verification (built into Tauri updater)
- Never auto-restart without explicit user confirmation
- Prefer App Store Connect API keys over Apple ID for CI notarization (no 2FA issues)

### Anti-Patterns to Avoid

- Building on `ubuntu-latest` (glibc compatibility breaks)
- Storing signing keys in repository
- Using `fixedVersion` WebView2 mode (+180MB, no security updates)
- Auto-publishing releases (platform may fail, incomplete artifacts)
- Mixing Tauri v1 and v2 updater patterns

---

## Framework Documentation

### Tauri 2 Build Command Flags

| Flag | Description |
|------|-------------|
| `--target <TRIPLE>` | Target architecture (e.g., `aarch64-apple-darwin`) |
| `--bundles <TYPES>` | Specific bundle types: `deb`, `rpm`, `appimage`, `nsis`, `msi`, `app`, `dmg` |
| `--ci` | Skip interactive prompts |
| `--no-sign` | Skip code signing |

### Tauri Signer

```bash
pnpm tauri signer generate -- -w ~/.tauri/louvorja.key  # generate keypair
```

### Updater Endpoint JSON Format

```json
{
  "version": "1.0.0",
  "notes": "Release notes",
  "pub_date": "2026-01-15T10:30:00Z",
  "platforms": {
    "linux-x86_64": { "signature": "...", "url": "https://..." },
    "darwin-x86_64": { "signature": "...", "url": "https://..." },
    "darwin-aarch64": { "signature": "...", "url": "https://..." },
    "windows-x86_64": { "signature": "...", "url": "https://..." }
  }
}
```

### Platform Prerequisites for Building

| Platform | Required Packages |
|----------|-------------------|
| Ubuntu/Debian | `libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf` |
| Windows | MSVC Build Tools ("Desktop development with C++"), WebView2 Runtime |
| macOS | Xcode Command Line Tools (`xcode-select --install`) |

### Windows NSIS Configuration

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "installMode": "both"
      }
    }
  }
}
```

### WebView2 Install Modes

| Mode | Size | Recommended |
|------|------|-------------|
| `downloadBootstrapper` (default) | 0 MB | Yes — Windows 10+ includes WebView2 |
| `offlineInstaller` | ~127 MB | Only for air-gapped environments |

---

## Product/UX Research

### User Personas

1. **Carlos (Worship Leader)** — Tech-comfortable, 32yo. Sets up 30min before service. Curated 400+ hymn library. "I just need it to work."
2. **Dona Maria (Volunteer)** — Non-technical, 58yo. Operates projection during service. "When the computer shows me something I don't understand, I freeze."
3. **Ricardo (Church IT Admin)** — Technical, 45yo. Manages 3 church machines. "I need to set it up once and trust it will keep working."

### Critical UX Requirements

1. **Service-aware update guard** (P0): Suppress ALL update UI when projector is open or service is active. No competitor does this.
2. **Pastoral error messaging** (P0): "What happened → Why → What to do → Your data is safe" pattern in PT/EN/ES.
3. **Per-user install** (P1): NSIS `installMode: "both"` — no admin rights needed by default.
4. **Offline-first install** (P1): Full offline installer, first-run works without network.
5. **Small bundle advantage** (P1): ~10MB Tauri bundle vs 150MB+ Electron competitors.

### Competitive Positioning

| Feature | ProPresenter | EasyWorship | OpenLP | FreeShow | LouvorJA |
|---------|-------------|-------------|--------|----------|----------|
| No-admin install | No | No | Varies | Yes | **Yes** |
| Service-aware update guard | No | No | N/A | No | **Yes** |
| Cross-platform | macOS/Win | Win only | All | All | **All** |
| Multi-language install | No | No | Yes | Partial | **Yes (PT/EN/ES)** |
| Auto-update | Manual | Manual | No | Auto | **User-controlled** |
| Bundle size | ~200MB | ~150MB | ~80MB | ~150MB | **~10MB** |

---

## Synthesis

### Key Patterns to Follow

- Existing `tauri-action@v0` integration (`.github/workflows/release.yml`) — fix and extend, don't rewrite
- Updater injection pattern (`.github/scripts/inject-updater-config.mjs`) — proven, keep as-is
- Update notification UI (`src/components/update-notification.tsx`) — already has skip/remind/install
- Draft release pattern — human reviews before publishing

### Constraints Identified

- macOS code signing requires Apple Developer Program ($99/year) — document as optional
- Windows signing requires OV/EV certificate — document as optional
- Tauri updater requires `.sig` files — BLOCKED by env var bug
- `updater:default` permission missing — BLOCKS updater at runtime

### Open Questions for PRD

1. Should we support ARM Linux builds (`ubuntu-22.04-arm` runner)?
2. Is macOS/Windows code signing in scope now, or documented as future enhancement?
3. Should the installation guide be in-app (onboarding) or external (docs/website)?
4. Version bump strategy: manual, semver-based, or automated via conventional commits?
5. Should we target a specific version number for the first release (e.g., 1.0.0)?

---

## External References

### Official Documentation
- [Tauri 2 Distribute Overview](https://v2.tauri.app/distribute/)
- [GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/)
- [macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/)
- [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [Windows Installer Config](https://v2.tauri.app/distribute/windows-installer/)
- [Updater Plugin](https://v2.tauri.app/plugin/updater/)
- [AppImage Distribution](https://v2.tauri.app/distribute/appimage/)
- [Debian Distribution](https://v2.tauri.app/distribute/debian/)

### Tools & Actions
- [tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action)
- [swatinem/rust-cache](https://github.com/swatinem/rust-cache)
- [dtolnay/rust-toolchain](https://github.com/dtolnay/rust-toolchain)

### Articles
- [Tauri Auto-Updater Guide](https://thatgurjot.com/til/tauri-auto-updater/)
- [Signing and Notarizing Tauri Apps](https://loewald.com/blog/2024/12/18/signing-and-notarizing-tauri-apps)
- [Packaging Tauri v2 for Flatpak/Snapcraft](https://vincent.jousse.org/blog/en/packaging-tauri-v2-flatpak-snapcraft-elm/)
