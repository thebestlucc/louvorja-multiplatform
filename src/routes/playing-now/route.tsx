import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/playing-now")({
  component: () => <Outlet />,
});
