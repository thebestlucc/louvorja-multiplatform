import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Upload, X } from "lucide-react";
import { notify } from "../../lib/notifications";
import { Button } from "../ui/button";
import { CoverImage } from "./cover-image";
import { useCopyImageToMedia } from "../../lib/queries";
import { useTranslation } from "react-i18next";
import { catcher } from "../../lib/catcher";

interface CoverPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  title: string;
}

export function CoverPicker({ value, onChange, title }: CoverPickerProps) {
  const { t } = useTranslation();
  const copyMutation = useCopyImageToMedia();

  const handlePick = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "tif", "tiff", "ico"] }],
    });
    if (!selected || Array.isArray(selected)) {
      return;
    }

    const [managed, error] = await catcher(copyMutation.mutateAsync(selected), {
      notify: true,
      fallbackMessage: t("collections.coverUpdateFailed", { error: "" }),
    });

    if (error) return;

    onChange(managed);
    notify.success(t("collections.coverUpdated"));
  };

  return (
    <div className="flex items-center gap-3">
      <CoverImage path={value} title={title} className="h-20 w-20" />
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handlePick}
          disabled={copyMutation.isPending}
          aria-label={t("collections.selectCover")}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t("collections.selectCover")}
        </Button>
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(null)}
            aria-label={t("collections.clearCover")}
          >
            <X className="mr-2 h-4 w-4" />
            {t("collections.clearCover")}
          </Button>
        )}
      </div>
    </div>
  );
}
