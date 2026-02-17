import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { ImportProgress } from "../../components/migration/import-progress";
import { ImportWizard } from "../../components/migration/import-wizard";
import { Button } from "../../components/ui/button";
import {
  useCancelMigration,
  useMigrationProgress,
  useMigrationReport,
  useStartMigration,
} from "../../lib/queries";
import type {
  MigrationOptions,
  MigrationProgress,
  MigrationProgressEvent,
} from "../../types/migration";
import { useOnboardingStore } from "../../stores/onboarding-store";

export const Route = createFileRoute("/onboarding/import")({
  component: OnboardingImportPage,
});

const defaultOptions: MigrationOptions = {
  includeHymns: true,
  includeBible: true,
  includeFavorites: true,
  includeServices: true,
  includeSettings: true,
  replaceExisting: false,
};

function OnboardingImportPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const mode = useOnboardingStore((state) => state.mode);
  const runId = useOnboardingStore((state) => state.migrationRunId);
  const storedSourcePath = useOnboardingStore((state) => state.migrationSourcePath);
  const storedReport = useOnboardingStore((state) => state.migrationReport);
  const setMode = useOnboardingStore((state) => state.setMode);
  const setMigrationRun = useOnboardingStore((state) => state.setMigrationRun);
  const setMigrationStatus = useOnboardingStore((state) => state.setMigrationStatus);
  const setMigrationReport = useOnboardingStore((state) => state.setMigrationReport);
  const clearMigration = useOnboardingStore((state) => state.clearMigration);
  const startMutation = useStartMigration();
  const cancelMutation = useCancelMigration();
  const [sourcePath, setSourcePath] = useState(storedSourcePath);
  const [options, setOptions] = useState<MigrationOptions>(defaultOptions);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventProgress, setEventProgress] = useState<MigrationProgress | null>(null);
  const progressQuery = useMigrationProgress(runId, { enabled: Boolean(runId) });

  const shouldLoadReport = Boolean(
    runId
      && progressQuery.data
      && progressQuery.data.status !== "running"
      && progressQuery.data.status !== "cancelling",
  );
  const reportQuery = useMigrationReport(runId, { enabled: shouldLoadReport });
  const progress = progressQuery.data ?? eventProgress;

  useEffect(() => {
    if (!progress) {
      return;
    }
    setMigrationStatus(progress.status);
  }, [progress, setMigrationStatus]);

  useEffect(() => {
    if (!reportQuery.data) {
      return;
    }
    setMigrationReport(reportQuery.data);
  }, [reportQuery.data, setMigrationReport]);

  useEffect(() => {
    if (!runId) {
      setEventProgress(null);
      return;
    }

    const unlisten = listen<MigrationProgressEvent>("migration-progress", (event) => {
      if (event.payload.runId !== runId) {
        return;
      }
      setEventProgress((previous) => ({
        runId: event.payload.runId,
        step: event.payload.step,
        completed: event.payload.completed,
        total: event.payload.total,
        percent: event.payload.percent,
        etaSeconds: event.payload.etaSeconds,
        message: event.payload.message,
        status: previous?.status ?? "running",
        updatedAt: previous?.updatedAt ?? new Date().toISOString(),
      }));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [runId]);

  const effectiveReport = reportQuery.data ?? storedReport;
  const isRunning = progress?.status === "running" || progress?.status === "cancelling";
  const showProgress = Boolean(runId && (isRunning || effectiveReport || progress));

  const progressLabels = useMemo(
    () => ({
      title: t("migration.progress.title"),
      waiting: t("migration.progress.waiting"),
      cancel: t("migration.progress.cancel"),
      continue: t("migration.progress.continue"),
      retry: t("migration.progress.retry"),
      statusRunning: t("migration.progress.statusRunning"),
      statusCompleted: t("migration.progress.statusCompleted"),
      statusFailed: t("migration.progress.statusFailed"),
      statusCancelled: t("migration.progress.statusCancelled"),
      summaryTitle: t("migration.progress.summaryTitle"),
      summaryErrors: t("migration.progress.summaryErrors"),
      summaryNoErrors: t("migration.progress.summaryNoErrors"),
    }),
    [t],
  );

  if (mode === "fresh") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("onboarding.import.freshSelected")}</p>
        <Button type="button" onClick={() => navigate({ to: "/onboarding/monitors" })}>
          {t("onboarding.import.continueToMonitors")}
        </Button>
      </div>
    );
  }

  const handleStartImport = async () => {
    setErrorMessage(null);
    setMode("import");

    try {
      const run = await startMutation.mutateAsync({
        oldDbPath: sourcePath.trim(),
        options,
      });
      setMigrationRun(run.runId, sourcePath.trim());
      setMigrationReport(null);
      setEventProgress(null);
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  return (
    <div className="space-y-4">
      {!showProgress ? (
        <ImportWizard
          title={t("migration.wizard.title")}
          description={t("migration.wizard.description")}
          sourcePath={sourcePath}
          options={options}
          loading={startMutation.isPending}
          errorMessage={errorMessage}
          onSourcePathChange={setSourcePath}
          onBrowseSourcePath={async () => {
            const selected = await openFileDialog({
              multiple: false,
              title: t("migration.wizard.browse"),
              filters: [
                {
                  name: "SQLite",
                  extensions: ["db", "sqlite", "sqlite3"],
                },
              ],
            });
            if (typeof selected === "string") {
              setSourcePath(selected);
              setErrorMessage(null);
            }
          }}
          onOptionsChange={setOptions}
          onStartImport={handleStartImport}
          onStartFresh={() => {
            setMode("fresh");
            clearMigration();
            navigate({ to: "/onboarding/monitors" });
          }}
          labels={{
            sourcePath: t("migration.wizard.sourcePath"),
            browse: t("migration.wizard.browse"),
            startImport: t("migration.wizard.startImport"),
            startFresh: t("migration.wizard.startFresh"),
            includeHymns: t("migration.wizard.includeHymns"),
            includeBible: t("migration.wizard.includeBible"),
            includeFavorites: t("migration.wizard.includeFavorites"),
            includeServices: t("migration.wizard.includeServices"),
            includeSettings: t("migration.wizard.includeSettings"),
            replaceExisting: t("migration.wizard.replaceExisting"),
            domainTitle: t("migration.wizard.domainTitle"),
            domainsSelected: t("migration.wizard.domainsSelected"),
            domainsNoneSelected: t("migration.wizard.domainsNoneSelected"),
          }}
        />
      ) : null}

      {showProgress ? (
        <ImportProgress
          progress={progress}
          report={effectiveReport}
          loadingReport={reportQuery.isLoading}
          cancelling={cancelMutation.isPending}
          labels={progressLabels}
          onCancel={() => {
            if (!runId) {
              return;
            }
            cancelMutation.mutate(runId);
          }}
          onContinue={() => {
            navigate({ to: "/onboarding/monitors" });
          }}
          onRetry={() => {
            clearMigration();
            setEventProgress(null);
          }}
        />
      ) : null}
    </div>
  );
}
