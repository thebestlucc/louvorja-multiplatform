"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";

// --- Types ---

interface LocalFile {
  file: File;
  relativePath: string;
  size: number;
  detectedType: FileType;
  hymnApiId: number | null;
  albumApiId: number | null;
}

type FileType = "audio" | "playback" | "cover" | "album_cover" | "unknown";

type Step = "setup" | "configure" | "publish";

interface PublishState {
  status: "idle" | "uploading" | "publishing" | "done" | "error";
  progress: number;
  message: string;
  manifestVersion?: number;
  error?: string;
}

// --- Helpers ---

function detectFileType(relativePath: string): FileType {
  const lower = relativePath.toLowerCase();
  if (
    lower.includes("/playback/") ||
    lower.includes("/karaoke/") ||
    lower.includes("/base/")
  )
    return "playback";
  if (lower.includes("/album") || lower.includes("/collection"))
    return "album_cover";
  if (lower.includes("/cover/")) return "cover";
  if (lower.includes("/audio/") || lower.match(/\/(hino|hymn|musica|song)/))
    return "audio";
  if (
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav") ||
    lower.endsWith(".flac") ||
    lower.endsWith(".ogg")
  )
    return "audio";
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  )
    return "cover";
  return "unknown";
}

function extractIds(relativePath: string): {
  hymnApiId: number | null;
  albumApiId: number | null;
} {
  const segments = relativePath.split("/");
  const numericSegments = segments
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n));

  if (
    relativePath.includes("album") ||
    relativePath.includes("collection")
  ) {
    return { hymnApiId: null, albumApiId: numericSegments[0] ?? null };
  }
  return { hymnApiId: numericSegments[0] ?? null, albumApiId: null };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function groupFiles(
  files: LocalFile[],
  packIdPrefix: string,
): Array<{ id: string; files: LocalFile[]; totalSize: number }> {
  const MAX_PACK_SIZE = 500 * 1024 * 1024;
  const sorted = [...files]
    .filter((f) => f.detectedType !== "unknown")
    .sort((a, b) => b.size - a.size);
  const packs: Array<{ id: string; files: LocalFile[]; totalSize: number }> =
    [];
  let current: (typeof packs)[0] | null = null;
  let index = 1;

  for (const file of sorted) {
    if (!current || current.totalSize + file.size > MAX_PACK_SIZE) {
      current = {
        id: `${packIdPrefix}-${String(index).padStart(3, "0")}`,
        files: [],
        totalSize: 0,
      };
      packs.push(current);
      index++;
    }
    current.files.push(file);
    current.totalSize += file.size;
  }

  return packs;
}

const FILE_TYPE_LABELS: Record<FileType, string> = {
  audio: "Audio",
  playback: "Playback",
  cover: "Cover",
  album_cover: "Album Cover",
  unknown: "Unknown (skipped)",
};

const FILE_TYPE_OPTIONS: FileType[] = [
  "audio",
  "playback",
  "cover",
  "album_cover",
  "unknown",
];

// --- Component ---

