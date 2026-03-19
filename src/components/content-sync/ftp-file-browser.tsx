import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import { appDataDir } from "@tauri-apps/api/path";
import { FolderOpen, Download, RefreshCw, AlertCircle, CheckSquare } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { catcher } from "../../lib/catcher";
import { useListFtpFiles, useDownloadFtpFiles } from "../../lib/queries";
import type { FtpDownloadProgress, FtpFileEntry } from "../../lib/tauri";
import { useFtpBrowserStore, type RowDownloadState } from "../../stores/ftp-browser-store";

export function FtpFileBrowser() {
  const { t } = useTranslation();

  const listMutation = useListFtpFiles();
  const downloadMutation = useDownloadFtpFiles();

  const entries = useFtpBrowserStore((s) => s.entries);
  const isLoading = useFtpBrowserStore((s) => s.isLoading);
  const loadError = useFtpBrowserStore((s) => s.loadError);
  const checked = useFtpBrowserStore((s) => s.checked);
  const rowStates = useFtpBrowserStore((s) => s.rowStates);
  
  const setEntries = useFtpBrowserStore((s) => s.setEntries);
  const setIsLoading = useFtpBrowserStore((s) => s.setIsLoading);
  const setLoadError = useFtpBrowserStore((s) => s.setLoadError);
  const setChecked = useFtpBrowserStore((s) => s.setChecked);
  const setRowStates = useFtpBrowserStore((s) => s.setRowStates);

  const [appData, setAppData] = useState<string>("");

  // Resolve app data dir once for "Open in Finder"
  useEffect(() => {
    void appDataDir().then(setAppData);
  }, []);

  // Listen to ftp-files-loaded and ftp-files-error events from background thread
  useEffect(() => {
    const unlistenLoaded = listen<FtpFileEntry[]>("ftp-files-loaded", (event) => {
      const result = event.payload;
      setEntries(result);
      // Auto-check missing files on first load
      setChecked(new Set(result.filter((e) => !e.existsLocally).map((e) => e.remotePath)));
      setIsLoading(false);
    });

    const unlistenError = listen<string>("ftp-files-error", (event) => {
      setLoadError(event.payload);
      setIsLoading(false);
    });

    return () => {
      void unlistenLoaded.then((fn) => fn());
      void unlistenError.then((fn) => fn());
    };
  }, [setEntries, setIsLoading, setLoadError, setChecked]);

  // Listen to per-file progress events emitted by the background thread
  useEffect(() => {
    const unlisten = listen<FtpDownloadProgress>("ftp-file-download-progress", (event) => {
      const p = event.payload;
      setRowStates((prev) => ({
        ...prev,
        [p.remotePath]: {
          inProgress: p.done < p.total,
          done: p.success && p.done <= p.total,
          error: p.error ?? null,
        },
      }));

      // If download succeeded, mark the entry as existing locally
      if (p.success) {
        setEntries(
          entries.map((e) =>
            e.remotePath === p.remotePath ? { ...e, existsLocally: true } : e,
          ),
        );
        // Uncheck after successful download
        setChecked((prev) => {
          const next = new Set(prev);
          next.delete(p.remotePath);
          return next;
        });
      }
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [entries, setEntries, setRowStates, setChecked]);

  const handleLoad = useCallback(async () => {
    setLoadError(null);
    setRowStates({});
    setIsLoading(true);
    // fire-and-forget: result comes via "ftp-files-loaded" / "ftp-files-error" events
    const [, err] = await catcher(listMutation.mutateAsync(), { notify: true });
    if (err) {
      setLoadError(err.message);
      setIsLoading(false);
    }
  }, [listMutation, setIsLoading, setLoadError, setRowStates]);

  const handleToggleCheck = (remotePath: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(remotePath)) {
        next.delete(remotePath);
      } else {
        next.add(remotePath);
      }
      return next;
    });
  };

  const handleDownloadSingle = async (remotePath: string) => {
    setRowStates((prev) => ({
      ...prev,
      [remotePath]: { inProgress: true, done: false, error: null },
    }));
    await catcher(downloadMutation.mutateAsync([remotePath]), { notify: true });
  };

  const handleDownloadSelected = async () => {
    const paths = Array.from(checked);
    // Mark all as in-progress immediately
    const inProgressMap: Record<string, RowDownloadState> = {};
    for (const p of paths) {
      inProgressMap[p] = { inProgress: true, done: false, error: null };
    }
    setRowStates((prev) => ({ ...prev, ...inProgressMap }));
    await catcher(downloadMutation.mutateAsync(paths), { notify: true });
  };

  const handleOpenInFinder = async (entry: FtpFileEntry) => {
    if (!entry.localPath) return;
    const fullPath = `${appData}/${entry.localPath}`;
    const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await catcher(openPath(parentDir), { notify: true });
  };

  // Select-all helpers
  const missingEntries = entries.filter((e) => !e.existsLocally);
  const allMissingChecked =
    missingEntries.length > 0 &&
    missingEntries.every((e) => checked.has(e.remotePath));

  const handleToggleAll = () => {
    if (allMissingChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(missingEntries.map((e) => e.remotePath)));
    }
  };

  const handleSelectAllMissing = () => {
    setChecked(new Set(missingEntries.map((e) => e.remotePath)));
  };

  // Only missing files can be checked
  const missingCheckedCount = Array.from(checked).filter((p) => {
    const entry = entries.find((e) => e.remotePath === p);
    return entry && !entry.existsLocally;
  }).length;

  const isDownloading = downloadMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => void handleLoad()}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
          />
          {isLoading
            ? t("settings.ftpBrowser.loading")
            : t("settings.ftpBrowser.loadFiles")}
        </Button>

        {missingEntries.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAllMissing}
            disabled={isLoading || isDownloading}
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            {t("settings.ftpBrowser.selectAllMissing", { count: missingEntries.length })}
          </Button>
        )}

        {missingCheckedCount > 0 && (
          <Button
            size="sm"
            onClick={() => void handleDownloadSelected()}
            disabled={isDownloading}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("settings.ftpBrowser.downloadSelected", { count: missingCheckedCount })}
          </Button>
        )}

        {entries.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("settings.ftpBrowser.fileCount", { count: entries.length })}
          </span>
        )}
      </div>

      {/* Error state */}
      {loadError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries.length === 0 && !loadError && (
        <p className="text-sm text-muted-foreground">
          {t("settings.ftpBrowser.empty")}
        </p>
      )}

      {/* File table */}
      {entries.length > 0 && (
        <div className="rounded-md border border-border max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-primary"
                    checked={allMissingChecked}
                    onChange={handleToggleAll}
                    aria-label={t("settings.ftpBrowser.selectAll")}
                  />
                </TableHead>
                <TableHead>{t("settings.ftpBrowser.columnPath")}</TableHead>
                <TableHead className="w-24">{t("settings.ftpBrowser.columnSize")}</TableHead>
                <TableHead className="w-28">{t("settings.ftpBrowser.columnStatus")}</TableHead>
                <TableHead className="w-32 text-right">{t("settings.ftpBrowser.columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const rowState = rowStates[entry.remotePath];
                const isRowDownloading = rowState?.inProgress ?? false;
                const isRowDone = rowState?.done ?? false;
                const rowError = rowState?.error ?? null;

                return (
                  <TableRow key={entry.remotePath}>
                    {/* Checkbox — only for missing files */}
                    <TableCell>
                      {!entry.existsLocally && !isRowDone && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-primary"
                          checked={checked.has(entry.remotePath)}
                          onChange={() => handleToggleCheck(entry.remotePath)}
                          disabled={isRowDownloading}
                          aria-label={t("settings.ftpBrowser.selectFile")}
                        />
                      )}
                    </TableCell>

                    {/* Remote path */}
                    <TableCell className="font-mono text-xs">
                      {entry.remotePath}
                    </TableCell>

                    {/* File size */}
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.fileSize != null
                        ? formatBytes(entry.fileSize)
                        : "—"}
                    </TableCell>

                    {/* Status badge */}
                    <TableCell>
                      {isRowDownloading ? (
                        <Badge variant="secondary" className="text-xs">
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          {t("settings.ftpBrowser.downloading")}
                        </Badge>
                      ) : rowError ? (
                        <Badge variant="destructive" className="text-xs" title={rowError}>
                          {t("settings.ftpBrowser.error")}
                        </Badge>
                      ) : entry.existsLocally || isRowDone ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-600 dark:text-green-400 text-xs"
                        >
                          {t("settings.ftpBrowser.found")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          {t("settings.ftpBrowser.missing")}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(entry.existsLocally || isRowDone) && entry.localPath && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t("settings.ftpBrowser.openInFinder")}
                            onClick={() => void handleOpenInFinder(entry)}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {!entry.existsLocally && !isRowDone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t("settings.ftpBrowser.download")}
                            disabled={isRowDownloading || isDownloading}
                            onClick={() => void handleDownloadSingle(entry.remotePath)}
                          >
                            {isRowDownloading ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
