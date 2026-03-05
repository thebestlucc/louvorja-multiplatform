import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleCheckBig } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { catcher } from "../../lib/catcher";
import { completeOnboarding, invalidateOnboardingCache } from "../../lib/onboarding";
import { useOnboardingStore } from "../../stores/onboarding-store";

export const Route = createFileRoute("/onboarding/complete")({
  component: OnboardingCompletePage,
});

function OnboardingCompletePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = useOnboardingStore((state) => state.reset);

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    const [_, err] = await catcher(completeOnboarding());
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    invalidateOnboardingCache();
    reset();
    setSaving(false);
    navigate({ to: "/" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleCheckBig className="h-4 w-4 text-green-500" />
          {t("onboarding.complete.title")}
        </CardTitle>
        <CardDescription>{t("onboarding.complete.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("onboarding.complete.freshSummary")}
        </p>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleFinish()} disabled={saving}>
            {t("onboarding.complete.finish")}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/help" })}>
            {t("onboarding.complete.openHelp")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
