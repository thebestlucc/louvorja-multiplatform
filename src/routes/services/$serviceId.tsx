import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Play, Save, Undo2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { catcher } from "../../lib/catcher";
import { useLiturgyEditor } from "../../hooks/use-liturgy";
import { usePresentationStore } from "../../stores/presentation-store";
import { useShallow } from "zustand/react/shallow";
import { setSlideContext } from "../../lib/tauri";
import { projectSlideWithType } from "../../lib/projection-playback";
import { getPreference, setPreference } from "../../lib/store";
import { LiturgyItemList } from "../../components/services/service-item-list";
import { LiturgyTimeline } from "../../components/services/service-timeline";
import { AddItemModal } from "../../components/services/add-item-modal";
import { DatePicker } from "../../components/services/date-picker";
import { CategoryPicker } from "../../components/services/category-picker";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";
import { useLiturgies, useSetLiturgyWeekDay } from "../../lib/queries";
import type { Liturgy, LiturgyItem as ServiceItem, SlideContent } from "../../lib/bindings";

export const Route = createFileRoute("/services/$serviceId")({
  component: LiturgyEditor,
});

const EMPTY_SLIDE_PROPS = {
  text: null,
  title: null,
  subtitle: null,
  label: null,
  videoPath: null,
  backgroundImage: null,
  backgroundColor: null,
  audioPath: null,
  autoPlay: null,
  loop: null,
  muted: null,
  mode: null,
  textColor: null,
  textSize: null,
  videoUrl: null,
  videoId: null,
  videoSource: null,
  videoTitle: null,
};

const PLAY_STATE_KEY = "activePlayState";

interface PersistedPlayState {
  isPlayingLiturgy: boolean;
  activeLiturgyId: number;
  activeLiturgyItemIndex: number;
}

