import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";

export function ImageFields({ src, alt, onChange }: {
  src: string;
  alt?: string;
  onChange: (src: string, alt?: string) => void;
}) {
  const { t } = useTranslation();

  const handleBrowse = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "avif", "tiff"] }],
    });

    if (!selected || typeof selected !== "string") return;

    onChange(selected, alt);
  };

  const filename = src
    ? src.replace(/\\/g, "/").split("/").pop() ?? src
    : "";

  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.imagePath")}
        </label>
        <div className="flex flex-1 items-center gap-2">
          <Input
            readOnly
            value={filename || src}
            placeholder={t("presentations.imagePathPlaceholder")}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleBrowse()}
          >
            {t("presentations.videoBrowse")}
          </Button>
        </div>
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
