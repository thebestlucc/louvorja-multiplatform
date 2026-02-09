import { Link } from "@tanstack/react-router";
import { Badge } from "../ui/badge";
import { Card, CardHeader } from "../ui/card";
import type { Hymn } from "../../types/hymn";

interface HymnCardProps {
  hymn: Hymn;
}

export function HymnCard({ hymn }: HymnCardProps) {
  return (
    <Link to="/hymnal/$hymnId" params={{ hymnId: String(hymn.id) }}>
      <Card className="cursor-pointer transition-colors hover:bg-surface-hover">
        <CardHeader className="p-4">
          <div className="flex items-center gap-3">
            {hymn.number != null && (
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {hymn.number}
              </Badge>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{hymn.title}</p>
              {hymn.album && (
                <p className="truncate text-xs text-muted-foreground">{hymn.album}</p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
