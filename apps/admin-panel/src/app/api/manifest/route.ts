import { NextResponse } from "next/server";
import { fetchManifest } from "@/lib/manifest";

export async function GET() {
  const manifest = await fetchManifest();
  return NextResponse.json(manifest ?? { manifestVersion: 0, generatedAt: null, packs: [] });
}
