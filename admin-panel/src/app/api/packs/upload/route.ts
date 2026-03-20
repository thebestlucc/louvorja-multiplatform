import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionId = randomUUID();
    const sessionDir = join(tmpdir(), "louvorja-packs", sessionId);
    await mkdir(sessionDir, { recursive: true });

    const results: Array<{
      fieldName: string;
      originalName: string;
      localPath: string;
      packPath: string;
      size: number;
    }> = [];

    for (const [fieldName, value] of formData.entries()) {
      if (value instanceof File) {
        const file = value as File;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        // fieldName is the relative path within the folder (e.g. "media/audio/123/song.mp3")
        const relPath = fieldName;
        const destPath = join(sessionDir, relPath);
        await mkdir(join(destPath, ".."), { recursive: true });
        await writeFile(destPath, buffer);
        results.push({
          fieldName,
          originalName: file.name,
          localPath: destPath,
          packPath: relPath,
          size: buffer.length,
        });
      }
    }

    return NextResponse.json({ sessionId, sessionDir, files: results });
  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
