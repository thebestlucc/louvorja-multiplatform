# FTP Sync — Implement Create/Update Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-03-18
**Goal:** Replace the `_ => { applied_count += 1; }` placeholder in `run_content_sync_background` with real implementations of `CreateHymn`, `UpdateHymn`, `CreateAlbum`, `UpdateAlbum`, and `DeleteRemoteManagedHymn`/`DeleteRemoteManagedAlbum`. Also upgrade `plan_content_sync` (and `start_content_sync`) to fetch the API manifest and call `build_manifest_plan` instead of `build_degraded_plan` when the API is reachable.

**Architecture:** Tauri 2 + Rust background thread (sync) + `tauri::async_runtime::block_on` to call async API fetchers from a sync context. SQLite via r2d2 pool. FTP via suppaftp, lazily connected once per run and reused.

**Tech stack touches:**
- `src-tauri/src/commands/content_sync.rs` — primary file for all changes
- `src-tauri/src/content_sync/mod.rs` — `build_manifest_plan` already complete, no changes needed
- `src-tauri/src/content_sync/importer.rs` — already complete, consumed as-is
- `src-tauri/src/legacy_fetch/mod.rs` — already exposes `fetch_hymnal_page`, `fetch_albums_page`, `fetch_album_musics_page`, `fetch_music_detail`; `ApiLanguage` already derives `Clone + Copy`

---

## Pre-flight: Verify current state compiles

- [ ] Run `cargo build --manifest-path src-tauri/Cargo.toml` and confirm it succeeds on the current codebase before making any changes.

---

## Task 1 — Add helper functions to `commands/content_sync.rs`

These are private helpers used by the new execution arms and the upgraded plan functions. Add them after the `get_app_lang` function (around line 978 in the current file).

**Estimated time:** 3–4 minutes

### Steps

- [ ] Open `src-tauri/src/commands/content_sync.rs`.

- [ ] After the `get_app_lang` function (current last function before `#[cfg(test)]`), add the following three helper functions:

```rust
// ─────────────────────────────────────────────────────────────────────────────
// Sync execution helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Convert a language string (from app settings) to the API language enum.
fn lang_to_api_language(lang: &str) -> crate::legacy_fetch::ApiLanguage {
    match lang {
        "en" => crate::legacy_fetch::ApiLanguage::En,
        "es" => crate::legacy_fetch::ApiLanguage::Es,
        _ => crate::legacy_fetch::ApiLanguage::Pt,
    }
}

/// Download a single asset file via the already-open FTP stream.
/// Derives the local relative path from the HTTP URL (same layout as the HTTP importer:
/// `media/{subfolder}/{api_id}/{filename}`), skips if the file already exists locally,
/// and returns the relative path on success.
///
/// Returns `None` if the URL is absent, the FTP stream is not available,
/// or the download fails (errors are logged, not propagated).
fn download_asset_via_ftp(
    ftp_stream: &mut Option<FtpStream>,
    url: &Option<String>,
    subfolder: &str,
    api_id: i64,
    app_data_dir: &std::path::Path,
) -> Option<String> {
    let url = url.as_ref()?;
    if url.is_empty() {
        return None;
    }
    let rel_path = content_sync::derive_local_media_path(url, subfolder, api_id);
    let full_path = app_data_dir.join(&rel_path);
    if full_path.exists() {
        return Some(rel_path);
    }
    let remote_path = content_sync::resolve_remote_path_from_url(url);
    if let Some(stream) = ftp_stream {
        match ftp_sync::client::sync_file_on_stream(stream, &remote_path, &full_path) {
            Ok(()) => return Some(rel_path),
            Err(e) => {
                eprintln!(
                    "[sync] FTP download failed for '{}' -> '{}': {}",
                    remote_path,
                    full_path.display(),
                    e
                );
            }
        }
    }
    None
}

/// Ensure FTP credentials and stream are initialized.
/// Both `ftp_settings` and `ftp_stream` are lazily populated once per run and reused.
/// Returns `true` if the stream is ready after this call, `false` if unavailable.
fn ensure_ftp_ready(
    app: &AppHandle,
    ftp_settings: &mut Option<ftp_sync::credentials::FtpSettings>,
    ftp_stream: &mut Option<FtpStream>,
) -> bool {
    // Lazy-fetch credentials
    if ftp_settings.is_none() {
        let lang = get_app_lang(app);
        let params_res =
            tauri::async_runtime::block_on(legacy_fetch::fetcher::fetch_params());
        if let Ok(params) = params_res {
            if let Some(conn_ftp_url) = params.conn_ftp {
                let creds_res = tauri::async_runtime::block_on(
                    ftp_sync::credentials::fetch_ftp_credentials(&conn_ftp_url, &lang),
                );
                match creds_res {
                    Ok(settings) => *ftp_settings = Some(settings),
                    Err(e) => {
                        eprintln!("[sync] Failed to fetch FTP credentials: {}", e);
                        return false;
                    }
                }
            }
        }
    }

    let Some(ref settings) = ftp_settings else {
        return false;
    };

    // Lazy-connect stream
    if ftp_stream.is_none() {
        match ftp_sync::client::get_ftp_client(settings) {
            Ok(stream) => *ftp_stream = Some(stream),
            Err(e) => {
                eprintln!("[sync] FTP connect failed: {}", e);
                return false;
            }
        }
    }

    ftp_stream.is_some()
}
```

