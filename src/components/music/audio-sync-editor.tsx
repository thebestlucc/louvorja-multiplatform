import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Circle, Trash2, Save, RotateCcw, Clock, Square } from "lucide-react";
import { useAudio } from "../../hooks/use-audio";
import { useSaveSyncPoints } from "../../lib/queries";
import { Button } from "../ui/button";
import type { SyncPoint, SlideContent } from "../../lib/bindings";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((ms % 1000) / 100); // 1 digit for millis
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis}`;
}

interface AudioSyncEditorProps {
  hymnId: number;
  initialPoints: SyncPoint[];
  totalSlides: number;
  slides?: SlideContent[];
  onClose: () => void;
}

export function AudioSyncEditor({
  hymnId,
  initialPoints,
  totalSlides,
  slides = [],
  onClose,
}: AudioSyncEditorProps) {
  const { t } = useTranslation();
  const { positionMs, durationMs, status } = useAudio();
  const saveMutation = useSaveSyncPoints();

  const [points, setPoints] = useState<SyncPoint[]>(
    [...initialPoints].sort((a, b) => a.timestampMs - b.timestampMs),
  );
  const [isRecording, setIsRecording] = useState(false);

  const isPlaying = status === "playing";

  const handleRecordSlide = useCallback((slideIndex: number) => {
    setPoints((prev) => {
      const filtered = prev.filter((p) => p.slideIndex !== slideIndex);
      const newPoint: SyncPoint = {
        slideIndex,
        timestampMs: positionMs,
        instrumentalTimestampMs: null, // Keep existing or default to null for now
      };
      return [...filtered, newPoint].sort((a, b) => a.timestampMs - b.timestampMs);
    });
  }, [positionMs]);

  const handleRemovePoint = (slideIndex: number) => {
    setPoints((prev) => prev.filter((p) => p.slideIndex !== slideIndex));
  };

  const handleClearAll = () => {
    setPoints([]);
  };

  const handleSave = () => {
    saveMutation.mutate({ hymnId, points });
  };

  const progressPercent = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar with sync point markers */}
      <div className="relative h-6 mt-2">
        <div className="absolute inset-x-0 top-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-100 ease-linear"
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
              <div className="mt-1 h-4 w-1 bg-accent rounded-full border border-surface shadow-sm" />
            </div>
          );
        })}
      </div>

      {/* Recording controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsRecording(false)}
            >
              <Square className="mr-1 h-3 w-3 fill-current" />
              Stop Recording
            </Button>
          ) : (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setIsRecording(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Circle className="mr-1 h-3 w-3 fill-current" />
              {t("audio.record")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleClearAll}>
            <RotateCcw className="mr-1 h-3 w-3" />
            {t("audio.clearAll")}
          </Button>
        </div>
        <div className="text-sm font-medium tabular-nums text-muted-foreground bg-muted px-2 py-1 rounded-md">
          {formatTime(positionMs)} / {formatTime(durationMs)}
        </div>
      </div>

      {/* Sync points table/list */}
      <div className="border border-border rounded-md divide-y divide-border overflow-hidden">
        <div className="grid grid-cols-[3rem_1fr_6rem_3rem] gap-2 p-2 bg-muted/50 text-xs font-medium text-muted-foreground">
          <div className="text-center">#</div>
          <div>Text</div>
          <div className="text-right">Sync Time</div>
          <div className="text-center">Action</div>
        </div>
        
        <div className="max-h-60 overflow-y-auto divide-y divide-border">
          {Array.from({ length: totalSlides }).map((_, slideIndex) => {
            const point = points.find(p => p.slideIndex === slideIndex);
            const slide = slides[slideIndex];
            const slideText = slide?.text || (slideIndex === 0 ? "Título / Capa" : "...");
            
            return (
              <div 
                key={slideIndex}
                className={`grid grid-cols-[3rem_1fr_6rem_3rem] items-center gap-2 p-2 text-sm transition-colors
                  ${point ? "bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <div className="text-center font-medium text-muted-foreground">
                  {slideIndex + 1}
                </div>
                <div className="truncate text-xs opacity-80" title={slideText}>
                  {slideText}
                </div>
                <div className="text-right tabular-nums">
                  {point ? (
                    <span className="font-medium text-primary">
                      {formatTime(point.timestampMs)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">--:--</span>
                  )}
                </div>
                <div className="flex justify-center">
                  {point ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemovePoint(slideIndex)}
                      title="Remove point"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${isRecording && isPlaying ? "text-red-500 hover:bg-red-500/10" : ""}`}
                      onClick={() => handleRecordSlide(slideIndex)}
                      disabled={!isRecording && !isPlaying}
                      title="Set to current playback time"
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save / Discard */}
      <div className="flex items-center gap-2 pt-2">
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
