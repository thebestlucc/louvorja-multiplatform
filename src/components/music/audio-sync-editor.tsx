import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Circle, Trash2, Save, X, RotateCcw } from "lucide-react";
import { useAudio } from "../../hooks/use-audio";
import { useSaveSyncPoints } from "../../lib/queries";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import type { SyncPoint } from "../../types/audio";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
}

interface AudioSyncEditorProps {
  hymnId: number;
  initialPoints: SyncPoint[];
  totalSlides: number;
  onClose: () => void;
}

export function AudioSyncEditor({
  hymnId,
  initialPoints,
  totalSlides,
  onClose,
}: AudioSyncEditorProps) {
  const { t } = useTranslation();
  const { positionMs, durationMs, status } = useAudio();
  const saveMutation = useSaveSyncPoints();

  const [points, setPoints] = useState<SyncPoint[]>(
    [...initialPoints].sort((a, b) => a.timestampMs - b.timestampMs),
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordSlideIndex, setRecordSlideIndex] = useState(0);

  const isPlaying = status === "playing";

  const handleRecord = useCallback(() => {
    if (!isPlaying) return;

    const newPoint: SyncPoint = {
      slideIndex: recordSlideIndex,
      timestampMs: positionMs,
    };

    setPoints((prev) => {
      const filtered = prev.filter((p) => p.slideIndex !== recordSlideIndex);
      return [...filtered, newPoint].sort((a, b) => a.timestampMs - b.timestampMs);
    });

    if (recordSlideIndex < totalSlides - 1) {
      setRecordSlideIndex(recordSlideIndex + 1);
    } else {
      setIsRecording(false);
    }
  }, [isPlaying, positionMs, recordSlideIndex, totalSlides]);

  const handleRemovePoint = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setPoints([]);
    setRecordSlideIndex(0);
  };

  const handleSave = () => {
    saveMutation.mutate({ hymnId, points });
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordSlideIndex(0);
  };

  const handleUpdateTimestamp = (index: number, timestampMs: number) => {
    setPoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], timestampMs };
      return updated.sort((a, b) => a.timestampMs - b.timestampMs);
    });
  };

  const progressPercent = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("audio.syncEditor")}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress bar with sync point markers */}
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-2.5 h-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {points.map((point) => {
          const percent = durationMs > 0 ? (point.timestampMs / durationMs) * 100 : 0;
          return (
            <div
              key={`${point.slideIndex}-${point.timestampMs}`}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${percent}%` }}
              title={`Slide ${point.slideIndex + 1} @ ${formatTime(point.timestampMs)}`}
            >
              <div className="h-6 w-0.5 bg-accent" />
            </div>
          );
        })}
      </div>

      {/* Recording controls */}
      <div className="flex items-center gap-2">
        {isRecording ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRecord}
              disabled={!isPlaying}
            >
              <Circle className="mr-1 h-3 w-3 fill-current" />
              {t("audio.record")} (Slide {recordSlideIndex + 1})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRecording(false)}
            >
              {t("actions.cancel")}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={handleStartRecording}>
            <Circle className="mr-1 h-3 w-3" />
            {t("audio.record")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleClearAll}>
          <RotateCcw className="mr-1 h-3 w-3" />
          {t("audio.clearAll")}
        </Button>
      </div>

      {/* Sync points list */}
      {points.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {points.map((point, i) => (
            <div
              key={`${point.slideIndex}-${i}`}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-16 text-muted-foreground">
                Slide {point.slideIndex + 1}
              </span>
              <Slider
                value={[point.timestampMs]}
                min={0}
                max={durationMs || 1}
                step={100}
                onValueChange={(v) => handleUpdateTimestamp(i, v[0])}
                className="flex-1"
              />
              <span className="w-16 tabular-nums text-muted-foreground">
                {formatTime(point.timestampMs)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleRemovePoint(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Save / Discard */}
      <div className="flex items-center gap-2 border-t border-border pt-2">
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="mr-1 h-3 w-3" />
          {t("actions.save")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("audio.discard")}
        </Button>
      </div>
    </div>
  );
}
