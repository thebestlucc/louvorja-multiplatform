import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";

export function ImageFields({ src, alt, onChange }: {
  src: string;
  alt?: string;
  onChange: (src: string, alt?: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.imagePath")}
        </label>
        <Input
          value={src}
          onChange={(e) => onChange(e.target.value, alt)}
          placeholder={t("presentations.imagePathPlaceholder")}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.imageAlt")}
        </label>
        <Input
          value={alt ?? ""}
          onChange={(e) => onChange(src, e.target.value || undefined)}
          placeholder={t("presentations.imageAltPlaceholder")}
        />
      </div>
    </>
  );
}
