import archiver from "archiver";
import { createHash } from "crypto";
import { createWriteStream, createReadStream } from "fs";
import { Transform } from "stream";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export interface FileEntry {
  localPath: string;
  packPath: string;
  fileType: "audio" | "playback" | "cover" | "album_cover";
  size: number;
  albumName?: string;
}

export interface PackGroup {
  id: string;
  files: FileEntry[];
  totalSize: number;
}

const MAX_PACK_SIZE = 500 * 1000 * 1000; // 500 MB decimal — matches display units and stays under Cloudflare's 512 MB CDN cache limit

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

class HashPassThrough extends Transform {
  private hasher = createHash("sha256");
  private _byteCount = 0;

  _transform(chunk: Buffer, _enc: string, cb: () => void) {
    this.hasher.update(chunk);
    this._byteCount += chunk.length;
    this.push(chunk);
    cb();
  }

  digest() {
    return this.hasher.digest("hex");
  }

  get byteCount() {
    return this._byteCount;
  }
}

/**
 * Build a STORED ZIP, stream it to a temp file (never held fully in RAM),
 * hash it on the fly, and return the temp path + SHA-256 + byte size.
 * Caller is responsible for deleting the temp file after use.
 */
export async function createPackZip(
  files: FileEntry[],
): Promise<{ tempPath: string; sha256: string; size: number }> {
  const tempPath = join(tmpdir(), `louvorja-pack-${randomUUID()}.zip`);

  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(tempPath);
    const hashPassthrough = new HashPassThrough();
    const archive = archiver("zip", { store: true });

    archive.on("error", reject);
    writeStream.on("error", reject);
    hashPassthrough.on("error", reject);

    archive.pipe(hashPassthrough).pipe(writeStream);

    for (const file of files) {
      archive.file(file.localPath, { name: file.packPath });
    }

    writeStream.on("finish", () => {
      resolve({
        tempPath,
        sha256: hashPassthrough.digest(),
        size: hashPassthrough.byteCount,
      });
    });

    archive.finalize();
  });
}

export function openPackReadStream(tempPath: string) {
  return createReadStream(tempPath);
}
