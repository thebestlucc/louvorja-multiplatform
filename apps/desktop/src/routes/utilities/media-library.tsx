import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MediaLibraryManager } from "../../components/media/media-library-manager";

export const Route = createFileRoute("/utilities/media-library")({
  component: MediaLibraryPage,
});

function MediaLibraryPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("utilities.mediaLibrary.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("utilities.mediaLibrary.description")}
          </p>
        </div>
      </div>

      <MediaLibraryManager />
    </div>
  );
}
