import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { HymnSearch } from "../../components/music/hymn-search";

export const Route = createFileRoute("/hymnal/")({
  component: HymnalIndex,
});

function HymnalIndex() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.hymnal")}</h1>
      </div>

      <HymnSearch />
    </div>
  );
}
