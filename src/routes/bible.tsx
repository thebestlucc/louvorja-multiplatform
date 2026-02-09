import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/bible")({
  component: BiblePage,
});

function BiblePage() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Bible — coming soon</p>
    </div>
  );
}
