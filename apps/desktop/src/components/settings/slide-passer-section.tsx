import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pointer, TestTube } from "lucide-react";
import { useSlidePasserStore } from "../../stores/slide-passer-store";
import { ToggleButton } from "./toggle-button";
import { Button } from "../ui/button";
import { KeyMappingRow } from "../slide-passer/key-mapping-row";
import { TestClickerDialog } from "../slide-passer/test-clicker-dialog";
import { ExternalAppControl } from "../slide-passer/external-app-control";
import { cn } from "../../lib/utils";
import type { SlidePasserMappings } from "../../stores/slide-passer-store";

const MAPPING_ROWS: { action: keyof SlidePasserMappings; labelKey: string }[] = [
  { action: "nextSlide", labelKey: "slidePasser.mappings.nextSlide" },
  { action: "prevSlide", labelKey: "slidePasser.mappings.prevSlide" },
  { action: "blackScreen", labelKey: "slidePasser.mappings.blackScreen" },
  { action: "toggleProjection", labelKey: "slidePasser.mappings.toggleProjection" },
];

export function SlidePasserSection() {
  const { t } = useTranslation();
  const config = useSlidePasserStore((s) => s.config);
  const setEnabled = useSlidePasserStore((s) => s.setEnabled);
  const setMode = useSlidePasserStore((s) => s.setMode);
  const setMapping = useSlidePasserStore((s) => s.setMapping);
  const [testOpen, setTestOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Pointer className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-medium">{t("slidePasser.title")}</h2>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">{t("slidePasser.enable")}</label>
            <p className="text-xs text-muted-foreground">{t("slidePasser.enableDesc")}</p>
          </div>
          <ToggleButton
            checked={config.enabled}
            onClick={() => setEnabled(!config.enabled)}
            ariaLabel={t("slidePasser.enable")}
          />
        </div>
      </section>

      {config.enabled && (
        <>
          {/* Mode selector */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">{t("slidePasser.mode")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("internal")}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-colors",
                  config.mode === "internal"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <div className="text-sm font-medium">{t("slidePasser.modeInternal")}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("slidePasser.modeInternalDesc")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("external")}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-colors",
                  config.mode === "external"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <div className="text-sm font-medium">{t("slidePasser.modeExternal")}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("slidePasser.modeExternalDesc")}
                </div>
              </button>
            </div>
          </section>

          {/* Key Mappings */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("slidePasser.keyMappings")}</h3>
              <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                <TestTube className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t("slidePasser.testClicker")}
              </Button>
            </div>
            <div className="space-y-2">
              {MAPPING_ROWS.map(({ action, labelKey }) => (
                <KeyMappingRow
                  key={action}
                  label={t(labelKey)}
                  value={config.mappings[action]}
                  onChange={(key) => setMapping(action, key)}
                />
              ))}
            </div>
          </section>

          {/* External app control (only in external mode) */}
          {config.mode === "external" && <ExternalAppControl />}
        </>
      )}

      <TestClickerDialog open={testOpen} onOpenChange={setTestOpen} />
    </div>
  );
}
