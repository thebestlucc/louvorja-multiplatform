import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { createPackZip, openPackReadStream, type FileEntry } from "@/lib/pack-builder";
import { uploadToR2, deleteFromR2, existsOnR2, getCdnUrl } from "@/lib/r2";
import { fetchManifest, uploadManifest, incrementManifestVersion, type ContentManifest, type ManifestPack, type ManifestFile } from "@/lib/manifest";

interface PublishPackRequest {
  packId: string;
  version: number;
  files: FileEntry[];
}

interface PublishRequest {
  packs: PublishPackRequest[];
  /** BCP 47 language tag for the packs being published (e.g. "pt-BR"). */
  language: string;
  /** When true, increment manifest version and save. Only set on the last pack. */
  finalizeManifest?: boolean;
  /** CDN URL of the database file to embed in the manifest (passed when the DB
   *  was uploaded with updateManifest=false, so a single manifest version is
   *  created containing both packs and the DB reference). */
  dbUrl?: string;
  /** Timestamp version of the database file, matching what /api/db returned. */
  dbVersion?: number;
  /** In-memory manifest passed from the frontend to avoid redundant R2 reads.
   *  When provided, skips fetchManifest(). Falls back to fetchManifest() when absent
   *  for backward compatibility. */
  currentManifest?: ContentManifest;
}

export async function POST(req: NextRequest) {
  try {
    const body: PublishRequest = await req.json() as PublishRequest;
    const { finalizeManifest = true, dbUrl, dbVersion, language } = body;
    // Use the manifest passed by the caller when available; fall back to fetching
    // from R2 for backward compatibility (e.g. direct API calls without a frontend).
    const manifest: ContentManifest | null = body.currentManifest ?? await fetchManifest();
    const base: ContentManifest = manifest ?? {
      manifestVersion: 0,
      generatedAt: new Date().toISOString(),
      packs: [],
      databases: {},
    };
    const updated = finalizeManifest
      ? incrementManifestVersion(manifest)
      : { ...base };

    // When the caller passes dbUrl/dbVersion (Case A: packs + db in the same
    // folder), embed them in this manifest version so a single version contains
    // both the packs and the DB reference, keyed by the pack language.
    if (finalizeManifest && dbUrl && dbVersion != null) {
      updated.databases ??= {};
      updated.databases[language] = {
        url: dbUrl,
        version: dbVersion,
      };
    }

    for (const pack of body.packs) {
      const { tempPath, sha256, size } = await createPackZip(pack.files);
      const zipKey = `packs/${pack.packId}-v${pack.version}.zip`;

      try {
        await uploadToR2(zipKey, openPackReadStream(tempPath), "application/zip", size);
      } finally {
        await unlink(tempPath).catch(() => {});
      }

      // N-2 cleanup
      const nMinus2Version = pack.version - 2;
      if (nMinus2Version >= 1) {
        const oldKey = `packs/${pack.packId}-v${nMinus2Version}.zip`;
        if (await existsOnR2(oldKey)) {
          await deleteFromR2(oldKey);
        }
      }

      const manifestFiles: ManifestFile[] = pack.files.map((f) => ({
        path: f.packPath,
        type: f.fileType,
        size: f.size,
        ...(f.albumName ? { albumName: f.albumName } : {}),
      }));

      const manifestPack: ManifestPack = {
        id: pack.packId,
        url: getCdnUrl(zipKey),
        version: pack.version,
        size,
        sha256,
        files: manifestFiles,
        language,
      };

      const idx = updated.packs.findIndex((p) => p.id === pack.packId);
      if (idx >= 0) {
        updated.packs[idx] = manifestPack;
      } else {
        updated.packs.push(manifestPack);
      }
    }

    if (finalizeManifest) {
      await uploadManifest(updated);
    }
    return NextResponse.json({ success: true, manifestVersion: updated.manifestVersion, manifest: updated });
  } catch (error) {
    console.error("[publish] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
