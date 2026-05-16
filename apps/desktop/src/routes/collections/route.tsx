import { Outlet, createFileRoute } from "@tanstack/react-router";

type CollectionsSearch = {
  tab?: "online-videos" | "custom";
  playlist?: string;
};

export const Route = createFileRoute("/collections")({
  component: CollectionsLayout,
  validateSearch: (search: Record<string, unknown>): CollectionsSearch => ({
    tab: search.tab === "online-videos" ? "online-videos" : search.tab === "custom" ? "custom" : undefined,
    playlist: typeof search.playlist === "string" ? search.playlist : undefined,
  }),
});

function CollectionsLayout() {
  return <Outlet />;
}
