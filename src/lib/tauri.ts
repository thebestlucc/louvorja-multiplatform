import { invoke } from "@tauri-apps/api/core";

export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

export async function greet(name: string): Promise<string> {
  return tauriInvoke<string>("greet", { name });
}
