import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";

interface TextFieldsProps {
  content: string;
  onChange: (content: string) => void;
}

export function TextFields({ content, onChange }: TextFieldsProps) {
  const { t } = useTranslation();
  return (
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
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("presentations.textPlaceholder")}
      />
    </div>
  );
}
