export const queryKeys = {
  hymns: {
    all: ["hymns"] as const,
    search: (query: string) => ["hymns", "search", query] as const,
    detail: (id: number) => ["hymns", id] as const,
    byAlbum: (album: string) => ["hymns", "album", album] as const,
    audioPath: (id: number) => ["hymns", id, "audioPath"] as const,
  },
  albums: {
    all: ["albums"] as const,
  },
  collections: {
    all: (query?: string) => ["collections", query || ""] as const,
    detail: (id: number) => ["collections", id] as const,
    songs: (id: number) => ["collections", id, "songs"] as const,
    hymns: (id: number) => ["collections", id, "hymns"] as const,
    songSync: (songId: number) => ["collections", "songSync", songId] as const,
  },
  bible: {
    versions: ["bible", "versions"] as const,
    books: (versionId: number) => ["bible", "books", versionId] as const,
    verses: (versionId: number, book: string, chapter: number) =>
      ["bible", "verses", versionId, book, chapter] as const,
    search: (query: string, versionId: number | null) => ["bible", "search", query, versionId] as const,
    globalSearch: (query: string) => ["bible", "global-search", query] as const,
  },
  favorites: {
    all: (itemType: string, query?: string) => ["favorites", itemType, query || ""] as const,
    isFavorite: (itemType: string, itemId: number) => ["favorites", itemType, itemId, "check"] as const,
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
    items: (serviceId: number) => ["services", serviceId, "items"] as const,
  },
  mediaLibrary: {
    categories: (language: string) => ["mediaLibrary", "categories", language] as const,
    items: (categoryId: number) => ["mediaLibrary", "items", categoryId] as const,
    itemsByDate: (categoryId: number, date: string | null) => ["mediaLibrary", "items", categoryId, date] as const,
    itemDates: (categoryId: number) => ["mediaLibrary", "itemDates", categoryId] as const,
    search: (query: string) => ["mediaLibrary", "search", query] as const,
  },
  schedule: {
    all: ["schedule"] as const,
    departments: ["schedule", "departments"] as const,
    month: (year: number, month: number) => ["schedule", "month", year, month] as const,
  },
  settings: {
    all: ["settings"] as const,
    detail: (key: string) => ["settings", key] as const,
  },
  overlay: ["overlay"] as const,
  packSyncPlan: ["packSync", "plan"] as const,
  updater: {
    info: ["updater", "info"] as const,
  },
  monitors: {
    all: ["monitors"] as const,
    configs: ["monitorConfigs"] as const,
  },
  syncPoints: {
    byHymn: (hymnId: number) => ["syncPoints", hymnId] as const,
  },
  utilities: {
    timerState: ["utilities", "timerState"] as const,
  },
  streaming: {
    status: ["streaming", "status"] as const,
  },
  video: {
    metadata: (path: string) => ["video", "metadata", path] as const,
    resolvedPath: (path: string) => ["video", "resolvedPath", path] as const,
  },
  youtubeVideos: {
    playlists: ["youtube", "playlists"] as const,
    videos: (playlistId: string) => ["youtube", "videos", playlistId] as const,
  },
} as const;
