import { useTranslation } from "react-i18next";
import { Monitor } from "lucide-react";
import { useSlidePasserStore } from "../../stores/slide-passer-store";
import { MacPermissionBanner } from "./mac-permission-banner";
import type { SlidePasserConfig } from "../../stores/slide-passer-store";

const EXTERNAL_APPS: { id: SlidePasserConfig["externalApp"]; labelKey: string }[] = [
  { id: "powerpoint", labelKey: "slidePasser.apps.powerpoint" },
  { id: "keynote", labelKey: "slidePasser.apps.keynote" },
  { id: "libreoffice", labelKey: "slidePasser.apps.libreoffice" },
  { id: "google-slides", labelKey: "slidePasser.apps.googleSlides" },
  { id: "custom", labelKey: "slidePasser.apps.custom" },
];

export function ExternalAppControl() {
  const { t } = useTranslation();
  const externalApp = useSlidePasserStore((s) => s.config.externalApp);
  const setExternalApp = useSlidePasserStore((s) => s.setExternalApp);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-medium">{t("slidePasser.externalApp")}</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm">{t("slidePasser.targetApp")}</label>
          <select
            value={externalApp}
            onChange={(e) =>
              setExternalApp(e.target.value as SlidePasserConfig["externalApp"])
            }
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {EXTERNAL_APPS.map(({ id, labelKey }) => (
              <option key={id} value={id}>
                {t(labelKey)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">{t("slidePasser.externalAppDesc")}</p>

        <MacPermissionBanner />
      </div>
    </section>
  );
}
