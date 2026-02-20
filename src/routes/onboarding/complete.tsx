import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleCheckBig } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { completeOnboarding, invalidateOnboardingCache } from "../../lib/onboarding";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { useMigrationStore } from "../../stores/migration-store";

export const Route = createFileRoute("/onboarding/complete")({
  component: OnboardingCompletePage,
});

function OnboardingCompletePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = useOnboardingStore((state) => state.mode);
  const report = useMigrationStore((state) => state.report);
  const reset = useOnboardingStore((state) => state.reset);

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding();
      invalidateOnboardingCache();
      reset();
      navigate({ to: "/" });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
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
          {mode === "import"
            ? t("onboarding.complete.importSummary")
            : t("onboarding.complete.freshSummary")}
        </p>

        {report ? (
          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            <p>{t("onboarding.complete.reportStatus", { status: report.status })}</p>
            <p>{t("onboarding.complete.reportDomains", { count: report.domains.length })}</p>
            <p>{t("onboarding.complete.reportErrors", { count: report.errors.length })}</p>
          </div>
        ) : null}

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
