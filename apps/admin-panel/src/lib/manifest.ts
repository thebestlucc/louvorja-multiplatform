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
  language: string; // BCP 47 tag, e.g. "pt-BR"
}

export interface DbEntry {
  url: string;
  version: number;
}

export interface ContentManifest {
  manifestVersion: number;
  generatedAt: string;
  packs: ManifestPack[];
  // dbUrl and dbVersion are REMOVED — replaced by databases
  databases: Record<string, DbEntry>; // keyed by BCP 47 tag
}

const MANIFEST_KEY = "manifest.json";

export async function fetchManifest(): Promise<ContentManifest | null> {
  const { downloadFromR2, existsOnR2 } = await import("./r2");
  if (!(await existsOnR2(MANIFEST_KEY))) return null;
  const buf = await downloadFromR2(MANIFEST_KEY);
  const raw = JSON.parse(buf.toString("utf-8")) as ContentManifest;
  // Back-compat: if old manifest has no databases field, default to empty
  return { ...raw, databases: raw.databases ?? {} };
}

export async function uploadManifest(
  manifest: ContentManifest,
): Promise<void> {
  const { uploadToR2 } = await import("./r2");
  const json = JSON.stringify(manifest, null, 2);
  await uploadToR2(MANIFEST_KEY, Buffer.from(json), "application/json");
}

export function incrementManifestVersion(
  manifest: ContentManifest | null,
): ContentManifest {
  return {
    manifestVersion: (manifest?.manifestVersion ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    packs: manifest?.packs ?? [],
    databases: manifest?.databases ?? {},
  };
}
