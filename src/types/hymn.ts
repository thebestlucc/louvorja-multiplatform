export interface Hymn {
  id: number;
  number: number | null;
  title: string;
  author: string | null;
  album: string | null;
  lyrics: string | null;
  chords: string | null;
  audio_path: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Album {
  name: string;
  hymn_count: number;
}

export interface HymnSearchResult {
  hymn: Hymn;
  highlight: string;
}
