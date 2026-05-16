import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/**
 * Copy text to the system clipboard using the native Tauri plugin.
 */
export async function copyToClipboard(text: string): Promise<void> {
  await writeText(text);
}
