import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";
import { cn } from "../../../lib/utils";

interface LyricsFieldsProps {
  text: string;
  label: string | null;
  onChange: (text: string, label: string | null) => void;
}

export function LyricsFields({ text, label, onChange }: LyricsFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.label")}
        </label>
        <Input
          value={label ?? ""}
          onChange={(e) => onChange(text, e.target.value || null)}
          placeholder={t("presentations.labelPlaceholder")}
        />
      </div>
      <div className="flex gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0 pt-2">
          {t("presentations.text")}
        </label>
        <textarea
          className={cn(
            "flex min-h-[120px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
          value={text}
          onChange={(e) => onChange(e.target.value, label)}
          placeholder={t("presentations.textPlaceholder")}
        />
      </div>
    </>
  );
}
