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
**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add `suppaftp` to dependencies**
Add `suppaftp = { version = "6", features = ["rustls"] }` to `[dependencies]`.
- [ ] **Step 2: Commit**
```bash
git add src-tauri/Cargo.toml
git commit -m "feat(sync): add suppaftp dependency"
```

### Task 2: Update legacy fetch headers
**Files:**
- Modify: `src-tauri/src/legacy_fetch/mod.rs`

- [ ] **Step 1: Define API_TOKEN constant**
Add `const API_TOKEN: &str = "02@v2nFB2Dc";` at the top.
- [ ] **Step 2: Update `fetch_params` to include header**
Update `reqwest::Client` calls to include `.header("Api-Token", API_TOKEN)`.
- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/legacy_fetch/mod.rs
git commit -m "feat(sync): add Api-Token header to legacy fetcher"
```

---

## Chunk 2: FTP Credential Management

### Task 3: Implement FTP Credential Fetcher
**Files:**
- Create: `src-tauri/src/ftp_sync/credentials.rs`
- Modify: `src-tauri/src/lib.rs` (to register module)

- [ ] **Step 1: Create FtpSettings struct**
```rust
#[derive(Debug, Deserialize)]
pub struct FtpSettings {
    pub host: String,
    pub user: String,
    pub pass: String,
    pub port: u16,
    pub root: String,
}
```
- [ ] **Step 2: Implement `fetch_ftp_credentials(url: &str)`**
Use `reqwest` to GET the URL, decode Base64 response, and parse `key=value` lines into `FtpSettings`.
- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/ftp_sync/credentials.rs
git commit -m "feat(sync): implement dynamic FTP credential fetching"
```

---

## Chunk 3: FTP Synchronization Logic

### Task 4: Implement FTP Client Wrapper
**Files:**
- Create: `src-tauri/src/ftp_sync/client.rs`

- [ ] **Step 1: Implement `sync_file(settings: &FtpSettings, remote_path: &str, local_path: &Path)`**
Use `suppaftp` in Passive mode to download the file if missing or if size differs.
- [ ] **Step 2: Commit**
```bash
git add src-tauri/src/ftp_sync/client.rs
git commit -m "feat(sync): implement FTP download logic"
```

### Task 5: Integrate with Content Sync Runner
**Files:**
- Modify: `src-tauri/src/commands/content_sync.rs`
- Modify: `src-tauri/src/content_sync/mod.rs`

- [ ] **Step 1: Update `run_content_sync_background` to handle FTP downloads**
When a `RepairMedia` action is encountered, fetch params, get FTP credentials, and download the file.
- [ ] **Step 2: Emit specialized progress events**
Include filenames being downloaded in the `ContentSyncProgress` message.
- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/commands/content_sync.rs src-tauri/src/content_sync/mod.rs
git commit -m "feat(sync): integrate FTP sync into content sync background runner"
```

---

## Chunk 4: Frontend & Localization

### Task 6: Add Localization Keys
**Files:**
- Modify: `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`

- [ ] **Step 1: Add FTP-related keys**
Add keys for "Downloading asset...", "FTP connection error", etc.
- [ ] **Step 2: Run i18n lint**
`pnpm lint:i18n`
- [ ] **Step 3: Commit**
```bash
git add src/locales/*.json
git commit -m "feat(sync): add localization for FTP sync"
```

### Task 7: Update Settings UI
**Files:**
- Modify: `src/routes/settings/index.tsx`

- [ ] **Step 1: Ensure "Start Sync" button is prominent**
- [ ] **Step 2: Verify progress display handles the new messages**
- [ ] **Step 3: Commit**
```bash
git add src/routes/settings/index.tsx
git commit -m "feat(sync): update settings UI for FTP synchronization"
```

---

## Final Verification

- [ ] **Verify Build**: `pnpm tauri dev` (ensure bindings regenerate and no Rust errors).
- [ ] **Test Connection**: Use "Test Connection" in Settings to verify `Api-Token` works.
- [ ] **Trigger Sync**: Manually delete a cover image and run "Check Now" -> "Start Sync" to verify FTP download.
