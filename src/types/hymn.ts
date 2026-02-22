export interface Hymn {
  id: number;
  number: number | null;
  title: string;
  author: string | null;
  album: string | null;
  lyrics: string | null;
  chords: string | null;
  audio_path: string | null;
  playback_path: string | null;
  category: string | null;
  notes: string | null;
  cover_path: string | null;
  lyrics_sync: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLyric {
  lyric: string;
  order: number;
  time?: string;
  instrumentalTime?: string;
}

export interface HymnWriteInput {
  number: number | null;
  title: string;
  author: string | null;
  album: string | null;
  lyrics: string | null;
  chords: string | null;
  audio_path: string | null;
  playback_path: string | null;
  category: string | null;
  notes: string | null;
  cover_path: string | null;
  lyrics_sync: string | null;
}

export interface Album {
  name: string;
  hymn_count: number;
}

export interface HymnSearchResult {
  hymn: Hymn;
  highlight: string;
}
