export function normalizeMediaPath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized) {
    return null;
  }

  const isAbsolutePosix = normalized.startsWith("/");
  const isAbsoluteWindows = /^[a-zA-Z]:\//.test(normalized);
  const isExternal = /^(https?:|data:|blob:)/i.test(normalized);
  if (isAbsolutePosix || isAbsoluteWindows || isExternal) {
    return normalized;
  }

  return normalized.startsWith("media/") ? normalized : `media/${normalized}`;
}
