/**
 * Builds an absolute path for use with `convertFileSrc()` by joining the
 * app data directory with a relative media path.
 *
 * On Windows, `appDataDir()` returns backslash-separated paths
 * (e.g. `C:\Users\...\AppData\Roaming\com.louvorja\`). Tauri's asset
 * protocol and `convertFileSrc` require forward slashes, so we normalize
 * both the base and the relative segment here.
 */
export function buildAssetPath(basePath: string, relativePath: string): string {
  const base = basePath.replace(/\\/g, "/");
  const rel = relativePath.replace(/\\/g, "/");
  const sep = base.endsWith("/") ? "" : "/";
  return `${base}${sep}${rel}`;
}
