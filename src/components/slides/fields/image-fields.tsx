import { useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { catcher } from "../../../lib/catcher";
import { copyImageToMedia } from "../../../lib/tauri/utilities";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select";
import type { ImageFit } from "../../../lib/bindings";

interface ImageFieldsProps {
  path: string;
  caption: string | null;
  fit: ImageFit;
  onChange: (path: string, caption: string | null, fit: ImageFit) => void;
}

export function ImageFields({ path, caption, fit, onChange }: ImageFieldsProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleBrowse = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "avif", "tiff"] }],
    });

    if (!selected || typeof selected !== "string") return;

    setLoading(true);
    const [managedPath, err] = await catcher(copyImageToMedia(selected), { notify: true });
    setLoading(false);

    if (err) return;

    onChange(managedPath!, caption, fit);
  };

  const filename = path
    ? path.replace(/\\/g, "/").split("/").pop() ?? path
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
            value={filename || path}
            placeholder={t("presentations.imagePathPlaceholder")}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
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
          value={caption ?? ""}
          onChange={(e) => onChange(path, e.target.value || null, fit)}
          placeholder={t("presentations.imageAltPlaceholder")}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.imageFit")}
        </label>
        <Select value={fit} onValueChange={(v) => onChange(path, caption, v as ImageFit)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contain">{t("presentations.fitContain")}</SelectItem>
            <SelectItem value="cover">{t("presentations.fitCover")}</SelectItem>
            <SelectItem value="fill">{t("presentations.fitFill")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
