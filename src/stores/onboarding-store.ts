import { create } from "zustand";
import type { MigrationReport, MigrationStatus } from "../types/migration";

type OnboardingMode = "fresh" | "import" | null;

interface OnboardingState {
  mode: OnboardingMode;
  migrationRunId: string | null;
  migrationStatus: MigrationStatus | "idle";
  migrationReport: MigrationReport | null;
  migrationSourcePath: string;
  setMode: (mode: OnboardingMode) => void;
  setMigrationRun: (runId: string, sourcePath: string) => void;
  setMigrationStatus: (status: MigrationStatus) => void;
  setMigrationReport: (report: MigrationReport | null) => void;
  clearMigration: () => void;
  reset: () => void;
}

const initialState = {
  mode: null as OnboardingMode,
  migrationRunId: null as string | null,
  migrationStatus: "idle" as MigrationStatus | "idle",
  migrationReport: null as MigrationReport | null,
  migrationSourcePath: "",
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  setMigrationRun: (runId, sourcePath) =>
    set({
      mode: "import",
      migrationRunId: runId,
      migrationSourcePath: sourcePath,
      migrationStatus: "running",
    }),
  setMigrationStatus: (status) => set({ migrationStatus: status }),
  setMigrationReport: (report) =>
    set({
      migrationReport: report,
      migrationStatus: report?.status ?? "idle",
    }),
  clearMigration: () =>
    set({
      migrationRunId: null,
      migrationStatus: "idle",
      migrationReport: null,
      migrationSourcePath: "",
    }),
  reset: () => set(initialState),
}));
