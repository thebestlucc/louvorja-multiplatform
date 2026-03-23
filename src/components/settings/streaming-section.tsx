import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Wifi } from "lucide-react";
import { useSetting, useSetSetting } from "../../lib/queries";
import { Input } from "../../components/ui/input";
import { StreamingControls } from "../../components/streaming/streaming-controls";
import { ToggleButton } from "./toggle-button";

export function StreamingSection() {
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
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Wifi className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("streaming.title")}</h2>
      </div>

      <div className="space-y-4">
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

        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">{t("settings.autoStart")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.autoStartDesc")}</p>
          </div>
          <ToggleButton
            checked={autoStart}
            onClick={() => handleAutoStartChange(!autoStart)}
            ariaLabel={t("settings.autoStart")}
          />
        </div>

        <hr className="border-border" />

        <StreamingControls />
      </div>
    </section>
  );
}
