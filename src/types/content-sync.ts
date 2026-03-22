export type ContentSyncSummaryMode = "smart" | "degraded";
export type ContentSyncFallbackAction = "start_full_sync";
export type ContentSyncMetadataSource = "db_snapshot" | "api_fallback";
export type ContentSyncRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type ContentSyncRunMode = "check" | "selective" | "full" | "repair";
export type ContentSyncPlanItemStatus = "pending" | "running" | "completed" | "skipped" | "failed";
export type ContentSyncPlanItemAction =
  | "create_hymn"
  | "update_hymn"
  | "create_album"
  | "update_album"
  | "relink_collection_hymn"
  | "repair_media"
  | "delete_remote_managed_hymn"
  | "delete_remote_managed_album"
  | "full_sync_fallback";

export interface ContentSyncSummary {
  mode: ContentSyncSummaryMode;
  currentVersion: number | null;
  remoteVersion: number | null;
  hasUpdates: boolean;
  changedHymnCount: number;
  changedAlbumCount: number;
  missingAssetCount: number;
  fallbackAction: ContentSyncFallbackAction | null;
  metadataSource: ContentSyncMetadataSource | null;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: ContentSyncRunStatus | null;
  lastError: string | null;
}

export interface ContentSyncPlanItem {
  id: string;
  entityType: string;
  remoteId: number | null;
  localId: number | null;
  action: ContentSyncPlanItemAction;
  status: ContentSyncPlanItemStatus;
  reason: string | null;
  label: string | null;
  remotePath: string | null;
}

export interface ContentSyncPlan {
  mode: ContentSyncRunMode;
  summary: ContentSyncSummary;
  items: ContentSyncPlanItem[];
}

export interface ContentSyncProgress {
  runId: string;
  step: string;
  status: ContentSyncRunStatus;
  percent: number;
  message: string | null;
  itemsTotal: number;
  itemsProcessed: number;
}

export interface PackSyncFileItem {
  path: string;
  hymnApiId: number | null;
  albumApiId: number | null;
  fileType: string;
  size: number;
  albumName: string | null;
}

export interface PackSyncPlanItem {
  packId: string;
  packUrl: string;
  packVersion: number;
  packSize: number;
  packSha256: string;
  localExtractedVersion: number;
  localDbVersion: number;
  needsDownload: boolean;
  needsDbUpdate: boolean;
  fileCount: number;
  files: PackSyncFileItem[];
  language: string;
}

export interface PackSyncPlan {
  manifestVersion: number;
  items: PackSyncPlanItem[];
  totalDownloadSize: number;
  totalDownloadCount: number;
  availableLanguages: string[];
  selectedLanguages: string[];
}

export interface PackSyncProgress {
  runId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  percent: number;
  message: string | null;
  packsTotal: number;
  packsProcessed: number;
  /** Per-pack status keyed by packId. Values: pending | downloading | verifying | ready | extracting | db_update | done | failed | skipped */
  packStatuses: Record<string, string>;
}

export interface ContentSyncReport {
  runId: string;
  mode: ContentSyncRunMode;
  status: ContentSyncRunStatus;
  requestedVersion: number | null;
  completedVersion: number | null;
  appliedCount: number;
  skippedCount: number;
  failedCount: number;
  fallbackUsed: boolean;
  metadataSource: ContentSyncMetadataSource | null;
  resultJson: string | null;
  errorJson: string | null;
  createdAt: string;
  finishedAt: string | null;
  message: string | null;
}
