import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { LANGUAGES, type Language } from "../../lib/constants";
import { useSetSetting } from "../../lib/queries";
import { useThemeStore } from "../../stores/theme-store";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/onboarding/welcome")({
  component: OnboardingWelcomePage,
});

const FLAG_LABELS: Record<Language, { flag: string; name: string }> = {
  pt: { flag: "\u{1F1E7}\u{1F1F7}", name: "Portugu\u00EAs" },
  en: { flag: "\u{1F1FA}\u{1F1F8}", name: "English" },
  es: { flag: "\u{1F1EA}\u{1F1F8}", name: "Espa\u00F1ol" },
};

function OnboardingWelcomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language, setLanguage } = useThemeStore();
  const setSettingMutation = useSetSetting();

  const handleLanguage = (nextLanguage: Language) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    setSettingMutation.mutate({ key: "app.language", value: nextLanguage });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      {/* Logo + title */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-4xl font-bold text-primary">
          LJ
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">LouvorJA</h1>
        <p className="text-lg text-muted-foreground">{t("onboarding.welcome.tagline")}</p>
      </div>

      {/* Language selector */}
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t("onboarding.welcome.language")}</p>
        <div className="flex gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguage(lang)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border-2 px-6 py-3 transition-colors",
                language === lang
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary/50",
              )}
            >
              <span className="text-2xl">{FLAG_LABELS[lang].flag}</span>
              <span className="text-sm font-medium">{FLAG_LABELS[lang].name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Button size="lg" onClick={() => navigate({ to: "/onboarding/setup" })}>
        {t("onboarding.welcome.getStarted")}
      </Button>
    </div>
  );
}
