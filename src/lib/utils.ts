import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SUPPORTED_VIDEO_FORMATS = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "ogv",
  "3gp",
]);

export function isVideoFormatSupported(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_VIDEO_FORMATS.has(ext);
}

export function getConversionRecommendation(_format: string): string {
  return "MP4";
}

export function getFileExt(filePath: string): string {
  return filePath.replace(/\\/g, "/").split(".").pop()?.toLowerCase() ?? "";
}

export function parseOnlineVideoNotes(notes: string | null): { videoId?: string; videoSource?: string } | null {
  try { return JSON.parse(notes ?? "") as { videoId?: string; videoSource?: string }; }
  catch { return null; }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(1)} KB`;
  if (bytes < 1000 * 1000 * 1000) return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
  return `${(bytes / (1000 * 1000 * 1000)).toFixed(2)} GB`;
}

/** Converts a hex color (#rgb or #rrggbb) + alpha to an `rgba(...)` string. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const LANG_DISPLAY: Record<string, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
  es: "Español",
};
