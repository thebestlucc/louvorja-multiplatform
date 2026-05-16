use serde::{Deserialize, Serialize};
use specta::Type;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentSyncSummaryMode {
    Smart,
    Degraded,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentSyncFallbackAction {
    StartFullSync,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentSyncMetadataSource {
    DbSnapshot,
    ApiFallback,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentSyncRunMode {
    Check,
    Selective,
    Full,
    Repair,
}

impl ContentSyncRunMode {
    #[allow(dead_code)]
    pub fn as_db_str(&self) -> &'static str {
        match self {
            Self::Check => "check",
            Self::Selective => "selective",
            Self::Full => "full",
            Self::Repair => "repair",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "check" => Self::Check,
            "selective" => Self::Selective,
            "repair" => Self::Repair,
            _ => Self::Full,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentSyncRunStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl ContentSyncRunStatus {
    #[allow(dead_code)]
    pub fn as_db_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "pending" => Self::Pending,
            "running" => Self::Running,
            "completed" => Self::Completed,
            "cancelled" => Self::Cancelled,
            _ => Self::Failed,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentSyncPlanItemAction {
    CreateHymn,
    UpdateHymn,
    CreateAlbum,
    UpdateAlbum,
    RelinkCollectionHymn,
    RepairMedia,
    DeleteRemoteManagedHymn,
    DeleteRemoteManagedAlbum,
    FullSyncFallback,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentSyncPlanItemStatus {
    Pending,
    Running,
    Completed,
    Skipped,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncState {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = Option<i32>)]
    pub content_version: Option<i64>,
    pub last_checked_at: Option<String>,
    pub last_synced_at: Option<String>,
    pub last_sync_status: Option<ContentSyncRunStatus>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ContentSyncEntity {
    #[specta(type = i32)]
    pub id: i64,
    pub entity_type: String,
    #[specta(type = i32)]
    pub remote_id: i64,
    #[specta(type = Option<i32>)]
    pub local_id: Option<i64>,
    #[specta(type = Option<i32>)]
    pub remote_version: Option<i64>,
    pub content_hash: Option<String>,
    pub lyrics_hash: Option<String>,
    pub image_version: Option<String>,
    pub audio_version: Option<String>,
    pub playback_version: Option<String>,
    pub updated_at: Option<String>,
    pub deleted: bool,
    pub last_seen_at: String,
    pub created_at: String,
    pub updated_local_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncRemoteEntityInput {
    pub entity_type: String,
    #[specta(type = i32)]
    pub remote_id: i64,
    #[specta(type = Option<i32>)]
    pub local_id: Option<i64>,
    #[specta(type = Option<i32>)]
    pub remote_version: Option<i64>,
    pub content_hash: Option<String>,
    pub lyrics_hash: Option<String>,
    pub image_version: Option<String>,
    pub audio_version: Option<String>,
    pub playback_version: Option<String>,
    pub updated_at: Option<String>,
    pub deleted: bool,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncLocalMediaPaths {
    pub entity_type: String,
    #[specta(type = i32)]
    pub local_id: i64,
    pub audio_path: Option<String>,
    pub playback_path: Option<String>,
    pub cover_path: Option<String>,
    pub album: Option<String>,
    pub language: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncSummary {
    pub mode: ContentSyncSummaryMode,
    #[specta(type = Option<i32>)]
    pub current_version: Option<i64>,
    #[specta(type = Option<i32>)]
    pub remote_version: Option<i64>,
    pub has_updates: bool,
    pub changed_hymn_count: i32,
    pub changed_album_count: i32,
    pub missing_asset_count: i32,
    pub fallback_action: Option<ContentSyncFallbackAction>,
    pub metadata_source: Option<ContentSyncMetadataSource>,
    pub last_checked_at: Option<String>,
    pub last_synced_at: Option<String>,
    pub last_sync_status: Option<ContentSyncRunStatus>,
    pub last_error: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncPlanItem {
    pub id: String,
    pub entity_type: String,
    #[specta(type = i32)]
    pub remote_id: Option<i64>,
    #[specta(type = i32)]
    pub local_id: Option<i64>,
    pub action: ContentSyncPlanItemAction,
    pub status: ContentSyncPlanItemStatus,
    pub reason: Option<String>,
    pub remote_path: Option<String>,
    pub label: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncPlan {
    pub mode: ContentSyncRunMode,
    pub summary: ContentSyncSummary,
    pub items: Vec<ContentSyncPlanItem>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncProgress {
    pub run_id: String,
    pub step: String,
    pub status: ContentSyncRunStatus,
    pub percent: f64,
    pub message: Option<String>,
    #[specta(type = f64)]
    pub items_total: u64,
    #[specta(type = f64)]
    pub items_processed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncRun {
    pub id: String,
    pub mode: ContentSyncRunMode,
    pub status: ContentSyncRunStatus,
    #[specta(type = Option<i32>)]
    pub requested_version: Option<i64>,
    #[specta(type = Option<i32>)]
    pub completed_version: Option<i64>,
    pub planned_changes_json: Option<String>,
    pub result_json: Option<String>,
    pub error_json: Option<String>,
    pub created_at: String,
    pub finished_at: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentSyncReport {
    pub run_id: String,
    pub mode: ContentSyncRunMode,
    pub status: ContentSyncRunStatus,
    #[specta(type = Option<i32>)]
    pub requested_version: Option<i64>,
    #[specta(type = Option<i32>)]
    pub completed_version: Option<i64>,
    pub applied_count: i32,
    pub skipped_count: i32,
    pub failed_count: i32,
    pub fallback_used: bool,
    pub metadata_source: Option<ContentSyncMetadataSource>,
    pub result_json: Option<String>,
    pub error_json: Option<String>,
    pub created_at: String,
    pub finished_at: Option<String>,
    pub message: Option<String>,
}

impl ContentSyncReport {
    #[allow(dead_code)]
    pub fn from_run(run: ContentSyncRun) -> Self {
        #[derive(Deserialize, Default)]
        #[serde(rename_all = "camelCase")]
        struct StoredResult {
            applied_count: i32,
            skipped_count: i32,
            failed_count: i32,
            fallback_used: bool,
            metadata_source: Option<ContentSyncMetadataSource>,
            message: Option<String>,
        }

        let fallback_from_plan = run
            .planned_changes_json
            .as_ref()
            .is_some_and(|json| json.contains("full_sync_fallback"));
        let stored_result = run
            .result_json
            .as_ref()
            .and_then(|json| serde_json::from_str::<StoredResult>(json).ok())
            .unwrap_or_default();
        let failed_count = if matches!(run.status, ContentSyncRunStatus::Failed) {
            1
        } else {
            stored_result.failed_count
        };

        Self {
            run_id: run.id,
            mode: run.mode,
            status: run.status,
            requested_version: run.requested_version,
            completed_version: run.completed_version,
            applied_count: stored_result.applied_count,
            skipped_count: stored_result.skipped_count,
            failed_count,
            fallback_used: stored_result.fallback_used || fallback_from_plan,
            metadata_source: stored_result.metadata_source,
            result_json: run.result_json,
            error_json: run.error_json.clone(),
            created_at: run.created_at,
            finished_at: run.finished_at,
            message: stored_result.message.or(run.error_json),
        }
    }
}

/// A single file entry returned by `list_ftp_files`.
/// Not persisted — used only as a Tauri command return type.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FtpFileEntry {
    /// Path on the FTP server (relative to FTP root), e.g. "config/musicas/pt/album/song.mp3"
    pub remote_path: String,
    /// Relative path under app_data_dir where the file would be stored locally, if derivable.
    pub local_path: Option<String>,
    /// Whether the local file currently exists on disk.
    pub exists_locally: bool,
    /// Remote file size in bytes (from FTP SIZE command), if available.
    pub file_size: Option<u64>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FtpDownloadProgress {
    pub remote_path: String,
    pub done: usize,
    pub total: usize,
    pub success: bool,
    pub error: Option<String>,
}
