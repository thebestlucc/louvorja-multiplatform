"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewPackPage() {
  return (
    <main className="container mx-auto p-6">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/"><Button variant="ghost">← Back</Button></Link>
        <h1 className="text-xl font-bold">New Pack</h1>
      </div>
      <p className="text-muted-foreground">
        Pack creation UI coming soon. Use the publish API directly for now.
      </p>
    </main>
  );
}
