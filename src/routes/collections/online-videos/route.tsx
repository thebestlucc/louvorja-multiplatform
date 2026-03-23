import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/collections/online-videos")({
  component: OnlineVideosLayout,
});

function OnlineVideosLayout() {
  return <Outlet />;
}
