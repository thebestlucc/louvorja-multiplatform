import type { ContentSyncPlanItem } from "../types/content-sync";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const ENTITY_TYPE_KEYS: Record<string, string> = {
  album: "settings.contentSync.entityTypes.album",
  hymn: "settings.contentSync.entityTypes.hymn",
  system: "settings.contentSync.entityTypes.system",
};

const REASON_KEYS: Record<string, string> = {
  "Managed album cover is missing locally.": "settings.contentSync.reasons.managedAlbumCoverMissingLocally",
  "Managed album cover version changed remotely.": "settings.contentSync.reasons.managedAlbumCoverVersionChanged",
  "Managed hymn media is missing locally.": "settings.contentSync.reasons.managedHymnMediaMissingLocally",
  "Managed hymn media version changed remotely.": "settings.contentSync.reasons.managedHymnMediaVersionChanged",
  "Remote album is missing locally.": "settings.contentSync.reasons.remoteAlbumMissingLocally",
  "Remote album metadata changed.": "settings.contentSync.reasons.remoteAlbumMetadataChanged",
  "Remote album no longer exists in the manifest.": "settings.contentSync.reasons.remoteAlbumRemoved",
  "Remote hymn is missing locally.": "settings.contentSync.reasons.remoteHymnMissingLocally",
  "Remote hymn metadata changed.": "settings.contentSync.reasons.remoteHymnMetadataChanged",
  "Remote hymn no longer exists in the manifest.": "settings.contentSync.reasons.remoteHymnRemoved",
  "Remote version is newer — a full API sync is also needed to get new content.": "settings.contentSync.reasons.fullSyncFallback",
};

const MISSING_PREFIX = "Missing: ";
const NOT_DOWNLOADED = "not downloaded";

export function formatContentSyncPlanItemLabel(
  item: Pick<ContentSyncPlanItem, "action" | "label">,
  t: Translate,
): string {
  if (item.action === "full_sync_fallback") {
    return t("settings.contentSync.fullSyncFallbackLabel");
  }

  return item.label ?? "";
}

export function formatContentSyncEntityType(entityType: string, t: Translate): string {
  const key = ENTITY_TYPE_KEYS[entityType];
  return key ? t(key) : entityType;
}

export function formatContentSyncReason(reason: string | null | undefined, t: Translate): string {
  if (!reason) {
    return "";
  }

  const key = REASON_KEYS[reason];
  if (key) {
    return t(key);
  }

  if (reason.startsWith(MISSING_PREFIX)) {
    const details = reason
      .slice(MISSING_PREFIX.length)
      .split(", ")
      .map((detail) => formatMissingDetail(detail, t))
      .join(", ");

    return t("settings.contentSync.reasons.missingWithDetails", { details });
  }

  return reason;
}

function formatMissingDetail(detail: string, t: Translate): string {
  if (detail === "cover image") {
    return t("settings.contentSync.mediaTypes.coverImage");
  }

  const match = detail.match(/^(audio|playback|cover) \((.+)\)$/);
  if (!match) {
    return detail;
  }

  const [, type, rawValue] = match;
  const typeLabel = t(`settings.contentSync.mediaTypes.${type}`);
  const value = rawValue === NOT_DOWNLOADED
    ? t("settings.contentSync.notDownloaded")
    : rawValue;

  return `${typeLabel} (${value})`;
}
