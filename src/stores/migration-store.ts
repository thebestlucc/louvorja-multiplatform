// src/stores/migration-store.ts
import { create } from "zustand";
import type { MigrationReport, MigrationStatus } from "../types/migration";

interface MigrationState {
  runId: string | null;
  sourcePath: string;
  status: MigrationStatus | "idle";
  report: MigrationReport | null;
  setMigrationRun: (runId: string, sourcePath: string) => void;
  setMigrationStatus: (status: MigrationStatus) => void;
  setMigrationReport: (report: MigrationReport | null) => void;
  clearMigration: () => void;
}

const initialState = {
  runId: null as string | null,
  sourcePath: "",
  status: "idle" as MigrationStatus | "idle",
  report: null as MigrationReport | null,
};

export const useMigrationStore = create<MigrationState>((set) => ({
  ...initialState,
  setMigrationRun: (runId, sourcePath) =>
    set({
      runId,
      sourcePath,
      status: "running",
      report: null,
    }),
  setMigrationStatus: (status) => set({ status }),
  setMigrationReport: (report) =>
    set({
      report,
      status: report?.status ?? "idle",
    }),
  clearMigration: () => set(initialState),
}));
