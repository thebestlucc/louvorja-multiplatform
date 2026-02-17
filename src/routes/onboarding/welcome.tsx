import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Languages, Rocket, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { LANGUAGES, type Language } from "../../lib/constants";
import { useSetSetting } from "../../lib/queries";
import { useThemeStore } from "../../stores/theme-store";
import { useOnboardingStore } from "../../stores/onboarding-store";

export const Route = createFileRoute("/onboarding/welcome")({
  component: OnboardingWelcomePage,
});

function OnboardingWelcomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language, setLanguage } = useThemeStore();
  const setSettingMutation = useSetSetting();
  const setMode = useOnboardingStore((state) => state.setMode);
  const clearMigration = useOnboardingStore((state) => state.clearMigration);
  const languageLabelByCode: Record<Language, string> = {
    pt: t("settings.languagePt"),
    en: t("settings.languageEn"),
    es: t("settings.languageEs"),
  };

  const handleLanguage = (nextLanguage: Language) => {
    if (nextLanguage === language) {
      return;
    }
    setLanguage(nextLanguage);
    setSettingMutation.mutate({ key: "app.language", value: nextLanguage });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{t("onboarding.welcome.title")}</CardTitle>
          <CardDescription>{t("onboarding.welcome.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Languages className="h-4 w-4 text-primary" />
            {t("onboarding.welcome.language")}
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((option) => (
              <Button
                key={option}
                type="button"
                variant={language === option ? "default" : "outline"}
                onClick={() => handleLanguage(option)}
                className="min-w-24"
              >
                {languageLabelByCode[option]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            {t("onboarding.welcome.importTitle")}
          </CardTitle>
          <CardDescription>{t("onboarding.welcome.importDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            onClick={() => {
              setMode("import");
              navigate({ to: "/onboarding/import" });
            }}
          >
            {t("onboarding.welcome.importAction")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            {t("onboarding.welcome.freshTitle")}
          </CardTitle>
          <CardDescription>{t("onboarding.welcome.freshDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMode("fresh");
              clearMigration();
              navigate({ to: "/onboarding/monitors" });
            }}
          >
            {t("onboarding.welcome.freshAction")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
