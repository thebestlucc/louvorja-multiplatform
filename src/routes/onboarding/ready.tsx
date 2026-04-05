import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Music, BookOpen, LayoutGrid, Search, Monitor, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { FeatureCard } from "../../components/onboarding/feature-card";
import { catcher } from "../../lib/catcher";
import { completeOnboarding, invalidateOnboardingCache } from "../../lib/onboarding";
import { setSetting } from "../../lib/tauri";
import { useOnboardingStore } from "../../stores/onboarding-store";

export const Route = createFileRoute("/onboarding/ready")({
  component: OnboardingReadyPage,
});

function OnboardingReadyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { churchName, tourRequested, setTourRequested, reset } = useOnboardingStore();

  const handleFinish = async () => {
    setSaving(true);
    setError(null);

    // Persist church name if provided
    if (churchName.trim()) {
      await catcher(setSetting("church.name", churchName.trim()), { notify: false });
    }

    const [_, err] = await catcher(completeOnboarding());
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    invalidateOnboardingCache();
    const shouldTour = tourRequested;
    reset();
    setSaving(false);

    // Store tour flag in sessionStorage (avoids TanStack Router search schema issues)
    if (shouldTour) {
      sessionStorage.setItem("louvorja.startTour", "true");
    }
    navigate({ to: "/" });
  };

  const features = [
    { icon: Music, titleKey: "onboarding.ready.features.hymns", descKey: "onboarding.ready.features.hymnsDesc" },
    { icon: BookOpen, titleKey: "onboarding.ready.features.bible", descKey: "onboarding.ready.features.bibleDesc" },
    { icon: LayoutGrid, titleKey: "onboarding.ready.features.presentations", descKey: "onboarding.ready.features.presentationsDesc" },
    { icon: Search, titleKey: "onboarding.ready.features.search", descKey: "onboarding.ready.features.searchDesc" },
    { icon: Monitor, titleKey: "onboarding.ready.features.projection", descKey: "onboarding.ready.features.projectionDesc" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-foreground">{t("onboarding.ready.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("onboarding.ready.subtitle")}</p>
      </div>

      {/* 3-top + 2-bottom grid */}
      <div className="grid gap-3 sm:grid-cols-3">
        {features.slice(0, 3).map((f) => (
          <FeatureCard key={f.titleKey} icon={f.icon} title={t(f.titleKey)} description={t(f.descKey)} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 max-w-lg mx-auto w-full">
        {features.slice(3).map((f) => (
          <FeatureCard key={f.titleKey} icon={f.icon} title={t(f.titleKey)} description={t(f.descKey)} />
        ))}
      </div>

      {/* Tour checkbox */}
      <label className="flex items-center gap-2 justify-center cursor-pointer">
        <input
          type="checkbox"
          checked={tourRequested}
          onChange={(e) => setTourRequested(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-sm text-muted-foreground">{t("onboarding.ready.tourCheckbox")}</span>
      </label>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-center text-destructive-foreground">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate({ to: "/onboarding/monitors" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Button>
        <Button size="lg" onClick={() => void handleFinish()} disabled={saving}>
          {t("onboarding.ready.finish")}
        </Button>
      </div>
    </div>
  );
}
