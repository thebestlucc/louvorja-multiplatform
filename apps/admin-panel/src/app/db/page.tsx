"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { catcher } from "@/lib/catcher";

interface DbInfo {
  exists: boolean;
  size?: number;
  uploadedAt?: string;
  url?: string;
}

interface UploadResult {
  success: boolean;
  size: number;
  uploadedAt: string;
  url: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function DatabasePage() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(undefined!);

  async function loadInfo() {
    setLoading(true);
    const [data, err] = await catcher(
      fetch("/api/db").then((r) => r.json() as Promise<DbInfo>),
    );
    if (!err && data) setInfo(data);
    setLoading(false);
  }

  useEffect(() => {
    loadInfo();
  }, []);

  async function handleUpload() {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("db", selectedFile);

    const [result, err] = await catcher(
      fetch("/api/db", { method: "POST", body: formData }).then(async (r) => {
        const json = await r.json() as UploadResult & { error?: string };
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
        return json;
      }),
    );

    setUploading(false);

    if (err) {
      setUploadError(err.message);
      return;
    }

    if (result) {
      setUploadSuccess(true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Refresh info from the upload result directly
      setInfo({
        exists: true,
        size: result.size,
        uploadedAt: result.uploadedAt,
        url: result.url,
      });
    }
  }

  return (
    <main className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Database File</h1>
          <p className="text-sm text-muted-foreground">
            Upload the SQLite seed database that fresh Tauri installs download on first sync.
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">← Back to Packs</Button>
        </Link>
      </div>

      {/* Current status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Current Database</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {loading && <p className="text-muted-foreground">Loading…</p>}

          {!loading && info && !info.exists && (
            <p className="text-muted-foreground">No database file uploaded yet.</p>
          )}

          {!loading && info?.exists && (
            <div className="space-y-1">
              <div>
                <span className="font-medium">Size:</span>{" "}
                {info.size !== undefined ? formatBytes(info.size) : "—"}
              </div>
              {info.uploadedAt && (
                <div>
                  <span className="font-medium">Last updated:</span>{" "}
                  {formatDate(info.uploadedAt)}
                </div>
              )}
              {info.url && (
                <div>
                  <span className="font-medium">CDN URL:</span>{" "}
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline break-all"
                  >
                    {info.url}
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload New Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="db-file" className="text-sm font-medium">
              SQLite file (.db)
            </label>
            <input
              id="db-file"
              ref={fileInputRef}
              type="file"
              accept=".db"
              className="block w-full text-sm text-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                setUploadError(null);
                setUploadSuccess(false);
              }}
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                {selectedFile.name} — {formatBytes(selectedFile.size)}
              </p>
            )}
          </div>

          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}

          {uploadSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Database uploaded successfully.
            </p>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Uploading…" : "Upload Database"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
