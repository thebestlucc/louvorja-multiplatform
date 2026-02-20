import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, StopCircle } from "lucide-react";
import { useState } from "react";
import type { MigrationErrorItem, MigrationProgress, MigrationReport } from "../../types/migration";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const ERROR_CODE_LABELS: Record<string, string> = {
  SOURCE_OPEN_FAILED: "Source Open Failed",
  DOMAIN_IMPORT_FAILED: "Import Failed",
  INTERNAL_ERROR: "Internal Error",
  CANCELLED: "Cancelled",
};

const DOMAIN_COLORS: Record<string, string> = {
  hymns: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  bible: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  favorites: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  services: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  settings: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

function ErrorItem({ error }: { error: MigrationErrorItem }) {
  const domainClass = DOMAIN_COLORS[error.domain] ?? "bg-muted text-muted-foreground";
  const codeLabel = ERROR_CODE_LABELS[error.code] ?? error.code;
  return (
    <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", domainClass)}>
          {error.domain}
        </span>
        <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
          {codeLabel}
        </span>
      </div>
      <p className="text-xs text-foreground/80 leading-relaxed">{error.message}</p>
      {error.context ? (
        <p className="mt-1 text-[10px] text-muted-foreground italic">{error.context}</p>
      ) : null}
    </div>
  );
}

interface ImportProgressProps {
  progress: MigrationProgress | null;
  report: MigrationReport | null;
  loadingReport?: boolean;
  cancelling?: boolean;
  labels: {
    title: string;
    waiting: string;
    cancel: string;
    continue: string;
    retry: string;
    statusRunning: string;
    statusCompleted: string;
    statusFailed: string;
    statusCancelled: string;
    summaryTitle: string;
    summaryErrors: string;
    summaryNoErrors: string;
  };
  onCancel: () => void;
  onContinue: () => void;
  onRetry: () => void;
}

const ERRORS_PREVIEW = 3;

export function ImportProgress({
  progress,
  report,
  loadingReport,
  cancelling,
  labels,
  onCancel,
  onContinue,
  onRetry,
}: ImportProgressProps) {
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const status = progress?.status ?? "running";
  const isRunning = status === "running" || status === "cancelling";
  const hasFailure = status === "failed";
  const isCancelled = status === "cancelled";
  const isCompleted = status === "completed";

  const statusLabel = isCompleted
    ? labels.statusCompleted
    : hasFailure
      ? labels.statusFailed
      : isCancelled
        ? labels.statusCancelled
        : labels.statusRunning;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{statusLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-muted">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                hasFailure ? "bg-destructive" : isCompleted ? "bg-green-600" : "bg-primary",
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress?.percent ?? 0))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress?.message ?? labels.waiting}</span>
            <span>
              {progress?.completed ?? 0}/{progress?.total ?? 0}
            </span>
          </div>
        </div>

        {loadingReport ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {labels.waiting}
          </div>
        ) : null}

        {report ? (
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {report.errors.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              )}
              {labels.summaryTitle}
            </div>

            {/* Domain-level summary table */}
            <div className="rounded border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="text-left px-2 py-1 font-medium">Domain</th>
                    <th className="text-right px-2 py-1 font-medium text-green-600">Imported</th>
                    <th className="text-right px-2 py-1 font-medium text-muted-foreground">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {report.domains.map((domain, i) => (
                    <tr key={domain.domain} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="px-2 py-1 capitalize font-medium text-foreground">{domain.domain}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-green-600">{domain.imported.toLocaleString()}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{domain.skipped.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detailed error list */}
            {report.errors.length === 0 ? (
              <p className="text-xs text-green-600 font-medium">{labels.summaryNoErrors}</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-destructive">
                  {labels.summaryErrors}: {report.errors.length}
                </p>
                <div className="space-y-1.5">
                  {(errorsExpanded ? report.errors : report.errors.slice(0, ERRORS_PREVIEW)).map((err, i) => (
                    <ErrorItem key={i} error={err} />
                  ))}
                </div>
                {report.errors.length > ERRORS_PREVIEW ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs w-full"
                    onClick={() => setErrorsExpanded((v) => !v)}
                  >
                    {errorsExpanded ? (
                      <><ChevronUp className="mr-1 h-3 w-3" /> Show less</>
                    ) : (
                      <><ChevronDown className="mr-1 h-3 w-3" /> Show {report.errors.length - ERRORS_PREVIEW} more</>
                    )}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {isRunning ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={cancelling}>
              <StopCircle className="mr-2 h-4 w-4" />
              {labels.cancel}
            </Button>
          ) : null}
          {(isCompleted || isCancelled) && report ? (
            <Button type="button" onClick={onContinue}>
              {labels.continue}
            </Button>
          ) : null}
          {hasFailure ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              {labels.retry}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
