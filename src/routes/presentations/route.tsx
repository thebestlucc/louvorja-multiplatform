import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/presentations")({
  component: PresentationsLayout,
});

function PresentationsLayout() {
  return <Outlet />;
}
