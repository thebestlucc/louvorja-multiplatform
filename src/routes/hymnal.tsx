import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/hymnal")({
  component: HymnalPage,
});

function HymnalPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Hymnal — coming soon</p>
    </div>
  );
}
