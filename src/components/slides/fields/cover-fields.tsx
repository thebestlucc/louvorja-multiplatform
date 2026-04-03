import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";

interface CoverFieldsProps {
  title: string;
  subtitle: string | null;
  onChange: (title: string, subtitle: string | null) => void;
}

export function CoverFields({ title, subtitle, onChange }: CoverFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.title")}
        </label>
        <Input
          value={title}
          onChange={(e) => onChange(e.target.value, subtitle)}
          placeholder={t("presentations.titlePlaceholder")}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.subtitle")}
        </label>
        <Input
          value={subtitle ?? ""}
          onChange={(e) => onChange(title, e.target.value || null)}
          placeholder={t("presentations.subtitlePlaceholder")}
        />
      </div>
    </>
  );
}
