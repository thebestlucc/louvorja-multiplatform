import { invoke } from "@tauri-apps/api/core";
import type { StreamingInfo } from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Streaming
export async function startStreamingServer(port?: number): Promise<StreamingInfo> {
  return tauriInvoke<StreamingInfo>("start_streaming_server", { port: port ?? null });
}

export async function stopStreamingServer(): Promise<void> {
  return tauriInvoke<void>("stop_streaming_server");
}

export async function getStreamingStatus(): Promise<StreamingInfo> {
  return tauriInvoke<StreamingInfo>("get_streaming_status");
}

export async function setStreamingBroadcast(enabled: boolean): Promise<void> {
  return tauriInvoke<void>("set_streaming_broadcast", { enabled });
}
