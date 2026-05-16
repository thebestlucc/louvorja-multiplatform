"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentManifest } from "@/lib/manifest";

export default function HomePage() {
  const [manifest, setManifest] = useState<ContentManifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/manifest")
      .then((r) => r.json())
      .then((data: ContentManifest) => setManifest(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LouvorJA CDN Admin</h1>
          {manifest && (
            <p className="text-sm text-muted-foreground">
              Manifest v{manifest.manifestVersion} · {manifest.packs.length} pack(s)
            </p>
          )}
        </div>
        <Link href="/packs/new">
          <Button>New Pack</Button>
        </Link>
      </div>

      {loading && <p className="text-muted-foreground">Loading…</p>}

      {!loading && manifest && manifest.packs.length === 0 && (
        <p className="text-muted-foreground">No packs yet. Create your first pack.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manifest?.packs.map((pack) => (
          <Card key={pack.id}>
            <CardHeader>
              <CardTitle className="text-base">{pack.id}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div>Version: {pack.version}</div>
              <div>Files: {pack.files.length}</div>
              <div>Size: {(pack.size / 1024 / 1024).toFixed(1)} MB</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
