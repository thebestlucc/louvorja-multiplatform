import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBibleVersions,
  getBooks,
  getVerses,
  searchBible,
  searchBibleGlobal,
  importBibleVersion,
} from "../tauri";
import { queryKeys } from "./keys";

export function useBibleVersions() {
  return useQuery({
    queryKey: queryKeys.bible.versions,
    queryFn: () => getBibleVersions(),
  });
}

export function useBooks(versionId: number) {
  return useQuery({
    queryKey: queryKeys.bible.books(versionId),
    queryFn: () => getBooks(versionId),
    enabled: versionId > 0,
  });
}

export function useVerses(versionId: number, book: string, chapter: number) {
  return useQuery({
    queryKey: queryKeys.bible.verses(versionId, book, chapter),
    queryFn: () => getVerses(versionId, book, chapter),
    enabled: versionId > 0 && book.length > 0 && chapter > 0,
  });
}

export function useBibleSearch(query: string, versionId: number | null) {
  return useQuery({
    queryKey: queryKeys.bible.search(query, versionId),
    queryFn: () => searchBible(query, versionId),
    enabled: query.trim().length >= 2,
  });
}

export function useImportBible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; abbreviation: string; language: string; versesJson: string }) =>
      importBibleVersion(vars.name, vars.abbreviation, vars.language, vars.versesJson),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bible.versions });
    },
  });
}

export function useSearchBibleGlobal(query: string) {
  return useQuery({
    queryKey: queryKeys.bible.globalSearch(query),
    queryFn: () => searchBibleGlobal(query),
    enabled: query.length >= 2,
  });
}