- [ ] Verify compilation: `cargo build --manifest-path src-tauri/Cargo.toml`

- [ ] Commit: `git add src-tauri/src/commands/content_sync.rs && git commit -m "feat(sync): add download_asset_via_ftp, ensure_ftp_ready, lang_to_api_language helpers"`

---

## Task 2 — Implement `CreateHymn` / `UpdateHymn` execution

Replace the `_ => { applied_count += 1; }` arm in `run_content_sync_background` with match arms for the two hymn mutation actions.

**Estimated time:** 5–7 minutes

### Context

The `_ =>` arm is at approximately line 505–508 of the current `content_sync.rs`:

```rust
_ => {
    // Placeholder for other actions (CreateHymn, UpdateHymn, etc.)
    applied_count += 1;
}
```

### Steps

- [ ] Replace the `_ => { applied_count += 1; }` arm with the following. The new arm for hymns goes first; the generic `_ =>` arm remains as a safeguard after all explicit arms.

```rust
ContentSyncPlanItemAction::CreateHymn | ContentSyncPlanItemAction::UpdateHymn => {
    let is_update =
        matches!(item.action, ContentSyncPlanItemAction::UpdateHymn);
    let Some(api_id) = item.remote_id else {
        eprintln!("[sync] {:?}: skipping — no remote_id", item.action);
        skipped_count += 1;
        continue;
    };

    emit_progress(
        &app,
        &run_id,
        "executing",
        ContentSyncRunStatus::Running,
        percent,
        Some(format!(
            "{} hymn (api_id={})…",
            if is_update { "Updating" } else { "Creating" },
            api_id
        )),
        processed,
    );

    // Ensure FTP is ready (credentials + connection)
    if !ensure_ftp_ready(&app, &mut ftp_settings, &mut ftp_stream) {
        eprintln!("[sync] {:?}: FTP unavailable — skipping api_id={}", item.action, api_id);
        skipped_count += 1;
        continue;
    }

    // Fetch full hymn detail (includes lyrics)
    let lang = get_app_lang(&app);
    let api_lang = lang_to_api_language(&lang);
    let detail_res = tauri::async_runtime::block_on(
        crate::legacy_fetch::fetcher::fetch_music_detail(api_lang, api_id),
    );
    let music = match detail_res {
        Ok(m) => m,
        Err(e) => {
            eprintln!(
                "[sync] {:?}: fetch_music_detail failed for api_id={}: {}",
                item.action, api_id, e
            );
            failed_count += 1;
            continue;
        }
    };

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();

    // Download assets via FTP
    let audio_path = download_asset_via_ftp(
        &mut ftp_stream,
        &music.url_music,
        "audio",
        api_id,
        &app_data_dir,
    );
    let playback_path = download_asset_via_ftp(
        &mut ftp_stream,
        &music.url_instrumental_music,
        "playback",
        api_id,
        &app_data_dir,
    );
    let cover_path = download_asset_via_ftp(
        &mut ftp_stream,
        &music.url_image,
        "images",
        api_id,
        &app_data_dir,
    );

    // Import (upsert) into DB
    let conn_res = app
        .try_state::<AppState>()
        .ok_or(())
        .and_then(|s| s.db.get().map_err(|_| ()));
    let Ok(conn) = conn_res else {
        eprintln!("[sync] {:?}: DB connection unavailable", item.action);
        failed_count += 1;
        continue;
    };

    match crate::content_sync::importer::import_music_to_db(
        &conn,
        &music,
        audio_path.as_deref(),
        playback_path.as_deref(),
        cover_path.as_deref(),
        is_update, // replace_existing = true for UpdateHymn
        None,       // album_name — not known at hymn level
        Some(api_id),
        Some("hymnal"),
    ) {
        Ok((_, Some(local_id))) => {
            // Persist the local_id into content_sync_entities so future plan
            // runs can resolve this entity without re-creating it.
            let _ = crate::db::queries::content_sync::set_content_sync_entity_local_id(
                &conn,
                "hymn",
                api_id,
                local_id,
            );
            applied_count += 1;
        }
        Ok((_, None)) => {
            eprintln!(
                "[sync] {:?}: import returned no local id for api_id={}",
                item.action, api_id
            );
            failed_count += 1;
        }
        Err(e) => {
            eprintln!(
                "[sync] {:?}: import_music_to_db failed for api_id={}: {}",
                item.action, api_id, e
            );
            failed_count += 1;
        }
    }
}

ContentSyncPlanItemAction::CreateAlbum | ContentSyncPlanItemAction::UpdateAlbum => {
    // (implemented in Task 3 — leave as placeholder for now)
    applied_count += 1;
}

ContentSyncPlanItemAction::DeleteRemoteManagedHymn
| ContentSyncPlanItemAction::DeleteRemoteManagedAlbum => {
    // (implemented in Task 4 — leave as placeholder for now)
    skipped_count += 1;
}

_ => {
    // Remaining unhandled variants (RelinkCollectionHymn, etc.)
    applied_count += 1;
}
```

