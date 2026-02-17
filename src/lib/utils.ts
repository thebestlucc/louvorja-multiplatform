import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SUPPORTED_VIDEO_FORMATS = new Set(["mp4", "webm"]);

export function isVideoFormatSupported(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_VIDEO_FORMATS.has(ext);
}

export function getConversionRecommendation(format: string): string {
  const normalized = format.toLowerCase();
  if (normalized === "mp4" || normalized === "webm") {
    return "MP4/WebM";
  }
  return "MP4/WebM";
}
