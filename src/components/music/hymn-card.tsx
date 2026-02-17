import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardHeader } from "../ui/card";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAddServiceItem } from "../../lib/queries";
import type { Hymn } from "../../types/hymn";
import { CoverImage } from "../media/cover-image";

interface HymnCardProps {
  hymn: Hymn;
}

export function HymnCard({ hymn }: HymnCardProps) {
  const { t } = useTranslation();
  const activeServiceId = usePresentationStore((s) => s.activeServiceId);
  const addItemMutation = useAddServiceItem();

  const handleAddToService = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeServiceId) {
      addItemMutation.mutate({
        serviceId: activeServiceId,
        itemType: "hymn",
        title: hymn.title,
        itemId: hymn.id,
        notes: null,
      });
    }
  };

  return (
    <Link to="/hymnal/$hymnId" params={{ hymnId: String(hymn.id) }}>
      <Card className="cursor-pointer transition-colors hover:bg-surface-hover">
        <CardHeader className="p-4">
          <div className="flex items-center gap-3">
            <CoverImage
              path={hymn.cover_path}
              title={hymn.title}
              className="h-10 w-10"
            />
            {hymn.number != null && (
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {hymn.number}
              </Badge>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{hymn.title}</p>
              {hymn.album && (
                <p className="truncate text-xs text-muted-foreground">{hymn.album}</p>
              )}
            </div>
            {activeServiceId && (
              <button
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                onClick={handleAddToService}
                title={t("services.addToService")}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
