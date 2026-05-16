import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "fs/promises";
import { createWriteStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import Busboy from "busboy";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const existingSessionId = url.searchParams.get("sessionId");
    const sessionId = existingSessionId ?? randomUUID();
    const sessionDir = join(tmpdir(), "louvorja-packs", sessionId);
    await mkdir(sessionDir, { recursive: true });

    const results: Array<{
      fieldName: string;
      originalName: string;
      localPath: string;
      packPath: string;
      size: number;
    }> = [];

    const bb = Busboy({ headers: Object.fromEntries(req.headers.entries()) });
    const pendingFiles: Promise<void>[] = [];

    // _paths is a JSON field sent before all files:
    // { "0": "folder/audio/1/song.mp3", "1": "folder/audio/2/song.mp3", ... }
    // Using this avoids encoding issues when non-ASCII paths travel through
    // Content-Disposition headers as field names or filenames.
    let pathMap: Record<string, string> = {};

    bb.on("field", (fieldName, value) => {
      if (fieldName === "_paths") {
        try { pathMap = JSON.parse(value) as Record<string, string>; } catch {}
      }
    });

    bb.on("file", (fieldName, fileStream, { filename }) => {
      const p = (async () => {
        // fieldName is "f0", "f1", … — look up original path from pathMap.
        const idx = fieldName.startsWith("f") ? fieldName.slice(1) : fieldName;
        const relPath = pathMap[idx] ?? filename ?? fieldName;
        const destPath = join(sessionDir, relPath);
        await mkdir(join(destPath, ".."), { recursive: true });

        let size = 0;
        const writeStream = createWriteStream(destPath);

        await new Promise<void>((res, rej) => {
          fileStream.on("data", (chunk: Buffer) => {
            size += chunk.length;
          });
          fileStream.pipe(writeStream);
          writeStream.on("finish", res);
          writeStream.on("error", rej);
          fileStream.on("error", rej);
        });

        results.push({
          fieldName: relPath,   // return relPath so client can match by relativePath
          originalName: filename ?? relPath.split("/").pop() ?? relPath,
          localPath: destPath,
          packPath: relPath,
          size,
        });
      })();
      pendingFiles.push(p);
    });

    await new Promise<void>((resolve, reject) => {
      bb.on("finish", () => {
        Promise.all(pendingFiles).then(() => resolve()).catch(reject);
      });
      bb.on("error", reject);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Readable.fromWeb(req.body as any).pipe(bb);
    });

    return NextResponse.json({ sessionId, sessionDir, files: results });
  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
