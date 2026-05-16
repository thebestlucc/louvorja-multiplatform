import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { HymnSearch } from "../../components/music/hymn-search";
import { useRouteTour } from "../../hooks/use-route-tour";
import { SpotlightTour } from "../../components/tour/spotlight-tour";

export const Route = createFileRoute("/hymnal/")({
  component: HymnalIndex,
});

function HymnalIndex() {
  const { t } = useTranslation();
  const { showTour, steps, handleComplete, handleSkip } = useRouteTour("/hymnal");

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.hymnal")}</h1>
      </div>

      <div data-tour="hymnal-list" className="min-h-0 flex-1">
        <HymnSearch />
      </div>

      {showTour && steps.length > 0 && (
        <SpotlightTour steps={steps} onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </div>
  );
}
