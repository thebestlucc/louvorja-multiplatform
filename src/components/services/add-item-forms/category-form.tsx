import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { cn } from "../../../lib/utils";
import type { AddItemOnAdd } from "./types";

const PREDEFINED_KEYS = [
  "regencia",
  "escola_sabatina",
  "intervalo",
  "doxologia",
  "pregacao",
] as const;

export function CategoryForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState("");

  const handlePredefined = (key: string) => {
    const name = t(`services.categories.predefined.${key}`);
    onAdd("category", name, null, null);
  };

  const handleCustom = () => {
    const trimmed = custom.trim();
    if (trimmed.length > 0) {
      onAdd("category", trimmed, null, null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {PREDEFINED_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePredefined(key)}
            className={cn(
              "rounded-lg border border-border px-3 py-2.5 text-left text-sm font-medium transition-colors",
              "hover:border-primary/20 hover:bg-surface-hover hover:text-foreground",
              "text-foreground",
            )}
          >
            {t(`services.categories.predefined.${key}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t("services.categories.customLabel")}
        </label>
        <div className="flex gap-2">
          <Input
            placeholder={t("services.categories.customPlaceholder")}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustom();
            }}
          />
          <Button
            size="sm"
            disabled={custom.trim().length === 0}
            onClick={handleCustom}
          >
            {t("actions.add")}
          </Button>
        </div>
      </div>
    </div>
  );
}
