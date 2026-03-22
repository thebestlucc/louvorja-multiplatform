"use client";

import { useRef, useState } from "react";
import { catcher } from "@/lib/catcher";
import type { ContentManifest } from "@/lib/manifest";
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
}

type FileType = "audio" | "playback" | "cover" | "album_cover" | "unknown";

type Step = "setup" | "configure" | "publish";

interface PublishState {
  status: "idle" | "uploading" | "publishing" | "done" | "error";
  progress: number;
  message: string;
  manifestVersion?: number;
  error?: string;
  dbUploadMessage?: string;
}

// --- Helpers ---

function detectFileType(relativePath: string): FileType {
  const lower = relativePath.toLowerCase();
  // Strip optional language prefix: EN/config/… or ES/config/…
  const stripped = lower.replace(/^(en|es|pt)\//, "");

  // FTP image paths — check before audio/PB logic
  // Album covers: config/capas/{id}/cover.bmp  (top-level capas folder)
  if (stripped.startsWith("config/capas/"))
    return "album_cover";
  // Hymn background images: config/imagens/{id}/image.jpg
  if (
    stripped.startsWith("config/imagens/") ||
    stripped.startsWith("config/images/")
  )
    return "cover";

  // PB detection (FTP + canonical): split stem by delimiters, look for exact "pb" token.
  // Handles: 123_pb.mp3, pb_123.mp3, 123-pb-v2.mp3, etc.
  const stem = (lower.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
  const stemTokens = stem.split(/[-_\s.]+/);
  if (
    lower.includes("/playback/") ||
    lower.includes("/karaoke/") ||
    lower.includes("/base/") ||
    lower.includes("/pb/") ||
    stemTokens.includes("pb")
  )
    return "playback";

  if (lower.includes("/album_covers/") || lower.includes("/collection"))
    return "album_cover";
  if (lower.includes("/cover/") || lower.includes("/images/")) return "cover";
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
    lower.endsWith(".webp") ||
    lower.endsWith(".bmp")
  )
    return "cover";
  return "unknown";
}

/**
 * Returns true for macOS metadata files (.DS_Store), __MACOSX folders,
 * and any other hidden/system path segments.
 */
function isSystemFile(relativePath: string): boolean {
  return relativePath.split("/").some(
    (seg) => seg.startsWith(".") || seg === "__MACOSX"
  );
}

/**
 * Returns true for "Hinário Adventista" and its language/spelling variants.
 * Files under these folders go into the flat media path (no album subfolder).
 */
function isHinario(albumName: string): boolean {
  const norm = albumName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return norm.startsWith("hinar") || norm.startsWith("hymnar");
}

/**
 * Extract the album name from an FTP music path.
 * Returns null for non-music paths, paths with no album segment, or paths
 * where the album segment is a bare 4-digit year (e.g. config/musicas/2020/…)
 * — those have no named album and should fall through to the flat id path.
 */
function extractAlbumName(relativePath: string): string | null {
  const strippedParts = relativePath
    .replace(/^(en|es|pt)\//i, "")
    .split("/");
  const dir = strippedParts.slice(0, 2).join("/").toLowerCase();
  if (dir === "config/musicas" || dir === "config/musics") {
    const segment = strippedParts[2] ?? null;
    // A bare 4-digit year is not an album name (e.g. FTP layout: musicas/2020/123/file.mp3)
    if (segment && /^\d{4}$/.test(segment)) return null;
    return segment;
  }
  return null;
}

/**
 * Transform an FTP-structured relative path to the canonical app media path.
 * The ID is extracted from the parent directory of the file (second-to-last segment)
 * — no external ID lookup needed.
 *
 * FTP layout → canonical:
 *   config/musicas/{album}/{id}/{file}     → media/audio|playback/{album}/{file}
 *   config/musicas/{hinario}/{id}/{file}   → media/audio|playback/{id}/{file}  (no album folder)
 *   config/musicas/{year}/{id}/{file}      → media/audio|playback/{id}/{file}  (year is not an album)
 *   config/imagens/{id}/{file}             → media/images/{id}/{file}
 *   config/capas/{id}/{file}              → media/album_covers/{id}/{file}
 *   EN/config/… or ES/config/…            → same, after stripping lang prefix
 */
function canonicalPackPath(relativePath: string, fileType: FileType): string {
  const lower = relativePath.toLowerCase();
  const parts = relativePath.split("/");
  const filename = parts[parts.length - 1] ?? relativePath;
  const id = parts.length >= 2 ? parseInt(parts[parts.length - 2], 10) : NaN;
  if (isNaN(id)) return relativePath;

  const stripped = lower.replace(/^(en|es|pt)\//, "");
  const originalStripped = relativePath.replace(/^(en|es|pt)\//i, "");

  if (stripped.startsWith("config/capas/"))
    return `media/album_covers/${id}/${filename}`;

  if (stripped.startsWith("config/imagens/") || stripped.startsWith("config/images/"))
    return `media/images/${id}/${filename}`;

  if (stripped.startsWith("config/musicas/") || stripped.startsWith("config/musics/")) {
    const subfolder = fileType === "playback" ? "playback" : "audio";
    const albumName = originalStripped.split("/")[2];
    // Skip the album folder if it looks like a bare year (4 digits) or is a Hinario variant
    if (albumName && !isHinario(albumName) && !/^\d{4}$/.test(albumName)) {
      return `media/${subfolder}/${albumName}/${filename}`;
    }
    return `media/${subfolder}/${id}/${filename}`;
  }

  return relativePath;
}

/** Format bytes matching the OS file manager convention.
 *  macOS Finder uses decimal (1 MB = 1,000,000 B).
 *  Windows Explorer uses binary (1 MB = 1,048,576 B).
 */
function formatBytes(bytes: number): string {
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
  const k = isMac ? 1000 : 1024;
  const unit = isMac ? ["B", "KB", "MB", "GB"] : ["B", "KiB", "MiB", "GiB"];
  if (bytes < k) return `${bytes} ${unit[0]}`;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} ${unit[1]}`;
  if (bytes < k * k * k) return `${(bytes / (k * k)).toFixed(1)} ${unit[2]}`;
  return `${(bytes / (k * k * k)).toFixed(2)} ${unit[3]}`;
}

function groupFiles(
  files: LocalFile[],
  packIdPrefix: string,
): Array<{ id: string; files: LocalFile[]; totalSize: number }> {
  // 500 MB decimal — matches macOS display units and stays under Cloudflare's 512 MB CDN cache limit
  const MAX_PACK_SIZE = 500 * 1000 * 1000;

  // Group files by second path segment (subfolder within the root folder).
  // e.g. "hymnal-pt/audio/1/song.mp3" → subfolder "audio"
  // Files with no subfolder (flat in root) fall into a "misc" bucket.
  const buckets = new Map<string, LocalFile[]>();
  for (const file of files) {
    if (file.detectedType === "unknown") continue;
    if (file.relativePath.split("/").some((s) => s.startsWith(".") || s === "__MACOSX")) continue;
    const parts = file.relativePath.split("/");
    const subfolder = parts.length >= 3 ? parts[1] : "misc";
    const bucket = buckets.get(subfolder) ?? [];
    bucket.push(file);
    buckets.set(subfolder, bucket);
  }

  const packs: Array<{ id: string; files: LocalFile[]; totalSize: number }> = [];

  for (const [subfolder, bucketFiles] of buckets) {
    const sorted = [...bucketFiles].sort((a, b) => b.size - a.size);
    let current: (typeof packs)[0] | null = null;
    let index = 1;

    for (const file of sorted) {
      if (!current || current.totalSize + file.size > MAX_PACK_SIZE) {
        current = {
          id: `${packIdPrefix}-${subfolder}-${String(index).padStart(3, "0")}`,
          files: [],
          totalSize: 0,
        };
        packs.push(current);
        index++;
      }
      current.files.push(file);
      current.totalSize += file.size;
    }
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
  const [dbFiles, setDbFiles] = useState<LocalFile[]>([]);
  const [publishState, setPublishState] = useState<PublishState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const [language, setLanguage] = useState<"pt-BR" | "es" | "en-US" | "">("");
  const fileInputRef = useRef<HTMLInputElement>(undefined!);

  // ── Step 1: file selection ───────────────────────────────────────────────

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    const localFiles: LocalFile[] = [];
    const detectedDbFiles: LocalFile[] = [];
    // Derive pack prefix from the selected folder name (first path segment)
    const firstRelative =
      (selected[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath ?? "";
    const folderName = firstRelative.split("/")[0];
    if (folderName) setPackPrefix(folderName);
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const relativePath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      if (isSystemFile(relativePath)) continue;
      // Detect root-level .db files (only 2 path segments: folder/file.db)
      const pathParts = relativePath.split("/");
      if (pathParts.length === 2 && relativePath.toLowerCase().endsWith(".db")) {
        detectedDbFiles.push({ file, relativePath, size: file.size, detectedType: "unknown" });
        continue;
      }
      const detectedType = detectFileType(relativePath);
      localFiles.push({ file, relativePath, size: file.size, detectedType });
    }
    setDbFiles(detectedDbFiles);
    setFiles(localFiles);
    if (localFiles.length > 0 || detectedDbFiles.length > 0) setStep("configure");
  };

  // ── Step 2: configure ───────────────────────────────────────────────────

  const updateFileType = (index: number, type: FileType) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, detectedType: type } : f)),
    );
  };

  const packs = groupFiles(files, packPrefix);
  const knownFiles = files.filter((f) => f.detectedType !== "unknown");
  const unknownFiles = files.filter((f) => f.detectedType === "unknown");
  const totalSize = knownFiles.reduce((sum, f) => sum + f.size, 0);

  // ── Step 3: publish ─────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!language) {
      setPublishState({ status: "error", progress: 0, message: "Failed", error: "Please select a language before publishing." });
      return;
    }
    setStep("publish");

    const BATCH_SIZE = 50;
    const batches: LocalFile[][] = [];
    for (let i = 0; i < knownFiles.length; i += BATCH_SIZE) {
      batches.push(knownFiles.slice(i, i + BATCH_SIZE));
    }
    const totalBatches = batches.length;

    const fail = (message: string) =>
      setPublishState({ status: "error", progress: 0, message: "Failed", error: message });

    // ── DB file upload ──────────────────────────────────────────────────────
    // Case A (packs + db): upload DB with updateManifest=false so no manifest
    //   version is created yet; we'll merge dbUrl/dbVersion into the final
    //   pack-publish call to create a single manifest version.
    // Case B (db only, no packs): upload DB with updateManifest=true (default)
    //   so the manifest is updated immediately and we're done.

    let dbUploadMessage: string | undefined;
    let pendingDbUrl: string | undefined;
    let pendingDbVersion: number | undefined;

    if (dbFiles.length > 0) {
      // Prefer a file named "database.db"; otherwise use the first .db file found
      const dbFile =
        dbFiles.find((f) => f.file.name.toLowerCase() === "database.db") ??
        dbFiles[0];
      setPublishState({
        status: "uploading",
        progress: 0,
        message: `Uploading database file: ${dbFile.file.name}…`,
      });
      const dbFormData = new FormData();
      dbFormData.append("db", dbFile.file);
      // When there are also packs, defer the manifest update to the publish step.
      const hasPacks = packs.length > 0;
      if (hasPacks) {
        dbFormData.append("updateManifest", "false");
      }
      const [dbRes, dbErr] = await catcher<Response>(
        fetch("/api/db", { method: "POST", body: dbFormData }),
      );
      if (dbErr) { fail(dbErr.message); return; }
      if (!dbRes.ok) {
        const body = (await dbRes.json()) as { error?: string };
        fail(body.error ?? "Database upload failed"); return;
      }
      if (hasPacks) {
        // Store url/dbVersion to embed in the final pack publish call.
        const [dbData, dbParseErr] = await catcher(
          dbRes.json() as Promise<{ url: string; dbVersion: number }>,
        );
        if (dbParseErr) { fail(dbParseErr.message); return; }
        pendingDbUrl = dbData.url;
        pendingDbVersion = dbData.dbVersion;
      }
      dbUploadMessage = `Database file found and uploaded: ${dbFile.file.name}`;

      // Case B: only a DB file, no packs — manifest already updated, we're done.
      if (!hasPacks) {
        setPublishState({
          status: "done",
          progress: 100,
          message: "Database uploaded and manifest updated successfully!",
          dbUploadMessage,
        });
        return;
      }
    }

    // ── Fetch manifest once (held in memory for the whole publish session) ──

    const [initialManifest, manifestFetchErr] = await catcher<ContentManifest>(
      fetch("/api/manifest").then((r) => r.json() as Promise<ContentManifest>),
    );
    if (manifestFetchErr) { fail(manifestFetchErr.message); return; }
    // Treat a manifest with manifestVersion 0 and no packs as "empty" (matches
    // what /api/manifest returns when no manifest exists yet on R2).
    let workingManifest: ContentManifest = initialManifest ?? {
      manifestVersion: 0,
      generatedAt: new Date().toISOString(),
      packs: [],
    };

    // ── Upload phase (0–50%) ────────────────────────────────────────────────

    let sessionId: string | null = null;
    const allServerFiles: Array<{
      fieldName: string;
      localPath: string;
      packPath: string;
      size: number;
    }> = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      setPublishState({
        status: "uploading",
        progress: Math.round((batchIndex / totalBatches) * 50),
        message: `Uploading batch ${batchIndex + 1}/${totalBatches}…`,
      });

      const batchFiles = batches[batchIndex];
      // Send paths as a JSON metadata field FIRST so busboy parses it before
      // any file events — avoids encoding issues with non-ASCII filenames in
      // Content-Disposition headers when used as field names.
      const pathMap: Record<number, string> = {};
      batchFiles.forEach((lf, j) => { pathMap[j] = lf.relativePath; });
      const formData = new FormData();
      formData.append("_paths", JSON.stringify(pathMap));
      for (let j = 0; j < batchFiles.length; j++) {
        formData.append(`f${j}`, batchFiles[j].file);
      }

      const uploadUrl: string =
        sessionId != null
          ? `/api/packs/upload?sessionId=${encodeURIComponent(sessionId)}`
          : "/api/packs/upload";

      const [uploadRes, uploadErr] = await catcher<Response>(
        fetch(uploadUrl, { method: "POST", body: formData }),
      );
      if (uploadErr) { fail(uploadErr.message); return; }
      if (!uploadRes.ok) {
        const body = (await uploadRes.json()) as { error?: string };
        fail(body.error ?? "Upload failed"); return;
      }

      type UploadResult = {
        sessionId: string;
        files: Array<{ fieldName: string; localPath: string; packPath: string; size: number }>;
      };
      const [uploadData, parseErr] = await catcher<UploadResult>(
        uploadRes.json() as Promise<UploadResult>,
      );
      if (parseErr) { fail(parseErr.message); return; }

      if (sessionId == null) sessionId = uploadData.sessionId;
      allServerFiles.push(...uploadData.files);
    }

    // ── Publish phase (50–100%) ─────────────────────────────────────────────

    const serverFileMap = new Map(allServerFiles.map((f) => [f.fieldName, f]));
    const totalPacks = packs.length;
    let lastManifestVersion = 0;

    for (let packIndex = 0; packIndex < totalPacks; packIndex++) {
      const pack = packs[packIndex];
      setPublishState({
        status: "publishing",
        progress: 50 + Math.round((packIndex / totalPacks) * 50),
        message: `Building and uploading pack ${packIndex + 1}/${totalPacks} (${pack.id})…`,
      });

      const fileEntries = pack.files
        .map((lf) => {
          const serverFile = serverFileMap.get(lf.relativePath);
          const packPath = canonicalPackPath(lf.relativePath, lf.detectedType);
          const rawAlbum = extractAlbumName(lf.relativePath);
          const albumName = rawAlbum && !isHinario(rawAlbum) ? rawAlbum : undefined;
          return {
            localPath: serverFile?.localPath ?? "",
            packPath,
            fileType: lf.detectedType as "audio" | "playback" | "cover" | "album_cover",
            size: lf.size,
            ...(albumName ? { albumName } : {}),
          };
        })
        .filter((f) => f.localPath !== "");

      const isLastPack = packIndex === totalPacks - 1;
      const [publishRes, publishFetchErr] = await catcher(
        fetch("/api/packs/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packs: [{ packId: pack.id, version: 1, files: fileEntries }],
            finalizeManifest: isLastPack,
            // Pass the in-memory manifest so the server skips its own R2 fetch.
            currentManifest: workingManifest,
            language,
            // On the last pack, pass dbUrl/dbVersion if the DB was uploaded
            // with updateManifest=false (Case A: packs + db together).
            ...(isLastPack && pendingDbUrl
              ? { dbUrl: pendingDbUrl, dbVersion: pendingDbVersion }
              : {}),
          }),
        }),
      );
      if (publishFetchErr) { fail(publishFetchErr.message); return; }
      if (!publishRes.ok) {
        const body = (await publishRes.json()) as { error?: string };
        fail(body.error ?? `Publish failed for ${pack.id}`); return;
      }

      const [publishData, publishParseErr] = await catcher(
        publishRes.json() as Promise<{ manifestVersion: number; manifest: ContentManifest }>,
      );
      if (publishParseErr) { fail(publishParseErr.message); return; }

      // Keep the working manifest up to date so the next pack call builds on it.
      if (publishData.manifest) workingManifest = publishData.manifest;
      lastManifestVersion = publishData.manifestVersion;
    }

    setPublishState({
      status: "done",
      progress: 100,
      message: `Published ${packs.length} pack(s) successfully!`,
      manifestVersion: lastManifestVersion,
      dbUploadMessage,
    });
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

            <div className="space-y-2">
              <Label htmlFor="language">
                Language <span className="text-destructive">*</span>
              </Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="" disabled>Select a language…</option>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="es">Español</option>
                <option value="en-US">English (US)</option>
              </select>
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
              {dbFiles.length > 0 && (
                <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
                  {dbFiles.length} database file{dbFiles.length !== 1 ? "s" : ""} detected at root — will be uploaded automatically:{" "}
                  {dbFiles.map((f) => f.file.name).join(", ")}
                </div>
              )}
              {packs.length === 0 && unknownFiles.length === 0 && dbFiles.length === 0 && (
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
              disabled={!language || (packs.length === 0 && dbFiles.length === 0)}
            >
              Publish {packs.length} Pack{packs.length !== 1 ? "s" : ""}
              {dbFiles.length > 0 ? ` + ${dbFiles.length} DB` : ""} →
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
              <div className="space-y-2">
                {publishState.dbUploadMessage && (
                  <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-400">
                    {publishState.dbUploadMessage}
                  </div>
                )}
                <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                  Manifest updated to v{publishState.manifestVersion}. The Tauri
                  app will pick up the new packs on next launch.
                </div>
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
