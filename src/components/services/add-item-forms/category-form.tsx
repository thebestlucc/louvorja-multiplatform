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

export function CategoryForm({ onAdd, initialTitle, isEditMode, submitLabel }: { onAdd: AddItemOnAdd; initialTitle?: string; isEditMode?: boolean; submitLabel?: string }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(initialTitle ?? "");

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
    <div className="flex flex-col gap-5">
      {!isEditMode && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("services.categories.predefinedLabel", "Categorias sugeridas")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PREDEFINED_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePredefined(key)}
                className={cn(
                  "rounded-lg border border-border px-4 py-3 text-left text-sm font-medium transition-colors",
                  "hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
                  "text-foreground",
                )}
              >
                {t(`services.categories.predefined.${key}`)}
              </button>
            ))}
          </div>
        </div>
      )}

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
            disabled={custom.trim().length === 0}
            onClick={handleCustom}
          >
            {submitLabel ?? t("actions.add")}
          </Button>
        </div>
      </div>
    </div>
  );
}
