import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Services — coming soon</p>
    </div>
  );
}
