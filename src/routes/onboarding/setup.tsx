import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ThemePicker } from "../../components/onboarding/theme-picker";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { useThemeStore } from "../../stores/theme-store";
import type { Theme } from "../../lib/constants";

export const Route = createFileRoute("/onboarding/setup")({
  component: OnboardingSetupPage,
});

function OnboardingSetupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { churchName, setChurchName } = useOnboardingStore();
  const { theme, setTheme } = useThemeStore();

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    useOnboardingStore.getState().setSelectedTheme(newTheme);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("onboarding.setup.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Church name */}
          <div className="space-y-1.5">
            <label htmlFor="church-name" className="text-sm font-medium text-foreground">
              {t("onboarding.setup.churchName")}
            </label>
            <Input
              id="church-name"
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
              placeholder={t("onboarding.setup.churchNamePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("onboarding.setup.churchNameHint")}</p>
          </div>

          {/* Theme picker */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("onboarding.setup.appearanceTitle")}</p>
            <ThemePicker value={theme} onChange={handleThemeChange} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate({ to: "/onboarding/welcome" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Button>
        <Button onClick={() => navigate({ to: "/onboarding/content" as string })}>
          {t("onboarding.setup.continue")}
        </Button>
      </div>
    </div>
  );
}
