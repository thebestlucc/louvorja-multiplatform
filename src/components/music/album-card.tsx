import { Music } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/card";
import type { Album } from "../../lib/bindings";

interface AlbumCardProps {
  album: Album;
  onClick: (albumName: string) => void;
}

export function AlbumCard({ album, onClick }: AlbumCardProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-surface-hover"
      onClick={() => onClick(album.name)}
    >
      <CardHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent">
            <Music className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{album.name}</CardTitle>
            <CardDescription className="text-xs">
              {album.hymnCount} {album.hymnCount === 1 ? "hymn" : "hymns"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
