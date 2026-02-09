import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/hymnal")({
  component: HymnalLayout,
});

function HymnalLayout() {
  return <Outlet />;
}