- [ ] Check if `set_content_sync_entity_local_id` exists in `src-tauri/src/db/queries/content_sync.rs`. If it does not exist yet, add it now:

```rust
/// Update the local_id of an existing content_sync_entities row.
/// Called after CreateHymn/CreateAlbum so the next plan run resolves the entity.
pub fn set_content_sync_entity_local_id(
    conn: &Connection,
    entity_type: &str,
    remote_id: i64,
    local_id: i64,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE content_sync_entities SET local_id = ?1, updated_local_at = datetime('now')
         WHERE entity_type = ?2 AND remote_id = ?3",
        rusqlite::params![local_id, entity_type, remote_id],
    )?;
    Ok(())
}
```

- [ ] Verify compilation: `cargo build --manifest-path src-tauri/Cargo.toml`

- [ ] Commit: `git add src-tauri/src/commands/content_sync.rs src-tauri/src/db/queries/content_sync.rs && git commit -m "feat(sync): implement CreateHymn/UpdateHymn execution — fetch detail, download via FTP, upsert to DB"`

---

## Task 3 — Implement `CreateAlbum` / `UpdateAlbum` execution

Replace the `CreateAlbum | UpdateAlbum` placeholder from Task 2.

**Estimated time:** 5–7 minutes

### Context

`CreateAlbum` requires:
1. Fetching all pages of songs for the album from `fetch_album_musics_page`.
2. Downloading the album cover via FTP (cover URL comes from the first song's `url_image` or is absent if the API does not return a top-level album cover on this endpoint).
3. Upserting the collection via `upsert_api_album_collection`.
4. For each song: fetching full detail (for lyrics), downloading assets, calling `import_music_and_link_to_collection`.

### Note on album cover URL

The `fetch_album_musics_page` endpoint returns `ApiMusic` records, not a top-level `ApiAlbum` with its own cover. We need to fetch the album list page to get the `url_image` for the album. The simplest approach: use `fetch_albums_page` with `page=1`, find the matching `id_album`, and use its `url_image`. If not found on page 1, leave cover as `None` (the image repair will fix it later). This avoids paginating the entire album list just to find one cover.

### Steps

- [ ] Replace the `ContentSyncPlanItemAction::CreateAlbum | ContentSyncPlanItemAction::UpdateAlbum => { applied_count += 1; }` placeholder with:

```rust
ContentSyncPlanItemAction::CreateAlbum | ContentSyncPlanItemAction::UpdateAlbum => {
    let is_update =
        matches!(item.action, ContentSyncPlanItemAction::UpdateAlbum);
    let Some(api_id) = item.remote_id else {
        eprintln!("[sync] {:?}: skipping — no remote_id", item.action);
        skipped_count += 1;
        continue;
    };

    emit_progress(
        &app,
        &run_id,
        "executing",
        ContentSyncRunStatus::Running,
        percent,
        Some(format!(
            "{} album (api_id={})…",
            if is_update { "Updating" } else { "Creating" },
            api_id
        )),
        processed,
    );

    // Ensure FTP is ready
    if !ensure_ftp_ready(&app, &mut ftp_settings, &mut ftp_stream) {
        eprintln!("[sync] {:?}: FTP unavailable — skipping api_id={}", item.action, api_id);
        skipped_count += 1;
        continue;
    }

    let lang = get_app_lang(&app);
    let api_lang = lang_to_api_language(&lang);

    // Fetch all song pages for this album
    let mut all_musics: Vec<crate::legacy_fetch::ApiMusic> = Vec::new();
    let mut page = 1i64;
    let mut fetch_failed = false;
    loop {
        let page_res = tauri::async_runtime::block_on(
            crate::legacy_fetch::fetcher::fetch_album_musics_page(api_lang, api_id, page),
        );
        match page_res {
            Ok(resp) => {
                let is_last = resp.data.is_empty()
                    || resp.last_page.map_or(true, |lp| page >= lp);
                all_musics.extend(resp.data);
                if is_last {
                    break;
                }
                page += 1;
            }
            Err(e) => {
                eprintln!(
                    "[sync] {:?}: fetch_album_musics_page failed for api_id={} page={}: {}",
                    item.action, api_id, page, e
                );
                fetch_failed = true;
                break;
            }
        }
    }
    if fetch_failed {
        failed_count += 1;
        continue;
    }

    // Try to obtain album cover URL: look in the already-fetched plan item label,
    // or fetch albums page 1 to find a matching ApiAlbum with url_image.
    let album_cover_url: Option<String> = {
        let albums_res = tauri::async_runtime::block_on(
            crate::legacy_fetch::fetcher::fetch_albums_page(api_lang, 1),
        );
        albums_res.ok().and_then(|resp| {
            resp.data
                .into_iter()
                .find(|a| a.id_album == api_id)
                .and_then(|a| a.url_image)
        })
    };

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();

    // Download album cover via FTP
    let cover_path = download_asset_via_ftp(
        &mut ftp_stream,
        &album_cover_url,
        "album_covers",
        api_id,
        &app_data_dir,
    );

    // Build a minimal ApiAlbum for upsert_api_album_collection
    let album_name = item
        .label
        .clone()
        .unwrap_or_else(|| format!("Album {}", api_id));
    let api_album = crate::legacy_fetch::ApiAlbum {
        id_album: api_id,
        name: album_name.clone(),
        color: None,
        id_file_image: None,
        url_image: album_cover_url.clone(),
        subtitle: None,
        order: None,
        image_version: None,
        musics: Vec::new(), // songs imported separately below
    };

    let release_year = album_cover_url
        .as_deref()
        .and_then(crate::content_sync::importer::extract_year_from_url);

    let conn_res = app
        .try_state::<AppState>()
        .ok_or(())
        .and_then(|s| s.db.get().map_err(|_| ()));
    let Ok(conn) = conn_res else {
        eprintln!("[sync] {:?}: DB connection unavailable", item.action);
        failed_count += 1;
        continue;
    };

    let collection_id = match crate::content_sync::importer::upsert_api_album_collection(
        &conn,
        &api_album,
        cover_path.as_deref(),
        release_year,
    ) {
        Ok((id, _)) => id,
        Err(e) => {
            eprintln!(
                "[sync] {:?}: upsert_api_album_collection failed for api_id={}: {}",
                item.action, api_id, e
            );
            failed_count += 1;
            continue;
        }
    };

    // Persist local_id in content_sync_entities
    let _ = crate::db::queries::content_sync::set_content_sync_entity_local_id(
        &conn,
        "album",
        api_id,
        collection_id,
    );

    // Import each song and link it to the collection
    let music_count = all_musics.len();
    for (i, music_stub) in all_musics.iter().enumerate() {
        // Fetch full music detail for lyrics
        let full_music_res = tauri::async_runtime::block_on(
            crate::legacy_fetch::fetcher::fetch_music_detail(api_lang, music_stub.id_music),
        );
        let music = full_music_res.unwrap_or_else(|e| {
            eprintln!(
                "[sync] Album {}: fetch_music_detail failed for song id={}: {} — using stub",
                api_id, music_stub.id_music, e
            );
            music_stub.clone()
        });

        let audio = download_asset_via_ftp(
            &mut ftp_stream,
            &music.url_music,
            "audio",
            music.id_music,
            &app_data_dir,
        );
        let playback = download_asset_via_ftp(
            &mut ftp_stream,
            &music.url_instrumental_music,
            "playback",
            music.id_music,
            &app_data_dir,
        );
        let song_cover = download_asset_via_ftp(
            &mut ftp_stream,
            &music.url_image,
            "images",
            music.id_music,
            &app_data_dir,
        );
        let media = crate::content_sync::importer::DownloadedMusicMedia {
            audio_path: audio,
            playback_path: playback,
            cover_path: song_cover,
        };

        if let Err(e) = crate::content_sync::importer::import_music_and_link_to_collection(
            &conn,
            collection_id,
            &music,
            &media,
            is_update,
            Some(&album_name),
            Some("album"),
            (i as i64) + 1,
        ) {
            eprintln!(
                "[sync] Album {}: import_music_and_link failed for song id={}: {}",
                api_id, music.id_music, e
            );
        }
    }

    eprintln!(
        "[sync] {:?}: album api_id={} done — {} songs processed",
        item.action, api_id, music_count
    );
    applied_count += 1;
}
```

- [ ] Verify compilation: `cargo build --manifest-path src-tauri/Cargo.toml`

- [ ] Commit: `git add src-tauri/src/commands/content_sync.rs && git commit -m "feat(sync): implement CreateAlbum/UpdateAlbum execution — fetch all song pages, download via FTP, upsert collection + songs"`

---

## Task 4 — Implement `DeleteRemoteManagedHymn` / `DeleteRemoteManagedAlbum`

Safe-delete: mark as inactive rather than hard-deleting, to preserve any user annotations or service references.

**Estimated time:** 2–3 minutes

### Steps

- [ ] Replace the `DeleteRemoteManagedHymn | DeleteRemoteManagedAlbum => { skipped_count += 1; }` placeholder with:

```rust
ContentSyncPlanItemAction::DeleteRemoteManagedHymn => {
    // Do not hard-delete locally — the user may have service items or annotations.
    // Just mark the content_sync_entities row as deleted so future plan runs
    // don't keep emitting this action.
    if let Some(api_id) = item.remote_id {
        if let Ok(state) = app.try_state::<AppState>().ok_or(()) {
            if let Ok(conn) = state.db.get() {
                let _ = conn.execute(
                    "UPDATE content_sync_entities SET deleted = 1, updated_local_at = datetime('now')
                     WHERE entity_type = 'hymn' AND remote_id = ?1",
                    rusqlite::params![api_id],
                );
                eprintln!(
                    "[sync] DeleteRemoteManagedHymn: marked api_id={} as deleted in content_sync_entities (not hard-deleted)",
                    api_id
                );
            }
        }
    }
    skipped_count += 1;
}

ContentSyncPlanItemAction::DeleteRemoteManagedAlbum => {
    // Same safe-delete pattern as DeleteRemoteManagedHymn.
    if let Some(api_id) = item.remote_id {
        if let Ok(state) = app.try_state::<AppState>().ok_or(()) {
            if let Ok(conn) = state.db.get() {
                let _ = conn.execute(
                    "UPDATE content_sync_entities SET deleted = 1, updated_local_at = datetime('now')
                     WHERE entity_type = 'album' AND remote_id = ?1",
                    rusqlite::params![api_id],
                );
                eprintln!(
                    "[sync] DeleteRemoteManagedAlbum: marked api_id={} as deleted in content_sync_entities (not hard-deleted)",
                    api_id
                );
            }
        }
    }
    skipped_count += 1;
}
```

- [ ] Remove or keep the trailing `_ => { applied_count += 1; }` catch-all — keep it to handle `RelinkCollectionHymn` gracefully until it is implemented.

- [ ] Verify compilation: `cargo build --manifest-path src-tauri/Cargo.toml`

- [ ] Commit: `git add src-tauri/src/commands/content_sync.rs && git commit -m "feat(sync): implement safe-delete for DeleteRemoteManagedHymn/Album — marks deleted in entities table, preserves local data"`

---

## Task 5 — Upgrade `plan_content_sync` to use `build_manifest_plan`

Currently `plan_content_sync` always calls `build_degraded_plan`. Upgrade it to:
1. Fetch all hymnal pages from the API.
2. Fetch all album pages.
3. Convert `ApiMusic`/`ApiAlbum` → `ContentSyncRemoteEntityInput`.
4. Call `build_manifest_plan` when the API is reachable; fall back to `build_degraded_plan` if any fetch fails.

Also upgrade `start_content_sync` the same way (it builds its own plan independently of `plan_content_sync`).

**Estimated time:** 5–8 minutes

### Helper functions to add (async, for `plan_content_sync`)

Add these as `async fn` at module level in `commands/content_sync.rs` (not inside `run_content_sync_background` which is sync):

```rust
/// Fetch all pages of the hymnal list for a given language.
async fn fetch_all_hymnal_pages(
    lang: crate::legacy_fetch::ApiLanguage,
) -> Result<Vec<crate::legacy_fetch::ApiMusic>, AppError> {
    let mut all = Vec::new();
    let mut page = 1i64;
    loop {
        let resp = crate::legacy_fetch::fetcher::fetch_hymnal_page(lang, page).await?;
        let is_last = resp.data.is_empty()
            || resp.last_page.map_or(true, |lp| page >= lp);
        all.extend(resp.data);
        if is_last {
            break;
        }
        page += 1;
    }
    Ok(all)
}

/// Fetch all pages of the album list for a given language.
async fn fetch_all_album_pages(
    lang: crate::legacy_fetch::ApiLanguage,
) -> Result<Vec<crate::legacy_fetch::ApiAlbum>, AppError> {
    let mut all = Vec::new();
    let mut page = 1i64;
    loop {
        let resp = crate::legacy_fetch::fetcher::fetch_albums_page(lang, page).await?;
        let is_last = resp.data.is_empty()
            || resp.last_page.map_or(true, |lp| page >= lp);
        all.extend(resp.data);
        if is_last {
            break;
        }
        page += 1;
    }
    Ok(all)
}

/// Convert an `ApiMusic` entry from the hymnal list to a `ContentSyncRemoteEntityInput`.
/// We use the URL fields as version fingerprints because the API does not expose
/// explicit version numbers on the hymnal list endpoint.
fn api_music_to_entity_input(music: &crate::legacy_fetch::ApiMusic) -> ContentSyncRemoteEntityInput {
    ContentSyncRemoteEntityInput {
        entity_type: "hymn".to_string(),
        remote_id: music.id_music,
        local_id: None,
        remote_version: music.track, // track number is stable enough as a proxy version
        content_hash: None,
        lyrics_hash: None,
        image_version: music.url_image.clone(),
        audio_version: music.url_music.clone(),
        playback_version: music.url_instrumental_music.clone(),
        updated_at: None,
        deleted: false,
    }
}

/// Convert an `ApiAlbum` entry to a `ContentSyncRemoteEntityInput`.
fn api_album_to_entity_input(album: &crate::legacy_fetch::ApiAlbum) -> ContentSyncRemoteEntityInput {
    ContentSyncRemoteEntityInput {
        entity_type: "album".to_string(),
        remote_id: album.id_album,
        local_id: None,
        remote_version: album.order,
        content_hash: None,
        lyrics_hash: None,
        image_version: album.url_image.clone(),
        audio_version: None,
        playback_version: None,
        updated_at: None,
        deleted: false,
    }
}
```

Note: `ContentSyncRemoteEntityInput` must be in scope. It already is via the `use crate::db::models::` import at the top of the file — confirm it's included, and add it if not.

### Upgrade `plan_content_sync`

Replace the current body of `plan_content_sync` (lines ~40–68) with:

```rust
#[tauri::command]
#[specta::specta]
pub async fn plan_content_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ContentSyncPlan, AppError> {
    // Fetch remote params to get db_version
    let params_res = legacy_fetch::fetcher::fetch_params().await;
    let remote_version = match &params_res {
        Ok(p) => p.db_version,
        Err(_) => None,
    };

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    // Record the check timestamp + remote version
    let _ = crate::db::queries::content_sync::mark_content_sync_checked(&conn, remote_version, None);

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let file_exists = |rel_path: &str| {
        let full_path = app_data_dir.join(rel_path);
        std::fs::metadata(full_path).is_ok()
    };

    // Attempt smart manifest plan if the API is reachable
    let lang = get_app_lang(&app);
    let api_lang = lang_to_api_language(&lang);

    let hymns_res = fetch_all_hymnal_pages(api_lang).await;
    let albums_res = fetch_all_album_pages(api_lang).await;

    match (hymns_res, albums_res) {
        (Ok(hymns), Ok(albums)) => {
            let hymn_inputs: Vec<ContentSyncRemoteEntityInput> =
                hymns.iter().map(api_music_to_entity_input).collect();
            let album_inputs: Vec<ContentSyncRemoteEntityInput> =
                albums.iter().map(api_album_to_entity_input).collect();

            content_sync::build_manifest_plan(
                &conn,
                remote_version,
                &hymn_inputs,
                &album_inputs,
                &file_exists,
            )
        }
        (hymns_res, albums_res) => {
            // Log whichever fetch failed
            if let Err(e) = hymns_res {
                eprintln!("[plan] fetch_all_hymnal_pages failed: {}", e);
            }
            if let Err(e) = albums_res {
                eprintln!("[plan] fetch_all_album_pages failed: {}", e);
            }
            // Fall back to degraded plan (repairs only)
            let summary = content_sync::load_summary(&conn, &file_exists)?;
            content_sync::build_degraded_plan(&conn, summary, &file_exists)
        }
    }
}
```

### Upgrade `start_content_sync`

`start_content_sync` is a sync Tauri command but calls `tauri::async_runtime::block_on` — it can use the same pattern. Replace the plan-building section (lines ~104–115):

```rust
// Attempt smart manifest plan; fall back to degraded if API unreachable
let lang = get_app_lang(&app);
let api_lang = lang_to_api_language(&lang);

let hymns_res = tauri::async_runtime::block_on(fetch_all_hymnal_pages(api_lang));
let albums_res = tauri::async_runtime::block_on(fetch_all_album_pages(api_lang));

let plan = match (hymns_res, albums_res) {
    (Ok(hymns), Ok(albums)) => {
        let hymn_inputs: Vec<ContentSyncRemoteEntityInput> =
            hymns.iter().map(api_music_to_entity_input).collect();
        let album_inputs: Vec<ContentSyncRemoteEntityInput> =
            albums.iter().map(api_album_to_entity_input).collect();
        content_sync::build_manifest_plan(
            &conn,
            remote_version,
            &hymn_inputs,
            &album_inputs,
            &file_exists,
        )?
    }
    _ => {
        let summary = content_sync::load_summary(&conn, &file_exists)?;
        content_sync::build_degraded_plan(&conn, summary, &file_exists)?
    }
};
```

Note: `fetch_all_hymnal_pages` and `fetch_all_album_pages` are `async fn` but called via `block_on` from a sync context — this is safe because `start_content_sync` is called from a Tauri command handler (not already inside a block_on). The background thread spawned after (`std::thread::spawn`) is separate and unaffected.

- [ ] Add `ContentSyncRemoteEntityInput` to the `use crate::db::models::` import at the top of `commands/content_sync.rs` if not already present.

- [ ] Verify compilation: `cargo build --manifest-path src-tauri/Cargo.toml`

- [ ] Run unit tests: `cargo test --manifest-path src-tauri/Cargo.toml`

- [ ] Commit: `git add src-tauri/src/commands/content_sync.rs && git commit -m "feat(sync): upgrade plan_content_sync + start_content_sync to use build_manifest_plan when API is reachable"`

---

## Task 6 — Add `set_content_sync_entity_local_id` to DB queries (if missing)

This step ensures the DB query function introduced in Task 2 is properly placed.

**Estimated time:** 2 minutes

### Steps

- [ ] Open `src-tauri/src/db/queries/content_sync.rs`.

- [ ] Search for `set_content_sync_entity_local_id`. If it already exists, skip this task.

- [ ] If absent, add the following function near the other `UPDATE` helpers in that file:

```rust
/// Update the local_id of an existing content_sync_entities row after a CreateHymn/CreateAlbum
/// execution, so future plan runs resolve the entity without re-creating it.
pub fn set_content_sync_entity_local_id(
    conn: &Connection,
    entity_type: &str,
    remote_id: i64,
    local_id: i64,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE content_sync_entities SET local_id = ?1, updated_local_at = datetime('now')
         WHERE entity_type = ?2 AND remote_id = ?3",
        rusqlite::params![local_id, entity_type, remote_id],
    )?;
    Ok(())
}
```

- [ ] Verify compilation: `cargo build --manifest-path src-tauri/Cargo.toml`

- [ ] Run all tests: `cargo test --manifest-path src-tauri/Cargo.toml`

- [ ] Commit: `git add src-tauri/src/db/queries/content_sync.rs && git commit -m "feat(sync): add set_content_sync_entity_local_id DB query helper"`

---

## Known Compile-Time Considerations

1. **`ApiLanguage` is `Copy`** — it derives `Debug, Clone, Copy` (confirmed in `legacy_fetch/mod.rs` line 126). No `.clone()` needed when passing to closures.

2. **`PaginatedResponse<T>` fields** — `data: Vec<T>` and `last_page: Option<i64>` (confirmed lines 158–162). The `is_empty()` check on `resp.data` correctly detects end-of-pagination.

3. **`ApiAlbum` struct fields** — must be constructed with all fields: `id_album`, `name`, `color`, `id_file_image`, `url_image`, `subtitle`, `order`, `image_version`, `musics` (all confirmed in models, lines 239–261).

4. **`ContentSyncRemoteEntityInput` fields** — `local_id` is present and `Option<i64>` (confirmed line 647). Does not include `last_seen_at`, `created_at`, `updated_local_at` — those are on `ContentSyncEntity` (the local row), not on the input struct.

5. **`fetch_all_hymnal_pages` / `fetch_all_album_pages` are `async fn`** — when called from `start_content_sync` (sync Tauri command), wrap with `tauri::async_runtime::block_on(...)`. When called from `plan_content_sync` (async Tauri command), use `.await` directly.

6. **`ensure_ftp_ready` consolidates the lazy-init pattern** — the existing `RepairMedia` arm in `run_content_sync_background` already inlines the lazy init. After adding `ensure_ftp_ready`, optionally refactor `RepairMedia` to call `ensure_ftp_ready` instead of its inline block (not required for correctness, but reduces duplication).

7. **DB connection inside the execute loop** — each `CreateHymn`/`CreateAlbum` block calls `app.try_state::<AppState>()...db.get()` to get a new pooled connection. This is correct and mirrors the existing `RepairMedia` pattern. Do not hold a single connection across iterations (the r2d2 pool handles this).

8. **`ApiMusic` does not have a top-level `subtitle` or `url_image` at the album level** — when building `ApiAlbum` for `upsert_api_album_collection` in Task 3, `url_image` is the album's own cover URL (fetched from `fetch_albums_page`), not the song cover. These must not be conflated.

---

## Testing Strategy

Manual integration test after all tasks are complete:

1. Run the app in dev mode: `pnpm tauri dev`
2. Open Settings → Content Sync
3. Click "Plan Sync" — observe that the plan now shows `CreateHymn` items (not just `RepairMedia`)
4. Click "Start Sync" — observe progress events and that hymns are being created/updated
5. After completion, open the Hymnal page — verify new hymns appear
6. Run sync a second time — verify the plan is now empty (or only has `RepairMedia` items for missing files), confirming idempotency

Unit test coverage already exists for:
- `build_manifest_plan` (planner classifies new/updated/deleted entities correctly)
- `import_music_to_db` (upserts media paths correctly)
- `build_degraded_plan` (fallback still emits RepairMedia items alongside FullSyncFallback)

No new unit tests are required for the execute loop (it's integration-tested by running the app), but the compile-time test (`cargo test`) must remain green after every task.
