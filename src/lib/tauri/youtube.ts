import { invoke } from "@tauri-apps/api/core";
import type { AddPlaylistInput, OnlinePlaylistSearchResult, OnlineVideoPlaylist, OnlineVideo } from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// YouTube / Online Videos
export async function validateYoutubeApiKey(key: string): Promise<void> {
  return tauriInvoke<void>("validate_youtube_api_key", { key });
}

export async function fetchYoutubeChannel(url: string, apiKey: string): Promise<void> {
  return tauriInvoke<void>("fetch_youtube_channel", { url, apiKey });
}

export async function addYoutubePlaylist(input: AddPlaylistInput, apiKey: string): Promise<void> {
  return tauriInvoke<void>("add_youtube_playlist", { input, apiKey });
}

export async function getYoutubePlaylists(): Promise<OnlineVideoPlaylist[]> {
  return tauriInvoke<OnlineVideoPlaylist[]>("get_youtube_playlists");
}

export async function getYoutubePlaylistVideos(playlistId: string): Promise<OnlineVideo[]> {
  return tauriInvoke<OnlineVideo[]>("get_youtube_playlist_videos", { playlistId });
}

export async function refreshYoutubePlaylist(playlistId: string, apiKey: string): Promise<void> {
  return tauriInvoke<void>("refresh_youtube_playlist", { playlistId, apiKey });
}

export async function deleteYoutubePlaylist(playlistId: string): Promise<void> {
  return tauriInvoke<void>("delete_youtube_playlist", { playlistId });
}

// yt-dlp
export async function ensureYtdlp(): Promise<void> {
  return tauriInvoke<void>("ensure_ytdlp");
}

export async function updateYtdlp(): Promise<void> {
  return tauriInvoke<void>("update_ytdlp");
}

export async function downloadOnlineVideo(videoId: string, playlistId: string, quality: string): Promise<string> {
  return tauriInvoke<string>("download_online_video", { videoId, playlistId, quality });
}

export async function cancelDownload(runId: string): Promise<void> {
  return tauriInvoke<void>("cancel_download", { runId });
}

export async function deleteVideoLocalFile(videoId: string): Promise<void> {
  return tauriInvoke<void>("delete_video_local_file", { videoId });
}

export async function searchOnlinePlaylists(query: string): Promise<OnlinePlaylistSearchResult[]> {
  return tauriInvoke<OnlinePlaylistSearchResult[]>("search_online_playlists", { query });
}
