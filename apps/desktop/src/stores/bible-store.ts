import { create } from "zustand";

interface BibleState {
  currentVersionId: number;
  currentBook: string;
  currentChapter: number;
  selectedVerses: number[];
  lastSelectedVerse: number | null;
  setVersion: (id: number) => void;
  setBook: (book: string) => void;
  setChapter: (chapter: number) => void;
  setSelectedVerses: (verses: number[]) => void;
  setLastSelectedVerse: (verse: number | null) => void;
}

export const useBibleStore = create<BibleState>((set) => ({
  currentVersionId: 0,
  currentBook: "",
  currentChapter: 0,
  selectedVerses: [],
  lastSelectedVerse: null,
  setVersion: (id) =>
    set({ currentVersionId: id, currentBook: "", currentChapter: 0, selectedVerses: [], lastSelectedVerse: null }),
  setBook: (book) =>
    set({ currentBook: book, currentChapter: 0, selectedVerses: [], lastSelectedVerse: null }),
  setChapter: (chapter) =>
    set({ currentChapter: chapter, selectedVerses: [], lastSelectedVerse: null }),
  setSelectedVerses: (verses) => set({ selectedVerses: verses }),
  setLastSelectedVerse: (verse) => set({ lastSelectedVerse: verse }),
}));
