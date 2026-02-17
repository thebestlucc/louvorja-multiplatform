export interface MigrationOptions {
  includeHymns: boolean;
  includeBible: boolean;
  includeFavorites: boolean;
  includeServices: boolean;
  includeSettings: boolean;
  replaceExisting: boolean;
}

export interface MigrationRunInfo {
  runId: string;
  startedAt: string;
  sourcePath: string;
}

export type MigrationStatus = "running" | "cancelling" | "completed" | "failed" | "cancelled";

export interface MigrationProgress {
  runId: string;
  step: string;
  completed: number;
  total: number;
  percent: number;
  etaSeconds: number | null;
  message: string;
  status: MigrationStatus;
  updatedAt: string;
}

export interface MigrationProgressEvent {
  runId: string;
  step: string;
  completed: number;
  total: number;
  percent: number;
  etaSeconds: number | null;
  message: string;
}

export interface MigrationErrorItem {
  domain: string;
  code: string;
  message: string;
}

export interface MigrationDomainReport {
  domain: string;
  imported: number;
  skipped: number;
}

export interface MigrationReport {
  runId: string;
  status: MigrationStatus;
  startedAt: string;
  finishedAt: string | null;
  sourcePath: string;
  domains: MigrationDomainReport[];
  errors: MigrationErrorItem[];
}

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
}
