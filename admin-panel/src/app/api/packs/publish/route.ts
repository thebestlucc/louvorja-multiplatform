import { NextRequest, NextResponse } from "next/server";
import { createPackZip, type FileEntry } from "@/lib/pack-builder";
import { uploadToR2, deleteFromR2, existsOnR2, getCdnUrl } from "@/lib/r2";
import { fetchManifest, uploadManifest, incrementManifestVersion, type ManifestPack, type ManifestFile } from "@/lib/manifest";

interface PublishPackRequest {
  packId: string;
  version: number;
  files: FileEntry[];
}

interface PublishRequest {
  packs: PublishPackRequest[];
}

export async function POST(req: NextRequest) {
  try {
    const body: PublishRequest = await req.json() as PublishRequest;
    const manifest = await fetchManifest();
    const updated = incrementManifestVersion(manifest);

    for (const pack of body.packs) {
      const { buffer, sha256 } = await createPackZip(pack.files);
      const zipKey = `packs/${pack.packId}-v${pack.version}.zip`;

      await uploadToR2(zipKey, buffer, "application/zip");

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
        hymnApiId: f.hymnApiId,
        albumApiId: f.albumApiId,
        type: f.fileType,
        size: f.size,
      }));

      const manifestPack: ManifestPack = {
        id: pack.packId,
        url: getCdnUrl(zipKey),
        version: pack.version,
        size: buffer.length,
        sha256,
        files: manifestFiles,
      };

      const idx = updated.packs.findIndex((p) => p.id === pack.packId);
      if (idx >= 0) {
        updated.packs[idx] = manifestPack;
      } else {
        updated.packs.push(manifestPack);
      }
    }

    await uploadManifest(updated);
    return NextResponse.json({ success: true, manifestVersion: updated.manifestVersion });
  } catch (error) {
    console.error("[publish] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
