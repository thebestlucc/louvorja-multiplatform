import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/collections/online-videos/")({
  component: OnlineVideosIndex,
});

function OnlineVideosIndex() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">{t("nav.onlineVideos")}</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Coming soon — playlist management will be here.
      </p>
    </div>
  );
}
