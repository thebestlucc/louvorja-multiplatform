export interface BibleVersion {
  id: number;
  name: string;
  abbreviation: string;
  language: string;
  file_path: string | null;
}

export interface Book {
  name: string;
  chapter_count: number;
}

export interface Chapter {
  book: string;
  chapter: number;
  verse_count: number;
}

export interface Verse {
  id: number;
  version_id: number;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleSearchResult {
  verse: Verse;
  highlight: string;
}
