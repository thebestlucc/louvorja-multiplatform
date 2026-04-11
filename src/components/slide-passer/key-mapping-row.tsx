import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyCapture } from "./key-capture-dialog";

interface KeyMappingRowProps {
  label: string;
  value: string | null;
  onChange: (key: string | null) => void;
}

export function KeyMappingRow({ label, value, onChange }: KeyMappingRowProps) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
            {value}
          </kbd>
        ) : (
          <span className="text-xs text-muted-foreground">{t("slidePasser.noKey")}</span>
        )}
        <button
          type="button"
          onClick={() => setCapturing(true)}
          className="text-xs text-primary hover:underline"
        >
          {t("slidePasser.change")}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            {t("slidePasser.clear")}
          </button>
        )}
      </div>
      {capturing && (
        <KeyCapture
          onCapture={(key) => {
            onChange(key);
            setCapturing(false);
          }}
          onCancel={() => setCapturing(false)}
        />
      )}
    </div>
  );
}
