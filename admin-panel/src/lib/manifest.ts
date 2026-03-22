export interface ManifestFile {
  path: string;
  type: "audio" | "playback" | "cover" | "album_cover";
  size: number;
  albumName?: string;
}

export interface ManifestPack {
  id: string;
  url: string;
  version: number;
  size: number;
  sha256: string;
  files: ManifestFile[];
}

export interface ContentManifest {
  manifestVersion: number;
  generatedAt: string;
  packs: ManifestPack[];
  dbUrl?: string;
  dbVersion?: number;
}

const MANIFEST_KEY = "manifest.json";

export async function fetchManifest(): Promise<ContentManifest | null> {
  const { downloadFromR2, existsOnR2 } = await import("./r2");
  if (!(await existsOnR2(MANIFEST_KEY))) return null;
  const buf = await downloadFromR2(MANIFEST_KEY);
  return JSON.parse(buf.toString("utf-8")) as ContentManifest;
}

export async function uploadManifest(manifest: ContentManifest): Promise<void> {
  const { uploadToR2 } = await import("./r2");
  const json = JSON.stringify(manifest, null, 2);
  await uploadToR2(MANIFEST_KEY, Buffer.from(json), "application/json");
}

export function incrementManifestVersion(manifest: ContentManifest | null): ContentManifest {
  return {
    manifestVersion: (manifest?.manifestVersion ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    packs: manifest?.packs ?? [],
  };
}
