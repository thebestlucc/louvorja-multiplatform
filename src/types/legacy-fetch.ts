export type ApiLanguage = "pt" | "en" | "es";

export interface LegacyFetchOptions {
  language: ApiLanguage;
  includeHymnal: boolean;
  replaceExisting: boolean;
  downloadAudio: boolean;
  downloadImages: boolean;
}

export type LegacyFetchStatus =
  | "pending"
  | "fetching"
  | "importing"
  | "downloading"
  | "completed"
  | "failed"
  | "cancelled";

export interface LegacyFetchProgress {
  runId: string;
  step: string;
  status: LegacyFetchStatus;
  percent: number;
  message: string | null;
  itemsTotal: number;
  itemsProcessed: number;
}

export interface LegacyFetchError {
  itemType: string;
  itemId: string | null;
  message: string;
}

export interface LegacyFetchReport {
  runId: string;
  hymnsFetched: number;
  hymnsImported: number;
  hymnsSkipped: number;
  albumsFetched: number;
  audioDownloaded: number;
  imagesDownloaded: number;
  errors: LegacyFetchError[];
  durationMs: number;
}

export interface ApiParams {
  connFtp: string | null;
  dbVersion: number | null;
  downloadWin: string | null;
  downloadMac: string | null;
  downloadLinux: string | null;
  versionWin: string | null;
  versionMac: string | null;
  versionLinux: string | null;
  helpPt: string | null;
  helpEn: string | null;
  helpEs: string | null;
}
