import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getYoutubePlaylists,
  getYoutubePlaylistVideos,
  deleteYoutubePlaylist,
  addYoutubePlaylist,
  refreshYoutubePlaylist,
  deleteVideoLocalFile,
} from "../tauri";
import type { AddPlaylistInput } from "../bindings";
import { queryKeys } from "./keys";

export function useYoutubePlaylists() {
  return useQuery({
    queryKey: queryKeys.youtubeVideos.playlists,
    queryFn: () => getYoutubePlaylists(),
  });
}

export function useYoutubePlaylistVideos(playlistId: string) {
  return useQuery({
    queryKey: queryKeys.youtubeVideos.videos(playlistId),
    queryFn: () => getYoutubePlaylistVideos(playlistId),
    enabled: !!playlistId,
  });
}

export function useAddYoutubePlaylist() {
  return useMutation({
    mutationFn: (vars: { input: AddPlaylistInput; apiKey: string }) =>
      addYoutubePlaylist(vars.input, vars.apiKey),
    // No onSuccess invalidation — event-driven via useYoutubeEvents()
  });
}

export function useRefreshYoutubePlaylist() {
  return useMutation({
    mutationFn: (vars: { playlistId: string; apiKey: string }) =>
      refreshYoutubePlaylist(vars.playlistId, vars.apiKey),
    // No onSuccess invalidation — event-driven via useYoutubeEvents()
  });
}

export function useDeleteYoutubePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: string) => deleteYoutubePlaylist(playlistId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtubeVideos.playlists });
    },
  });
}

export function useDeleteVideoLocalFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { videoId: string; playlistId: string }) =>
      deleteVideoLocalFile(vars.videoId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.youtubeVideos.videos(vars.playlistId) });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    },
  });
}
