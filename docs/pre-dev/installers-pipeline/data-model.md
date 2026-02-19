---
feature: installers-pipeline
gate: 5
date: 2026-02-18
status: approved
---

# Gate 5: Data Model — Installation Guide & Release Pipeline

## Overview

This feature introduces **no new database tables or persistent data models**. All data is either:
- Build-time configuration (injected at compile time)
- Ephemeral component state (React `useState`)
- Existing localStorage keys (already implemented)
- External release metadata (read-only, hosted externally)

## Existing Data (No Changes)

| Data | Location | Type | Owner |
|------|----------|------|-------|
| App version | `tauri.conf.json:version` | String (semver) | Build config |
| Updater endpoint | `tauri.conf.json:plugins.updater.endpoints` | String[] (URLs) | Build config (injected) |
| Updater public key | `tauri.conf.json:plugins.updater.pubkey` | String (Ed25519) | Build config (injected) |
| Skipped version | `localStorage["updater.skipVersion"]` | String (version) | Frontend |

## New Ephemeral State

| State | Component | Type | Persistence | Purpose |
|-------|-----------|------|-------------|---------|
| `pendingUpdate` | UpdateNotification | `boolean` | Session only (useState) | Tracks deferred update during guard |
| `guardActive` | UpdateNotification | `boolean` | Derived (computed) | Whether service/projector blocks notification |
| `updateInfo` | UpdateNotification | `UpdateInfo \| null` | Session only (existing) | Cached update metadata |

## Existing Store State Read (No Modifications)

The Service-Aware Guard reads these existing Zustand store properties (read-only, no writes):

| Property | Store | Type | Used For |
|----------|-------|------|----------|
| `isProjectorOpen` | `usePresentationStore` | `boolean` | Guard condition |
| `isPlayingService` | `usePresentationStore` | `boolean` | Guard condition |
| `activeServiceId` | `usePresentationStore` | `string \| null` | Guard condition |

## i18n Data (New Keys)

15 new keys across 3 locale files. No structural change to locale JSON — keys are added to existing `updater` namespace.

## Gate 5 Validation

| Check | Status |
|-------|--------|
| All data identified | Yes — no new persistent data; ephemeral state documented |
| Ownership explicit | Yes — per-data ownership table |
| No new DB migrations needed | Yes — zero database changes |
| Existing data documented | Yes — config + localStorage + stores |

**Gate Result:** PASS
