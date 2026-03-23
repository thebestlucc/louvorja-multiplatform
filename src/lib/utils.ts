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
