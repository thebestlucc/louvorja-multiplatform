import { invoke } from "@tauri-apps/api/core";

export interface VideoServerInfo {
  isRunning: boolean;
  port: number;
  accessToken: string;
}

export async function startVideoServer(): Promise<VideoServerInfo> {
  return invoke<VideoServerInfo>("start_video_server");
}

export async function getVideoServerStatus(): Promise<VideoServerInfo> {
  return invoke<VideoServerInfo>("get_video_server_status");
}
