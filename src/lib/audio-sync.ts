import type { SyncPoint } from "./bindings";
import type { PlaybackMode } from "../types/audio";

export type PlaybackSeekLock = {
  targetMs: number;
  expiresAtMs: number;
};

export type PlaybackVariantPaths = {
  sungPath: string;
  karaokePath: string;
};

function normalizePlaybackPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  return trimmed ? trimmed : null;
}

export function resolvePlaybackTargetFile(
  mode: PlaybackMode,
  sungPath: string | null | undefined,
  karaokePath: string | null | undefined,
): string | null {
  const normalizedSungPath = normalizePlaybackPath(sungPath);
  const normalizedKaraokePath = normalizePlaybackPath(karaokePath);

  if (mode === "karaoke") {
    return normalizedKaraokePath ?? normalizedSungPath;
  }
  if (mode === "sung") {
    return normalizedSungPath;
  }

  return null;
}

export function resolvePlaybackVariantPaths(
  sungPath: string | null | undefined,
  karaokePath: string | null | undefined,
): PlaybackVariantPaths | null {
  const normalizedSungPath = normalizePlaybackPath(sungPath);
  const normalizedKaraokePath = normalizePlaybackPath(karaokePath);

  if (
    normalizedSungPath == null ||
    normalizedKaraokePath == null ||
    normalizedSungPath === normalizedKaraokePath
  ) {
    return null;
  }

  return {
    sungPath: normalizedSungPath,
    karaokePath: normalizedKaraokePath,
  };
}

/**
 * Parse a lyricsSync JSON string (from content DB) into SyncPoint[].
 * Format: [{ lyric, order, time, instrumentalTime }, ...]
 * Time format: "HH:MM:SS" (e.g. "00:00:03" = 3000 ms)
 *
 * Returns [] when lyricsSync is null/empty/invalid.
 * Used as a fallback when getSyncPoints() finds no data in the app DB
 * (i.e., for content-DB / CDN hymns not stored in the local hymns table).
 */
export function parseLyricsSyncToPoints(lyricsSync: string | null | undefined): SyncPoint[] {
  if (!lyricsSync) return [];

  let entries: Array<{ order: number; time?: string; instrumentalTime?: string }>;
  try {
    entries = JSON.parse(lyricsSync);
  } catch {
    return [];
  }

  if (!Array.isArray(entries) || entries.length === 0) return [];

  const parseTimeToMs = (time: string | undefined): number | null => {
    if (!time) return null;
    const parts = time.split(":");
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s = parseInt(parts[2], 10);
      if ([h, m, s].some(isNaN)) return null;
      return (h * 3600 + m * 60 + s) * 1000;
    }
    return null;
  };

  const sorted = [...entries].sort((a, b) => a.order - b.order);

  // Always start with the cover slide at t=0
  const points: SyncPoint[] = [{ slideIndex: 0, timestampMs: 0, instrumentalTimestampMs: 0 }];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const ms = parseTimeToMs(entry.time);
    const instMs = parseTimeToMs(entry.instrumentalTime);
    // Skip entries with no timing at all (gap/instrumental markers with time="00:00:00")
    if (ms === null && instMs === null) continue;
    if (ms === 0 && instMs === 0) continue;
    points.push({
      slideIndex: i + 1,
      timestampMs: ms ?? instMs ?? 0,
      instrumentalTimestampMs: instMs ?? null,
    });
  }

  return points;
}

export function getActiveTimestamp(point: SyncPoint, mode: PlaybackMode): number {
  if (mode === "karaoke" && point.instrumentalTimestampMs != null) {
    return point.instrumentalTimestampMs;
  }

  return point.timestampMs;
}

export function sortSyncPointsForMode(points: SyncPoint[], mode: PlaybackMode): SyncPoint[] {
  return [...points].sort((left, right) => {
    const timestampDelta = getActiveTimestamp(left, mode) - getActiveTimestamp(right, mode);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.slideIndex - right.slideIndex;
  });
}

export function findSlideAtPosition(
  points: SyncPoint[],
  positionMs: number,
  mode: PlaybackMode,
): number {
  let slide = -1;

  for (const point of sortSyncPointsForMode(points, mode)) {
    if (positionMs >= getActiveTimestamp(point, mode)) {
      slide = point.slideIndex;
    } else {
      break;
    }
  }

  return slide >= 0 ? slide : 0;
}

export function resolveSlideSeekTimestamp(
  points: SyncPoint[],
  slideIndex: number,
  mode: PlaybackMode,
): number | null {
  let bestMatch: SyncPoint | null = null;
  let nearestFuture: SyncPoint | null = null;

  for (const point of points) {
    if (point.slideIndex === slideIndex) {
      return getActiveTimestamp(point, mode);
    }
    if (point.slideIndex < slideIndex) {
      if (bestMatch == null || point.slideIndex > bestMatch.slideIndex) {
        bestMatch = point;
      }
      continue;
    }
    if (point.slideIndex > slideIndex && nearestFuture == null) {
      nearestFuture = point;
    }
  }

  if (bestMatch) {
    return getActiveTimestamp(bestMatch, mode);
  }
  if (nearestFuture) {
    return getActiveTimestamp(nearestFuture, mode);
  }

  return null;
}

export function findExactSlideTimestamp(
  points: SyncPoint[],
  slideIndex: number,
  mode: PlaybackMode,
): number | null {
  for (const point of points) {
    if (point.slideIndex === slideIndex) {
      return getActiveTimestamp(point, mode);
    }
  }

  return null;
}

export type SlideTimingWindow = {
  startMs: number | null;
  endMs: number | null;
};

export function resolveSlideTimingWindow(
  points: SyncPoint[],
  slideIndex: number,
  mode: PlaybackMode,
): SlideTimingWindow {
  const startMs = resolveSlideSeekTimestamp(points, slideIndex, mode);
  let endMs: number | null = null;

  for (let nextIndex = slideIndex + 1; nextIndex < slideIndex + points.length + 2; nextIndex += 1) {
    const exactNextStart = findExactSlideTimestamp(points, nextIndex, mode);
    if (exactNextStart != null) {
      endMs = exactNextStart;
      break;
    }
  }

  return { startMs, endMs };
}

export function resolveProgressRatio(
  startMs: number | null,
  endMs: number | null,
  positionMs: number,
): number | null {
  if (
    startMs == null ||
    endMs == null ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return null;
  }

  const clampedPosition = Math.min(Math.max(positionMs, startMs), endMs);
  return (clampedPosition - startMs) / (endMs - startMs);
}

export function resolvePlaybackModeSwitchPosition(positionMs: number): number {
  if (!Number.isFinite(positionMs) || positionMs <= 0) {
    return 0;
  }

  return Math.floor(positionMs);
}

export function resolveReplayStartPosition(positionMs: number, durationMs: number): number {
  if (!Number.isFinite(positionMs) || positionMs <= 0) {
    return 0;
  }

  if (Number.isFinite(durationMs) && durationMs > 0 && positionMs >= Math.max(0, durationMs - 500)) {
    return 0;
  }

  return Math.floor(positionMs);
}

export function resolvePlaybackSeekLockAction(
  payloadPositionMs: number,
  seekLock: PlaybackSeekLock | null,
  nowMs: number = Date.now(),
): "none" | "ignore" | "release" | "expired" {
  if (seekLock == null) {
    return "none";
  }

  if (nowMs >= seekLock.expiresAtMs) {
    return "expired";
  }

  if (Math.abs(payloadPositionMs - seekLock.targetMs) > 400) {
    return "ignore";
  }

  return "release";
}
