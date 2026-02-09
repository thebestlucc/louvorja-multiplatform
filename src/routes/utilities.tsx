import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/utilities")({
  component: UtilitiesPage,
});

function UtilitiesPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Utilities — coming soon</p>
    </div>
  );
}
