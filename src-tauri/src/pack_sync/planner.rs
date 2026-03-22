use crate::content_sync::manifest::ContentManifest;
use crate::db::queries::content_sync;
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
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LegacyDbSyncItem {
    pub url: String,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncPlan {
    pub manifest_version: i64,
    pub items: Vec<PackSyncPlanItem>,
    pub total_download_size: u64,
    pub total_download_count: usize,
    /// Present when the manifest advertises a legacy DB that is newer than the
    /// locally stored `pack_sync.legacy_db_version`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legacy_db: Option<LegacyDbSyncItem>,
}

/// Build a plan by comparing the remote manifest against local pack state.
pub fn build_plan(
    conn: &Connection,
    manifest: &ContentManifest,
    stored_manifest_version: i64,
) -> Result<PackSyncPlan, AppError> {
    if manifest.manifest_version == stored_manifest_version && stored_manifest_version > 0 {
        // Even if the manifest version hasn't changed, we still need to check
        // whether a legacy DB is pending (e.g. the user dismissed the dialog before
        // importing, or the app was updated and dbVersion needs re-checking).
        let legacy_db = match (&manifest.db_url, manifest.db_version) {
            (Some(url), Some(remote_version)) => {
                let local_version = content_sync::get_legacy_db_version(conn)?.unwrap_or(0);
                if remote_version > local_version {
                    Some(LegacyDbSyncItem {
                        url: url.clone(),
                        version: remote_version,
                    })
                } else {
                    None
                }
            }
            _ => None,
        };
        return Ok(PackSyncPlan {
            manifest_version: manifest.manifest_version,
            items: vec![],
            total_download_size: 0,
            total_download_count: 0,
            legacy_db,
        });
    }

    let mut items = Vec::new();
    let mut total_download_size = 0u64;
    let mut total_download_count = 0usize;

    for pack in &manifest.packs {
        let extracted_version = content_sync::get_pack_extracted_version(conn, &pack.id)?;
        let db_version = content_sync::get_pack_db_version(conn, &pack.id)?;

        let needs_download = pack.version > extracted_version;
        let needs_db_update = pack.version > db_version;

        if !needs_download && !needs_db_update {
            continue;
        }

        if needs_download {
            total_download_size += pack.size;
            total_download_count += 1;
        }

        let files: Vec<PackSyncFileItem> = pack.files.iter().map(|f| PackSyncFileItem {
            path: f.path.clone(),
            hymn_api_id: f.hymn_api_id,
            album_api_id: f.album_api_id,
            file_type: f.file_type.clone(),
            size: f.size,
            album_name: f.album_name.clone(),
        }).collect();

        items.push(PackSyncPlanItem {
            pack_id: pack.id.clone(),
            pack_url: pack.url.clone(),
            pack_version: pack.version,
            pack_size: pack.size,
            pack_sha256: pack.sha256.clone(),
            local_extracted_version: extracted_version,
            local_db_version: db_version,
            needs_download,
            needs_db_update,
            file_count: files.len(),
            files,
        });
    }

    // Check if the manifest advertises a legacy DB that we haven't imported yet.
    let legacy_db = match (&manifest.db_url, manifest.db_version) {
        (Some(url), Some(remote_version)) => {
            let local_version = content_sync::get_legacy_db_version(conn)?.unwrap_or(0);
            if remote_version > local_version {
                Some(LegacyDbSyncItem {
                    url: url.clone(),
                    version: remote_version,
                })
            } else {
                None
            }
        }
        _ => None,
    };

    Ok(PackSyncPlan {
        manifest_version: manifest.manifest_version,
        items,
        total_download_size,
        total_download_count,
        legacy_db,
    })
}
