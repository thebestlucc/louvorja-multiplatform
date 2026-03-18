# FTP Synchronization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the legacy FTP synchronization logic to download missing or outdated content files (audio, images) from the LouvorJA server.

**Architecture:** 
1.  Extend the `legacy_fetch` Rust module to include the static `Api-Token` in headers.
2.  Add a new `ftp_sync` module to handle dynamic credential fetching (via `/ftp?token=...`), Base64 decoding, and passive FTP file downloads using `suppaftp`.
3.  Integrate the FTP sync into the `content_sync` background runner as a "Repair" or "Fallback" mechanism.
4.  Expose progress events to the frontend for real-time status updates in the Migration/Settings UI.

**Tech Stack:** 
- Rust (Backend)
- Tauri 2 (IPC & Background Tasks)
- `suppaftp` (FTP client with passive mode support)
- `reqwest` (HTTP for credential fetching)
- React 19 + TanStack Query (Frontend)

---

## Chunk 1: Backend Infrastructure & Dependencies

### Task 1: Add FTP dependencies
- [x] **Step 1: Add `suppaftp` to dependencies** (DONE)
- [x] **Step 2: Commit** (DONE)

### Task 2: Update legacy fetch headers
- [x] **Step 1: Define API_TOKEN constant** (DONE)
- [x] **Step 2: Update `fetch_params` to include header** (DONE)
- [x] **Step 3: Commit** (DONE)

---

## Chunk 2: FTP Credential Management

### Task 3: Implement FTP Credential Fetcher
- [x] **Step 1: Create FtpSettings struct** (DONE)
- [x] **Step 2: Implement `fetch_ftp_credentials(url: &str)`** (DONE)
- [x] **Step 3: Commit** (DONE)

---

## Chunk 3: FTP Synchronization Logic

### Task 4: Implement FTP Client Wrapper
- [x] **Step 1: Implement `sync_file(settings: &FtpSettings, remote_path: &str, local_path: &Path)`** (DONE)
- [x] **Step 2: Commit** (DONE)

### Task 5: Integrate with Content Sync Runner
- [x] **Step 1: Update `run_content_sync_background` to handle FTP downloads** (DONE)
- [x] **Step 2: Emit specialized progress events** (DONE)
- [x] **Step 3: Commit** (DONE)

---

## Chunk 4: Frontend & Localization

### Task 6: Add Localization Keys
- [x] **Step 1: Add FTP-related keys** (DONE)
- [x] **Step 2: Run i18n lint** (DONE)
- [x] **Step 3: Commit** (DONE)

### Task 7: Update Settings UI
- [x] **Step 1: Ensure "Start Sync" button is prominent** (DONE)
- [x] **Step 2: Verify progress display handles the new messages** (DONE)
- [x] **Step 3: Commit** (DONE)

---

## Final Verification & Fixes

- [x] **Verify Build**: `cargo check` passed. (DONE)
- [x] **Test Connection**: Manually verified `Api-Token` and FTP connectivity via `curl`. (DONE)
- [x] **Fix Parsing**: Fixed bug in `credentials.rs` where `username`/`password` weren't mapped. (DONE)
- [x] **Fix Path Resolution**: Implemented robust mapping from API URLs to FTP paths in `content_sync.rs`. (DONE)
- [x] **Fix UI**: Fixed "Verify Now" button by making `plan_content_sync` trigger a real server check. (DONE)
