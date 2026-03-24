import { useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import type { SlideContent, VideoMetadata } from "../../lib/bindings";
import { getVideoMetadata } from "../../lib/tauri";
import { getConversionRecommendation, isVideoFormatSupported } from "../../lib/utils";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface VideoPickerProps {
  value: SlideContent;
  onChange: (next: SlideContent) => void;
}

export function VideoPicker({ value, onChange }: VideoPickerProps) {
  const { t } = useTranslation();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBrowse = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4", "webm", "mov", "m4v", "ogv", "3gp"] }],
    });

    if (!selected || typeof selected !== "string") {
      return;
    }

    if (!isVideoFormatSupported(selected)) {
      notify.error(
        t("presentations.videoUnsupported", {
          recommendation: getConversionRecommendation(selected.split(".").pop() ?? ""),
        }),
      );
      return;
    }

    setLoading(true);

    const [parsedMetadata, metaError] = await catcher(getVideoMetadata(selected), {
      notify: true,
      fallbackMessage: t("presentations.videoImportFailed", { error: "" }),
    });

    setLoading(false);

    if (metaError) {
      return;
    }

    setMetadata(parsedMetadata);

    onChange({
      ...value,
      videoPath: selected,
    });

    notify.success(t("presentations.videoImported"));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value.videoPath || ""}
          placeholder={t("presentations.videoPathPlaceholder")}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void handleBrowse()}
        >
          {loading ? t("presentations.videoLoading") : t("presentations.videoBrowse")}
        </Button>
      </div>

      {metadata && (
        <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 gap-2">
            <span>{t("presentations.videoDuration")}</span>
            <span>{formatDuration(metadata.durationMs)}</span>
            <span>{t("presentations.videoResolution")}</span>
            <span>{metadata.width}x{metadata.height}</span>
            <span>{t("presentations.videoFileSize")}</span>
            <span>{formatFileSize(metadata.fileSize)}</span>
            <span>{t("presentations.videoFormat")}</span>
            <span>{metadata.format.toUpperCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
