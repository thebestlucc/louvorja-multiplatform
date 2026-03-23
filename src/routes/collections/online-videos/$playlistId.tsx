import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/collections/online-videos/$playlistId")({
  component: PlaylistDetail,
});

function PlaylistDetail() {
  const { playlistId } = Route.useParams();
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Playlist: {playlistId}</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Coming soon — video list will be here.
      </p>
    </div>
  );
}
