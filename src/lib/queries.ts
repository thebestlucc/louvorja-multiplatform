import { useQuery, useMutation } from "@tanstack/react-query";
import { searchHymns, getHymn, getAlbums, getHymnsByAlbum, getAvailableMonitors, setCurrentSlide } from "./tauri";
import type { SlideContentFlat } from "../types/presentation";

export const queryKeys = {
  hymns: {
    all: ["hymns"] as const,
    search: (query: string) => ["hymns", "search", query] as const,
    detail: (id: number) => ["hymns", id] as const,
    byAlbum: (album: string) => ["hymns", "album", album] as const,
  },
  albums: {
    all: ["albums"] as const,
  },
  bible: {
    versions: ["bible", "versions"] as const,
    books: (versionId: number) => ["bible", "books", versionId] as const,
    verses: (versionId: number, book: string, chapter: number) =>
      ["bible", "verses", versionId, book, chapter] as const,
    search: (query: string) => ["bible", "search", query] as const,
  },
  presentations: {
    all: ["presentations"] as const,
    detail: (id: number) => ["presentations", id] as const,
    slides: (presentationId: number) =>
      ["presentations", presentationId, "slides"] as const,
  },
  services: {
    all: ["services"] as const,
    detail: (id: number) => ["services", id] as const,
  },
  settings: {
    all: ["settings"] as const,
    detail: (key: string) => ["settings", key] as const,
  },
  monitors: {
    all: ["monitors"] as const,
  },
} as const;

export function useHymns(query: string) {
  return useQuery({
    queryKey: queryKeys.hymns.search(query),
    queryFn: () => searchHymns(query),
  });
}

export function useHymn(id: number) {
  return useQuery({
    queryKey: queryKeys.hymns.detail(id),
    queryFn: () => getHymn(id),
    enabled: id > 0,
  });
}

export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(),
  });
}

export function useHymnsByAlbum(album: string) {
  return useQuery({
    queryKey: queryKeys.hymns.byAlbum(album),
    queryFn: () => getHymnsByAlbum(album),
    enabled: album.length > 0,
  });
}

export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors.all,
    queryFn: () => getAvailableMonitors(),
  });
}

export function useProjectSlide() {
  return useMutation({
    mutationFn: (slideData: SlideContentFlat) => setCurrentSlide(slideData),
  });
}
