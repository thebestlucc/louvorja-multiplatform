---
feature: installers-pipeline
gate: 8
phase: A - Foundation
date: 2026-02-18
status: complete
---

# Phase A Subtasks: Foundation (Pipeline Fixes)

## TASK-001: Fix signing environment variable names

### ST-001-1: Rename TAURI_PRIVATE_KEY env var (2 min)
**File:** `.github/workflows/release.yml`
**Line:** 48
**Action:** Change `TAURI_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}` to `TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}`
**Verify:** The env var name (left side) now matches Tauri 2's expected name.

### ST-001-2: Rename TAURI_KEY_PASSWORD env var (2 min)
**File:** `.github/workflows/release.yml`
**Line:** 49
**Action:** Change `TAURI_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}` to `TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}`
**Verify:** The env var name (left side) now matches Tauri 2's expected name.

---

## TASK-002: Add updater permission to capabilities

### ST-002-1: Add updater:default permission (2 min)
**File:** `src-tauri/capabilities/default.json`
**Line:** After line 28 (after `"dialog:default"`)
**Action:** Add `"updater:default"` to the permissions array.
**Verify:** JSON is valid, permission is inside the array.

---

## TASK-003: Add Linux system dependencies to CI

### ST-003-1: Add conditional apt-get step for ubuntu (3 min)
**File:** `.github/workflows/release.yml`
**Location:** In `tauri-release` job, after Rust toolchain step, before `pnpm install`
**Action:** Add step:
```yaml
- name: Install Linux dependencies
  if: ${{ contains(matrix.platform, 'ubuntu') }}
  run: |
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```
**Verify:** Condition uses `contains()` to match both `ubuntu-22.04` and `ubuntu-22.04-arm`.

---

## TASK-004: Add dual macOS architecture builds

### ST-004-1: Split macOS matrix entry into ARM + Intel (3 min)
**File:** `.github/workflows/release.yml`
**Lines:** 38-45 (matrix section)
**Action:** Replace the single `macos-latest` entry with two entries:
```yaml
- platform: macos-latest
  args: "--target aarch64-apple-darwin"
- platform: macos-latest
  args: "--target x86_64-apple-darwin"
```
**Verify:** Matrix now has 4 entries (2 macOS + ubuntu + windows).

### ST-004-2: Add Rust targets for macOS (2 min)
**File:** `.github/workflows/release.yml`
**Location:** dtolnay/rust-toolchain step
**Action:** Add conditional `targets` parameter:
```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    targets: ${{ contains(matrix.platform, 'macos') && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}
```
**Verify:** macOS runners install both target toolchains.

---

## TASK-005: Add ARM Linux build target

### ST-005-1: Add ARM matrix entry (2 min)
**File:** `.github/workflows/release.yml`
**Location:** Matrix section
**Action:** Add entry:
```yaml
- platform: ubuntu-22.04-arm
  args: ""
```
**Verify:** Matrix now has 5 entries total.

---

## TASK-006: Add Rust build caching

### ST-006-1: Add rust-cache action step (3 min)
**File:** `.github/workflows/release.yml`
**Location:** After `dtolnay/rust-toolchain` step, before `pnpm install`
**Action:** Add step:
```yaml
- name: Rust cache
  uses: swatinem/rust-cache@v2
  with:
    workspaces: './src-tauri -> target'
```
**Verify:** Step appears in workflow before build steps.

---

## Phase A Verification Checklist

After all Phase A subtasks:
- [ ] Workflow has 5 matrix entries (Win, macOS ARM, macOS Intel, Linux x64, Linux ARM)
- [ ] Env vars use correct Tauri 2 names
- [ ] Linux step installs system dependencies
- [ ] Rust cache is configured
- [ ] `updater:default` permission added to capabilities
- [ ] Run `pnpm vite build && npx tsc --noEmit` locally — should pass (no TS changes)
