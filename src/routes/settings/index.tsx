import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Wifi } from "lucide-react";
import { useSetting, useSetSetting } from "../../lib/queries";
import { StreamingControls } from "../../components/streaming/streaming-controls";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const { t } = useTranslation();
  const { data: portSetting } = useSetting("streaming.port");
  const { data: autoStartSetting } = useSetting("streaming.autoStart");
  const setSettingMutation = useSetSetting();

  const [port, setPort] = useState("7070");
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    if (portSetting) setPort(portSetting.value);
  }, [portSetting]);

  useEffect(() => {
    if (autoStartSetting) setAutoStart(autoStartSetting.value === "true");
  }, [autoStartSetting]);

  const handlePortBlur = () => {
    const portNum = parseInt(port, 10);
    if (portNum >= 1024 && portNum <= 65535) {
      setSettingMutation.mutate({ key: "streaming.port", value: port });
    }
  };

  const handleAutoStartChange = (checked: boolean) => {
    setAutoStart(checked);
    setSettingMutation.mutate({ key: "streaming.autoStart", value: String(checked) });
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <h1 className="text-xl font-semibold">{t("nav.settings")}</h1>

      {/* Streaming Section */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Wifi className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("streaming.title")}</h2>
        </div>

        <div className="space-y-4">
          {/* Default port */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium">{t("settings.defaultPort")}</label>
            <Input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              onBlur={handlePortBlur}
              className="w-28"
              min={1024}
              max={65535}
            />
          </div>

          {/* Auto-start toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium">{t("settings.autoStart")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.autoStartDesc")}</p>
            </div>
            <button
              type="button"
              onClick={() => handleAutoStartChange(!autoStart)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                autoStart ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                  autoStart ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>

          {/* Divider */}
          <hr className="border-border" />

          {/* Embedded streaming controls */}
          <StreamingControls />
        </div>
      </section>
    </div>
  );
}
