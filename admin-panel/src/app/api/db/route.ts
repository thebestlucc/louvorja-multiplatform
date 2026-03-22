import { NextRequest, NextResponse } from "next/server";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import Busboy from "busboy";
import { getCdnUrl } from "@/lib/r2";
import { fetchManifest, uploadManifest, incrementManifestVersion } from "@/lib/manifest";

export const runtime = "nodejs";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const DB_KEY = "database.db";

// SQLite magic bytes: "SQLite format 3\000" (first 16 bytes)
const SQLITE_MAGIC = Buffer.from("SQLite format 3\x00");

function isSqliteFile(buffer: Buffer): boolean {
  if (buffer.length < 16) return false;
  return buffer.subarray(0, 16).equals(SQLITE_MAGIC);
}

export async function GET() {
  try {
    const head = await r2.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: DB_KEY }),
    );

    const uploadedAt =
      (head.Metadata?.["uploaded-at"]) ??
      head.LastModified?.toISOString() ??
      null;

    return NextResponse.json({
      exists: true,
      size: head.ContentLength ?? 0,
      uploadedAt,
      url: getCdnUrl(DB_KEY),
    });
  } catch (err: unknown) {
    // HeadObject throws when the object does not exist (NoSuchKey / 404)
    const code =
      err instanceof Error && "name" in err ? (err as { name?: string }).name : null;
    const status =
      err instanceof Error && "$metadata" in err
        ? ((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 0)
        : 0;

    if (code === "NotFound" || status === 404 || status === 403) {
      return NextResponse.json({ exists: false });
    }

    console.error("[db/GET] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const bb = Busboy({ headers: Object.fromEntries(req.headers.entries()) });
    const chunks: Buffer[] = [];
    let gotFile = false;
    let updateManifestField = "true"; // default: update manifest

    await new Promise<void>((resolve, reject) => {
      bb.on("field", (name, value) => {
        if (name === "updateManifest") updateManifestField = value;
      });
      bb.on("file", (_fieldName, fileStream) => {
        gotFile = true;
        fileStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        fileStream.on("error", reject);
      });
      bb.on("finish", resolve);
      bb.on("error", reject);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Readable.fromWeb(req.body as any).pipe(bb);
    });

    const shouldUpdateManifest = updateManifestField !== "false";

    if (!gotFile || chunks.length === 0) {
      return NextResponse.json(
        { error: "No file received. Send a multipart field named 'db'." },
        { status: 400 },
      );
    }

    const fileBuffer: Buffer = Buffer.concat(chunks);

    if (!isSqliteFile(fileBuffer)) {
      return NextResponse.json(
        { error: "Invalid file: not a SQLite database (magic bytes mismatch)." },
        { status: 400 },
      );
    }

    const uploadedAt = new Date().toISOString();
    const size = fileBuffer.length;

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: DB_KEY,
        Body: fileBuffer,
        ContentType: "application/octet-stream",
        ContentLength: size,
        Metadata: { "uploaded-at": uploadedAt },
      }),
    );

    // Update manifest to include dbUrl + dbVersion so Tauri clients
    // can detect and download the new legacy DB during pack sync.
    // When updateManifest=false, skip the manifest step — the caller will
    // include dbUrl/dbVersion in a later pack-publish call instead.
    const dbCdnUrl = getCdnUrl(DB_KEY);
    const dbVersion = Date.now();
    if (shouldUpdateManifest) {
      try {
        const existing = await fetchManifest();
        const manifest = incrementManifestVersion(existing);
        manifest.dbUrl = dbCdnUrl;
        manifest.dbVersion = dbVersion;
        await uploadManifest(manifest);
      } catch (manifestErr) {
        // Non-fatal: DB was uploaded successfully; manifest update failure
        // is logged but does not fail the request.
        console.error("[db/POST] Failed to update manifest after DB upload:", manifestErr);
      }
    }

    return NextResponse.json({
      success: true,
      size,
      uploadedAt,
      url: dbCdnUrl,
      dbVersion,
    });
  } catch (error) {
    console.error("[db/POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
