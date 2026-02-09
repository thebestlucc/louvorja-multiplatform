import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Settings — coming soon</p>
    </div>
  );
}
