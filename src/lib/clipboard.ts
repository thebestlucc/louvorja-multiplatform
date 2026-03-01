import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/**
 * Copy text to the system clipboard using the native Tauri plugin.
 * Falls back to navigator.clipboard for non-Tauri environments (dev/test).
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await writeText(text);
  } catch {
    // Fallback for web dev mode
    await navigator.clipboard.writeText(text);
  }
}
