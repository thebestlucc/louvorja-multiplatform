import archiver from "archiver";
import { createHash } from "crypto";
import { Writable } from "stream";

export interface FileEntry {
  localPath: string;
  packPath: string;
  hymnApiId: number | null;
  albumApiId: number | null;
  fileType: "audio" | "playback" | "cover" | "album_cover";
  size: number;
}

export interface PackGroup {
  id: string;
  files: FileEntry[];
  totalSize: number;
}

const MAX_PACK_SIZE = 500 * 1024 * 1024; // 500 MB

/** Greedy bin-packing: sort files by size desc, fill packs up to MAX_PACK_SIZE. */
export function groupIntoPacks(files: FileEntry[], packIdPrefix: string): PackGroup[] {
  const sorted = [...files].sort((a, b) => b.size - a.size);
  const packs: PackGroup[] = [];
  let currentPack: PackGroup | null = null;
  let packIndex = 1;

  for (const file of sorted) {
    if (!currentPack || currentPack.totalSize + file.size > MAX_PACK_SIZE) {
      currentPack = {
        id: `${packIdPrefix}-${String(packIndex).padStart(3, "0")}`,
        files: [],
        totalSize: 0,
      };
      packs.push(currentPack);
      packIndex++;
    }
    currentPack.files.push(file);
    currentPack.totalSize += file.size;
  }

  return packs;
}

/** Create a STORED (no compression) ZIP and return the buffer + SHA-256. */
export async function createPackZip(files: FileEntry[]): Promise<{ buffer: Buffer; sha256: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiver("zip", { store: true });
    archive.on("error", reject);
    archive.pipe(writable);

    for (const file of files) {
      archive.file(file.localPath, { name: file.packPath });
    }

    writable.on("finish", () => {
      const buffer = Buffer.concat(chunks);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      resolve({ buffer, sha256 });
    });

    archive.finalize();
  });
}
