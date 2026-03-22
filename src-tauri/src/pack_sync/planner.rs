use crate::content_sync::manifest::ContentManifest;
use crate::error::AppError;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncFileItem {
    pub path: String,
    pub hymn_api_id: Option<i64>,
    pub album_api_id: Option<i64>,
    pub file_type: String,
    pub size: u64,
    pub album_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncPlanItem {
    pub pack_id: String,
    pub pack_url: String,
    pub pack_version: u32,
    pub pack_size: u64,
    pub pack_sha256: String,
    pub local_extracted_version: u32,
    pub local_db_version: u32,
    pub needs_download: bool,
    pub needs_db_update: bool,
    pub file_count: usize,
    pub files: Vec<PackSyncFileItem>,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncPlan {
    pub manifest_version: i64,
    pub items: Vec<PackSyncPlanItem>,
    pub total_download_size: u64,
    pub total_download_count: usize,
    pub available_languages: Vec<String>,
    pub selected_languages: Vec<String>,
}

/// Build a plan by comparing the remote manifest against local pack state.
///
/// `preview_languages` — if `Some`, use those languages instead of reading from DB.
/// This lets the dialog show the pack list for a language the user has checked
/// without committing the selection to DB yet.
pub fn build_plan(
    conn: &Connection,
    manifest: &ContentManifest,
    stored_manifest_version: i64,
    preview_languages: Option<&[String]>,
) -> Result<PackSyncPlan, AppError> {
    use crate::db::queries::content_sync::get_selected_languages;

    let selected_languages = preview_languages
        .map(|l| l.to_vec())
        .unwrap_or_else(|| get_selected_languages(conn));
    let available_languages: Vec<String> = {
        let mut langs: Vec<String> = manifest
            .packs
            .iter()
            .map(|p| p.language.clone())
            .chain(manifest.databases.keys().cloned())
            .collect();
        langs.sort();
        langs.dedup();
        langs
    };

    // If nothing selected, return empty plan (dialog prompts user to pick a language).
    if selected_languages.is_empty() {
        return Ok(PackSyncPlan {
            manifest_version: manifest.manifest_version,
            items: vec![],
            total_download_size: 0,
            total_download_count: 0,
            available_languages,
            selected_languages,
        });
    }

    let effective_languages = selected_languages.clone();

    // Early return if manifest version hasn't changed AND no content DB needs updating
    if manifest.manifest_version == stored_manifest_version && stored_manifest_version > 0 {
        let db_items = build_db_items(conn, manifest, &effective_languages)?;
        if db_items.is_empty() {
            return Ok(PackSyncPlan {
                manifest_version: manifest.manifest_version,
                items: vec![],
                total_download_size: 0,
                total_download_count: 0,
                available_languages,
                selected_languages,
            });
        }
    }

    let mut items = Vec::new();
    let mut total_download_size = 0u64;
    let mut total_download_count = 0usize;

    for pack in &manifest.packs {
        // Filter by selected languages
        if !effective_languages.contains(&pack.language) {
            continue;
        }

        let extracted_version =
            crate::db::queries::content_sync::get_pack_extracted_version(conn, &pack.id)?;

        if pack.version <= extracted_version {
            continue;
        }

        total_download_size += pack.size;
        total_download_count += 1;

        let files: Vec<PackSyncFileItem> = pack
            .files
            .iter()
            .map(|f| PackSyncFileItem {
                path: f.path.clone(),
                hymn_api_id: f.hymn_api_id,
                album_api_id: f.album_api_id,
                file_type: f.file_type.clone(),
                size: f.size,
                album_name: f.album_name.clone(),
            })
            .collect();

        items.push(PackSyncPlanItem {
            pack_id: pack.id.clone(),
            pack_url: pack.url.clone(),
            pack_version: pack.version,
            pack_size: pack.size,
            pack_sha256: pack.sha256.clone(),
            local_extracted_version: extracted_version,
            local_db_version: 0,
            needs_download: true,
            needs_db_update: false,
            file_count: files.len(),
            files,
            language: pack.language.clone(),
        });
    }

    // Add content DB download items as pseudo-packs with empty files
    let db_items = build_db_items(conn, manifest, &effective_languages)?;
    items.extend(db_items);

    Ok(PackSyncPlan {
        manifest_version: manifest.manifest_version,
        items,
        total_download_size,
        total_download_count,
        available_languages,
        selected_languages,
    })
}

/// Build plan items for content DB downloads, one per selected language.
fn build_db_items(
    conn: &Connection,
    manifest: &ContentManifest,
    selected_languages: &[String],
) -> Result<Vec<PackSyncPlanItem>, AppError> {
    let mut items = Vec::new();
    for lang in selected_languages {
        if let Some(db_entry) = manifest.databases.get(lang) {
            let stored_version = crate::db::queries::settings::get_setting(
                conn,
                &format!("pack_sync.db_version.{}", lang),
            )
            .ok()
            .and_then(|s| s.value.parse::<i64>().ok())
            .unwrap_or(0);
            if db_entry.version > stored_version {
                items.push(PackSyncPlanItem {
                    pack_id: format!("content-db-{}", lang),
                    pack_url: db_entry.url.clone(),
                    pack_version: db_entry.version as u32,
                    pack_size: 0,
                    pack_sha256: String::new(),
                    local_extracted_version: stored_version as u32,
                    local_db_version: 0,
                    needs_download: true,
                    needs_db_update: false,
                    file_count: 0,
                    files: vec![],
                    language: lang.clone(),
                });
            }
        }
    }
    Ok(items)
}
