import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/utilities/media-library")({
  component: MediaLibraryPage,
});

function MediaLibraryPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("utilities.mediaLibrary.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("utilities.mediaLibrary.description")}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          Media Library Manager coming soon in Task 5...
        </p>
      </div>
    </div>
  );
}