function LiturgyEditor() {
  const { serviceId } = Route.useParams();
  const { t } = useTranslation();
  const router = useRouter();
  const id = Number(serviceId);

  const {
    service,
    items,
    nestedItems,
    updateMeta,
    addItem,
    removeItem,
    editItem,
    dropItem,
  } = useLiturgyEditor({ serviceId: id });

  const { data: allServices } = useLiturgies();

  const {
    setActiveLiturgy,
    isPlayingLiturgy,
    activeLiturgyItemIndex,
    setPlayingLiturgy,
  } = usePresentationStore(
    useShallow((s) => ({
      setActiveLiturgy: s.setActiveLiturgy,
      isPlayingLiturgy: s.isPlayingLiturgy,
      activeLiturgyItemIndex: s.activeLiturgyItemIndex,
      setPlayingLiturgy: s.setPlayingLiturgy,
    }))
  );

  // Set active liturgy for cross-module integration
  useEffect(() => {
    setActiveLiturgy(id);
    return () => {
      if (!usePresentationStore.getState().isPlayingLiturgy) {
        setActiveLiturgy(null);
      }
    };
  }, [id, setActiveLiturgy]);

  // Restore persisted play state on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [saved] = await catcher(
        getPreference<PersistedPlayState | null>(PLAY_STATE_KEY, null),
      );
      if (cancelled || !saved) return;
      const state = usePresentationStore.getState();
      if (
        saved.activeLiturgyId === id &&
        saved.isPlayingLiturgy &&
        !state.isPlayingLiturgy
      ) {
        state.setPlayingLiturgy(true);
        state.setActiveLiturgyItemIndex(saved.activeLiturgyItemIndex);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const setWeekDay = useSetLiturgyWeekDay();

  // Local form state
  const [localTitle, setLocalTitle] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [localNotes, setLocalNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Schedule mode: "one-time" (date) vs "recurring" (weekday)
  const [scheduleMode, setScheduleMode] = useState<"one-time" | "recurring">("one-time");
  const [localWeekDay, setLocalWeekDay] = useState<number | null>(null);

  // Sync local state when service data loads (only when not dirty)
  useEffect(() => {
    if (service && !isDirty) {
      setLocalTitle(service.title);
      setLocalDate(service.date ?? "");
      setLocalNotes(service.notes ?? "");
      setLocalWeekDay(service.weekDay ?? null);
      setScheduleMode(service.weekDay != null ? "recurring" : "one-time");
    }
  }, [service, isDirty]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"notes" | "timeline">("notes");

  const handleTitleChange = (title: string) => {
    setLocalTitle(title);
    setIsDirty(true);
  };

  const handleDateChange = (date: string) => {
    setLocalDate(date);
    setIsDirty(true);
  };

  const handleNotesChange = (notes: string) => {
    setLocalNotes(notes);
    setIsDirty(true);
  };

  const handleScheduleModeChange = (mode: "one-time" | "recurring") => {
    setScheduleMode(mode);
    if (mode === "one-time") {
      setLocalWeekDay(null);
    } else {
      setLocalDate("");
    }
    setIsDirty(true);
  };

  const handleWeekDayChange = (day: number | null) => {
    setLocalWeekDay(day);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!service) return;
    const dateToSave = scheduleMode === "one-time" ? (localDate || null) : null;
    const weekDayToSave = scheduleMode === "recurring" ? localWeekDay : null;

    updateMeta(localTitle, dateToSave, localNotes || null);
    // Sync weekday separately (it uses its own mutation)
    if (weekDayToSave !== service.weekDay) {
      setWeekDay.mutate({ id, weekDay: weekDayToSave });
    }
    setIsDirty(false);
  };

  const handleDiscard = () => {
    if (!service) return;
    setLocalTitle(service.title);
    setLocalDate(service.date ?? "");
    setLocalNotes(service.notes ?? "");
    setLocalWeekDay(service.weekDay ?? null);
    setScheduleMode(service.weekDay != null ? "recurring" : "one-time");
    setIsDirty(false);
  };

  // Project a single service item to the projector
  const projectItem = useCallback(async (item: ServiceItem) => {
    let slideData: SlideContent;

    switch (item.itemType) {
      case "hymn":
        slideData = { ...EMPTY_SLIDE_PROPS, slideType: "lyrics", title: item.title, text: item.notes ?? "" };
        break;
      case "bible":
        slideData = { ...EMPTY_SLIDE_PROPS, slideType: "bible", title: item.title, text: item.notes ?? "" };
        break;
      case "presentation":
        slideData = { ...EMPTY_SLIDE_PROPS, slideType: "text", title: item.title, text: "" };
        break;
      case "annotation":
        slideData = { ...EMPTY_SLIDE_PROPS, slideType: "text", title: item.title, text: item.notes ?? "" };
        break;
      case "file": {
        const filePath = item.notes ?? "";
        const ext = filePath.replace(/\\/g, "/").split(".").pop()?.toLowerCase() ?? "";
        const imageExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "tiff"]);
        const videoExts = new Set(["mp4", "webm", "mov", "avi", "mkv", "ogv", "m4v", "ts"]);
        if (imageExts.has(ext)) {
          slideData = { ...EMPTY_SLIDE_PROPS, slideType: "image", label: item.title, backgroundImage: filePath };
        } else if (videoExts.has(ext)) {
          slideData = { ...EMPTY_SLIDE_PROPS, slideType: "video", label: item.title, videoPath: filePath };
        } else {
          slideData = { ...EMPTY_SLIDE_PROPS, slideType: "text", title: item.title, text: filePath };
        }
        break;
      }
      default:
        slideData = { ...EMPTY_SLIDE_PROPS, slideType: "text", title: item.title, text: item.notes ?? "" };
        break;
    }

    await catcher(async () => {
      await projectSlideWithType(slideData, "service");
      // Find the item index in the list for return monitor context
      const itemIndex = items.findIndex((i) => i.id === item.id);
      const nextItem = itemIndex + 1 < items.length ? items[itemIndex + 1] : null;
      await setSlideContext({
        next: nextItem
          ? { ...EMPTY_SLIDE_PROPS, slideType: "text", title: nextItem.title, text: nextItem.notes ?? "" }
          : null,
        index: itemIndex >= 0 ? itemIndex : 0,
        total: items.length,
        title: item.title,
        currentSlideStartMs: null,
        nextSlideStartMs: null,
        audioDurationMs: null,
      });
    }, { notify: true });
  }, [items]);

  // Persist play state changes
  useEffect(() => {
    if (isPlayingLiturgy) {
      void catcher(
        setPreference<PersistedPlayState>(PLAY_STATE_KEY, {
          isPlayingLiturgy: true,
          activeLiturgyId: id,
          activeLiturgyItemIndex,
        }),
      );
    }
  }, [isPlayingLiturgy, activeLiturgyItemIndex, id]);

  const handlePlayLiturgy = () => {
    if (items.length === 0) return;
    setPlayingLiturgy(true);
    setRightTab("timeline");
    void router.navigate({ to: "/playing-now" });
  };

  if (!service) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <Link to="/services">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Input
            className="max-w-xs border-transparent bg-transparent text-lg font-bold tracking-tight shadow-none focus:border-border focus:bg-surface"
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <CategoryPicker serviceId={id} />

          {/* Schedule mode toggle */}
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted px-1 py-0.5">
            <button
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-all duration-150",
                scheduleMode === "one-time"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleScheduleModeChange("one-time")}
            >
              {t("services.scheduleMode.oneTime")}
            </button>
            <button
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-all duration-150",
                scheduleMode === "recurring"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleScheduleModeChange("recurring")}
            >
              {t("services.scheduleMode.recurring")}
            </button>
          </div>

          {scheduleMode === "one-time" ? (
            <DatePicker value={localDate} onChange={handleDateChange} />
          ) : (
            <WeekDayPicker
              serviceId={id}
              currentWeekDay={localWeekDay}
              allServices={allServices ?? []}
              onChange={handleWeekDayChange}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <Button size="sm" variant="ghost" className="shadow-sm" onClick={handleDiscard}>
                <Undo2 className="mr-2 h-3.5 w-3.5" />
                {t("services.discardChanges")}
              </Button>
              <Button size="sm" className="shadow-sm" onClick={handleSave}>
                <Save className="mr-2 h-3.5 w-3.5" />
                {t("services.saveChanges")}
              </Button>
            </>
          )}
          {!isPlayingLiturgy && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="shadow-sm"
                onClick={handlePlayLiturgy}
                disabled={items.length === 0}
              >
                <Play className="mr-2 h-3.5 w-3.5" />
                {t("services.playService")}
              </Button>
              <Button size="sm" className="shadow-sm" onClick={() => setAddModalOpen(true)}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                {t("services.addItem")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-0">
        {/* Left panel -- Items list */}
        <div className="overflow-auto border-r border-border bg-surface">
          <LiturgyItemList
            items={items}
            nestedItems={nestedItems}
            serviceId={id}
            serviceDate={service?.date ?? null}
            activeItemIndex={isPlayingLiturgy ? activeLiturgyItemIndex : -1}
            onRemove={removeItem}
            onDrop={dropItem}
            onProject={projectItem}
            onEditItem={editItem}
          />
        </div>

        {/* Right panel -- Notes / Timeline */}
        <div className="hidden lg:flex flex-col overflow-hidden bg-surface">
          {/* Pill tab switcher */}
          <div className="flex gap-1 border-b border-border p-2">
            <button
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                rightTab === "notes"
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
              onClick={() => setRightTab("notes")}
            >
              {t("services.serviceNotes")}
            </button>
            <button
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                rightTab === "timeline"
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
              onClick={() => setRightTab("timeline")}
            >
              {t("services.timeline")}
            </button>
          </div>

          {/* Tab content */}
          {rightTab === "notes" ? (
            <div className="flex flex-1 flex-col overflow-auto p-3">
              <textarea
                className={cn(
                  "flex-1 resize-none rounded-lg border border-border bg-transparent p-3 text-sm leading-[1.8rem] text-foreground",
                  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all",
                )}
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(transparent, transparent 1.775rem, var(--color-border) 1.775rem, var(--color-border) 1.8rem)",
                  backgroundPosition: "0 0.8rem",
                }}
                placeholder={t("services.notes")}
                value={localNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
              />
            </div>
          ) : (
            <LiturgyTimeline
              items={items}
              activeIndex={isPlayingLiturgy ? activeLiturgyItemIndex : -1}
            />
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      <AddItemModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        serviceId={id}
        onAdd={addItem}
      />
    </div>
  );
}

// ─── weekday picker ──────────────────────────────────────

interface WeekDayPickerProps {
  serviceId: number;
  currentWeekDay: number | null;
  allServices: Liturgy[];
  onChange: (day: number | null) => void;
}

function WeekDayPicker({ serviceId, currentWeekDay, allServices, onChange }: WeekDayPickerProps) {
  const { t } = useTranslation();
  const [pendingDay, setPendingDay] = useState<number | null>(null);

  const DAYS = [
    { key: "sun", label: t("services.calendar.weekdays.sun"), value: 0 },
    { key: "mon", label: t("services.calendar.weekdays.mon"), value: 1 },
    { key: "tue", label: t("services.calendar.weekdays.tue"), value: 2 },
    { key: "wed", label: t("services.calendar.weekdays.wed"), value: 3 },
    { key: "thu", label: t("services.calendar.weekdays.thu"), value: 4 },
    { key: "fri", label: t("services.calendar.weekdays.fri"), value: 5 },
    { key: "sat", label: t("services.calendar.weekdays.sat"), value: 6 },
  ];

  // Map day value → the liturgy that owns it (excluding current)
  const takenByService = new Map<number, Liturgy>(
    allServices
      .filter((s) => s.id !== serviceId && s.weekDay !== null)
      .map((s) => [s.weekDay as number, s]),
  );

  const handleClick = (value: number) => {
    // Toggle off: active day clicked → clear
    if (currentWeekDay === value) {
      onChange(null);
      return;
    }
    // Taken by another service → open confirmation dialog
    if (takenByService.has(value)) {
      setPendingDay(value);
      return;
    }
    // Free day → assign locally
    onChange(value);
  };

  const handleConfirmOverride = () => {
    if (pendingDay !== null) {
      onChange(pendingDay);
    }
    setPendingDay(null);
  };

  const conflictingService = pendingDay !== null ? takenByService.get(pendingDay) : null;
  const pendingDayLabel = pendingDay !== null ? DAYS.find((d) => d.value === pendingDay)?.label : null;

  return (
    <>
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-1">
        {DAYS.map((day) => {
          const isActive = currentWeekDay === day.value;
          const takenBy = takenByService.get(day.value);
          const isTaken = !!takenBy && !isActive;

          const btn = (
            <button
              key={day.key}
              onClick={() => handleClick(day.value)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : isTaken
                    ? "cursor-not-allowed text-muted-foreground/30"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {day.label}
            </button>
          );

          if (isTaken) {
            return (
              <Tooltip key={day.key} delayDuration={300}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("services.weekDayTakenBy", { title: takenBy!.title })}
                </TooltipContent>
              </Tooltip>
            );
          }

          return btn;
        })}
      </div>

      {/* Override confirmation dialog */}
      <Dialog open={pendingDay !== null} onOpenChange={(open) => { if (!open) setPendingDay(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("services.weekDayOverrideTitle")}</DialogTitle>
            <DialogDescription>
              {t("services.weekDayOverrideDesc", {
                day: pendingDayLabel,
                title: conflictingService?.title ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingDay(null)}>
              {t("actions.cancel")}
            </Button>
            <Button size="sm" onClick={handleConfirmOverride}>
              {t("services.weekDayOverrideConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
