import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/utilities/")({
  component: () => <Navigate to="/utilities/timer" replace />,
});