export default function NewPackPage() {
  const [step, setStep] = useState<Step>("setup");
  const [packPrefix, setPackPrefix] = useState("hymnal-pt");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [publishState, setPublishState] = useState<PublishState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(undefined!);

  // ── Step 1: file selection ───────────────────────────────────────────────

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    const localFiles: LocalFile[] = [];
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const relativePath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      // Strip leading folder name (first segment)
      const parts = relativePath.split("/");
      const stripped =
        parts.length > 1 ? parts.slice(1).join("/") : relativePath;
      const detectedType = detectFileType(stripped);
      const { hymnApiId, albumApiId } = extractIds(stripped);
      localFiles.push({
        file,
        relativePath: stripped,
        size: file.size,
        detectedType,
        hymnApiId,
        albumApiId,
      });
    }
    setFiles(localFiles);
    if (localFiles.length > 0) setStep("configure");
  };

  // ── Step 2: configure ───────────────────────────────────────────────────

  const updateFileType = (index: number, type: FileType) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, detectedType: type } : f)),
    );
  };

  const updateHymnId = (index: number, value: string) => {
    const n = parseInt(value, 10);
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, hymnApiId: isNaN(n) ? null : n } : f,
      ),
    );
  };

  const updateAlbumId = (index: number, value: string) => {
    const n = parseInt(value, 10);
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, albumApiId: isNaN(n) ? null : n } : f,
      ),
    );
  };

  const packs = groupFiles(files, packPrefix);
  const knownFiles = files.filter((f) => f.detectedType !== "unknown");
  const unknownFiles = files.filter((f) => f.detectedType === "unknown");
  const totalSize = knownFiles.reduce((sum, f) => sum + f.size, 0);

  // ── Step 3: publish ─────────────────────────────────────────────────────

  const handlePublish = async () => {
    setStep("publish");
    setPublishState({
      status: "uploading",
      progress: 10,
      message: "Uploading files to server…",
    });

    try {
      const formData = new FormData();
      for (const lf of knownFiles) {
        formData.append(lf.relativePath, lf.file);
      }

      const uploadRes = await fetch("/api/packs/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = (await uploadRes.json()) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }

      const uploadData = (await uploadRes.json()) as {
        sessionId: string;
        files: Array<{
          fieldName: string;
          localPath: string;
          packPath: string;
          size: number;
        }>;
      };

      setPublishState({
        status: "publishing",
        progress: 50,
        message: "Building ZIPs and uploading to R2…",
      });

      const serverFileMap = new Map(
        uploadData.files.map((f) => [f.fieldName, f]),
      );

      const packRequests = packs.map((pack) => {
        const version = 1;
        const fileEntries = pack.files
          .map((lf) => {
            const serverFile = serverFileMap.get(lf.relativePath);
            return {
              localPath: serverFile?.localPath ?? "",
              packPath: lf.relativePath,
              hymnApiId: lf.hymnApiId,
              albumApiId: lf.albumApiId,
              fileType: lf.detectedType as
                | "audio"
                | "playback"
                | "cover"
                | "album_cover",
              size: lf.size,
            };
          })
          .filter((f) => f.localPath !== "");

        return { packId: pack.id, version, files: fileEntries };
      });

      const publishRes = await fetch("/api/packs/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs: packRequests }),
      });

      if (!publishRes.ok) {
        const err = (await publishRes.json()) as { error?: string };
        throw new Error(err.error ?? "Publish failed");
      }

      const publishData = (await publishRes.json()) as {
        manifestVersion: number;
      };
      setPublishState({
        status: "done",
        progress: 100,
        message: `Published ${packs.length} pack(s) successfully!`,
        manifestVersion: publishData.manifestVersion,
      });
    } catch (error) {
      setPublishState({
        status: "error",
        progress: 0,
        message: "Failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            ← Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">New Pack</h1>
          <p className="text-sm text-muted-foreground">
            {step === "setup" && "Select a folder of media files"}
            {step === "configure" &&
              `${files.length} files selected — review and configure`}
            {step === "publish" && "Publishing…"}
          </p>
        </div>
      </div>

      {/* Step: Setup */}
      {step === "setup" && (
        <Card>
          <CardHeader>
            <CardTitle>Pack Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="packPrefix">Pack ID Prefix</Label>
              <Input
                id="packPrefix"
                value={packPrefix}
                onChange={(e) => setPackPrefix(e.target.value)}
                placeholder="e.g. hymnal-pt"
              />
              <p className="text-xs text-muted-foreground">
                Packs will be named <code>{packPrefix}-001</code>,{" "}
                <code>{packPrefix}-002</code>, etc.
              </p>
            </div>

            <div className="space-y-1">
              <Label>Media Folder</Label>
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-10 text-center transition-colors hover:border-primary hover:bg-muted/40"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg
                  className="mb-2 h-8 w-8 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <p className="font-medium">Click to select a folder</p>
                <p className="text-sm text-muted-foreground">
                  All files inside will be included
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                // @ts-expect-error — webkitdirectory is not in TypeScript's HTMLInputElement types
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Configure */}
      {step === "configure" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Files", value: knownFiles.length },
              { label: "Packs", value: packs.length },
              { label: "Total size", value: formatBytes(totalSize) },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-1 text-xl font-semibold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pack groups preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pack Groups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{pack.id}</span>
                  <span className="text-muted-foreground">
                    {pack.files.length} files · {formatBytes(pack.totalSize)}
                  </span>
                </div>
              ))}
              {unknownFiles.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                  {unknownFiles.length} file(s) with unknown type will be
                  skipped
                </div>
              )}
              {packs.length === 0 && unknownFiles.length === 0 && (
                <p className="text-sm text-muted-foreground">No files to pack.</p>
              )}
            </CardContent>
          </Card>

          {/* File list with type overrides */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Files ({files.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 space-y-1 overflow-y-auto">
                {files.map((lf, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded border border-border/50 px-2 py-1.5 text-xs"
                  >
                    <span
                      className="truncate font-mono text-muted-foreground"
                      title={lf.relativePath}
                    >
                      {lf.relativePath}
                    </span>
                    <span className="text-muted-foreground">
                      {formatBytes(lf.size)}
                    </span>
                    <select
                      className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                      value={lf.detectedType}
                      onChange={(e) =>
                        updateFileType(i, e.target.value as FileType)
                      }
                    >
                      {FILE_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {FILE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="w-16 rounded border border-border bg-background px-1 py-0.5 text-xs"
                      placeholder="ID"
                      value={
                        lf.detectedType === "album_cover"
                          ? (lf.albumApiId ?? "")
                          : (lf.hymnApiId ?? "")
                      }
                      onChange={(e) => {
                        if (lf.detectedType === "album_cover")
                          updateAlbumId(i, e.target.value);
                        else updateHymnId(i, e.target.value);
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("setup")}>
              ← Back
            </Button>
            <Button
              onClick={() => void handlePublish()}
              disabled={packs.length === 0}
            >
              Publish {packs.length} Pack{packs.length !== 1 ? "s" : ""} →
            </Button>
          </div>
        </div>
      )}

      {/* Step: Publish */}
      {step === "publish" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {publishState.status === "done"
                ? "Published!"
                : publishState.status === "error"
                  ? "Error"
                  : "Publishing…"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {publishState.status !== "error" && (
              <Progress value={publishState.progress}>
                <ProgressLabel>{publishState.message}</ProgressLabel>
                <ProgressValue />
                <ProgressTrack>
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
            )}
            {publishState.status === "error" && (
              <p className="text-sm text-muted-foreground">
                {publishState.message}
              </p>
            )}
            {publishState.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {publishState.error}
              </div>
            )}
            {publishState.status === "done" && (
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                Manifest updated to v{publishState.manifestVersion}. The Tauri
                app will pick up the new packs on next launch.
              </div>
            )}
            {(publishState.status === "done" ||
              publishState.status === "error") && (
              <div className="flex gap-2">
                <Link href="/">
                  <Button variant="outline">← Back to packs</Button>
                </Link>
                {publishState.status === "error" && (
                  <Button onClick={() => void handlePublish()}>Retry</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
