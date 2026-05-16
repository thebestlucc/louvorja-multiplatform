import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Key, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";

export function ApiKeySetup() {
  const { t } = useTranslation();
  const [showTutorial, setShowTutorial] = useState(false);

  const steps = t("onlineVideos.setup.steps", { returnObjects: true }) as string[];

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Key className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">{t("onlineVideos.setup.title")}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {t("onlineVideos.setup.description")}
        </p>
      </div>

      <Link to="/settings" search={{ tab: "youtube" } as any}>
        <Button>{t("onlineVideos.setup.goToSettings")}</Button>
      </Link>

      {/* Tutorial toggle */}
      <button
        type="button"
        onClick={() => setShowTutorial(!showTutorial)}
        className="flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {showTutorial ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {t("onlineVideos.setup.tutorialToggle")}
      </button>

      {showTutorial && (
        <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-5 text-left">
          <h4 className="text-sm font-semibold mb-3">
            {t("onlineVideos.setup.tutorialTitle")}
          </h4>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {Array.isArray(steps) &&
              steps.map((step, i) => (
                <li key={i} className="leading-relaxed">
                  {step}
                </li>
              ))}
          </ol>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span>{t("onlineVideos.setup.tutorialNote")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
