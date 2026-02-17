import { AlertTriangle, CheckCircle2, Loader2, StopCircle } from "lucide-react";
import type { MigrationProgress, MigrationReport } from "../../types/migration";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

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
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              {report.errors.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {labels.summaryTitle}
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {report.domains.map((domain) => (
                <li key={domain.domain}>
                  {domain.domain}: {domain.imported} imported, {domain.skipped} skipped
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {report.errors.length > 0
                ? `${labels.summaryErrors}: ${report.errors.length}`
                : labels.summaryNoErrors}
            </p>
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
