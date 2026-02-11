export interface BibleVersion {
  id: number;
  name: string;
  abbreviation: string;
  language: string;
  filePath: string | null;
}

export interface Book {
  name: string;
  chapterCount: number;
}

export interface Verse {
  id: number;
  versionId: number;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleSearchResult {
  verse: Verse;
  bookName: string;
  snippet: string;
}
