import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bible")({
  component: BibleLayout,
});

function BibleLayout() {
  return <Outlet />;
}
