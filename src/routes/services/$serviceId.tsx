import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Play, Square, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { catcher } from "../../lib/catcher";
import { useServiceEditor } from "../../hooks/use-service";
import { usePresentationStore } from "../../stores/presentation-store";
import { useShallow } from "zustand/react/shallow";
import { setSlideContext } from "../../lib/tauri";
import { projectSlideWithType } from "../../lib/projection-playback";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { getPreference, setPreference, deletePreference } from "../../lib/store";
import { ServiceItemList } from "../../components/services/service-item-list";
import { ServiceTimeline } from "../../components/services/service-timeline";
import { AddItemModal } from "../../components/services/add-item-modal";
import { DatePicker } from "../../components/services/date-picker";
import { CategoryPicker } from "../../components/services/category-picker";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";
import { useServices, useSetServiceWeekDay } from "../../lib/queries";
import type { Service, ServiceItem, SlideContent } from "../../lib/bindings";

export const Route = createFileRoute("/services/$serviceId")({
  component: ServiceEditor,
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
  isPlayingService: boolean;
  activeServiceId: number;
  activeServiceItemIndex: number;
}

function ServiceEditor() {
  const { serviceId } = Route.useParams();
  const { t } = useTranslation();
  const id = Number(serviceId);

  const {
    service,
    items,
    updateMeta,
    addItem,
    removeItem,
    reorderItems,
    editItem,
  } = useServiceEditor({ serviceId: id });

  const { data: allServices } = useServices();

  const {
    setActiveService,
    isPlayingService,
    activeServiceItemIndex,
    setPlayingService,
    setActiveServiceItemIndex,
  } = usePresentationStore(
    useShallow((s) => ({
      setActiveService: s.setActiveService,
      isPlayingService: s.isPlayingService,
      activeServiceItemIndex: s.activeServiceItemIndex,
      setPlayingService: s.setPlayingService,
      setActiveServiceItemIndex: s.setActiveServiceItemIndex,
    }))
  );

  // Set active service for cross-module integration
  useEffect(() => {
    setActiveService(id);
    return () => {
      setActiveService(null);
      setPlayingService(false);
    };
  }, [id, setActiveService, setPlayingService]);

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
        saved.activeServiceId === id &&
        saved.isPlayingService &&
        !state.isPlayingService
      ) {
        state.setPlayingService(true);
        state.setActiveServiceItemIndex(saved.activeServiceItemIndex);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Local title state for responsive typing
  const [localTitle, setLocalTitle] = useState("");
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleDirtyRef = useRef(false);

  // Local date state
  const [localDate, setLocalDate] = useState("");
  const dateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dateDirtyRef = useRef(false);

  // Local notes state
  const [localNotes, setLocalNotes] = useState("");
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notesDirtyRef = useRef(false);

  // Sync local state when service data loads
  useEffect(() => {
    if (service && !titleDirtyRef.current) {
      setLocalTitle(service.title);
    }
  }, [service]);

  useEffect(() => {
    if (service && !dateDirtyRef.current) {
      setLocalDate(service.date ?? "");
    }
  }, [service]);

  useEffect(() => {
    if (service && !notesDirtyRef.current) {
      setLocalNotes(service.notes ?? "");
    }
  }, [service]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"notes" | "timeline">("notes");

  const handleTitleChange = (title: string) => {
    setLocalTitle(title);
    titleDirtyRef.current = true;
    if (!service) return;
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      updateMeta(title, service.date, service.notes);
      titleDirtyRef.current = false;
    }, 800);
  };

  const handleDateChange = (date: string) => {
    setLocalDate(date);
    dateDirtyRef.current = true;
    if (!service) return;
    if (dateTimerRef.current) clearTimeout(dateTimerRef.current);
    dateTimerRef.current = setTimeout(() => {
      updateMeta(service.title, date || null, service.notes);
      dateDirtyRef.current = false;
    }, 800);
  };

  const handleNotesChange = (notes: string) => {
    setLocalNotes(notes);
    notesDirtyRef.current = true;
    if (!service) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      updateMeta(service.title, service.date, notes || null);
      notesDirtyRef.current = false;
    }, 800);
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

  // Play Service: project the active item whenever the index changes
  useEffect(() => {
    if (isPlayingService && activeServiceItemIndex >= 0 && activeServiceItemIndex < items.length) {
      projectItem(items[activeServiceItemIndex]);
    }
  }, [isPlayingService, activeServiceItemIndex, items, projectItem]);

  // Persist play state changes
  useEffect(() => {
    if (isPlayingService) {
      void catcher(
        setPreference<PersistedPlayState>(PLAY_STATE_KEY, {
          isPlayingService: true,
          activeServiceId: id,
          activeServiceItemIndex,
        }),
      );
    }
  }, [isPlayingService, activeServiceItemIndex, id]);

  const handlePlayService = () => {
    if (items.length === 0) return;
    setPlayingService(true);
    setRightTab("timeline");
  };

  const handleStopService = () => {
    setPlayingService(false);
    void catcher(deletePreference(PLAY_STATE_KEY));
  };

  const handleNextItem = () => {
    if (activeServiceItemIndex < items.length - 1) {
      setActiveServiceItemIndex(activeServiceItemIndex + 1);
      return;
    }

    // End of service timeline: stop playback and clear projection.
    setPlayingService(false);
    void catcher(deletePreference(PLAY_STATE_KEY));
    void catcher(stopProjectionAndSongAudio(), { notify: true });
  };

  const handlePrevItem = () => {
    if (activeServiceItemIndex > 0) {
      setActiveServiceItemIndex(activeServiceItemIndex - 1);
    }
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (dateTimerRef.current) clearTimeout(dateTimerRef.current);
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    };
  }, []);

  if (!service) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Play Service Banner */}
      {isPlayingService && (
        <div className="flex items-center gap-3 bg-primary px-4 py-2.5 text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">
              {t("services.liveIndicator")}
            </span>
          </div>
          <span className="text-sm font-semibold">
            {t("services.playService")}
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium tabular-nums">
            {t("services.progressOf", {
              current: activeServiceItemIndex + 1,
              total: items.length,
            })}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-primary-foreground hover:bg-white/15"
              onClick={handlePrevItem}
              disabled={activeServiceItemIndex <= 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-primary-foreground hover:bg-white/15"
              onClick={handleNextItem}
              disabled={items.length === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="ml-2 h-7 px-3 text-xs"
              onClick={handleStopService}
            >
              <Square className="mr-1.5 h-3 w-3" />
              {t("services.stopService")}
            </Button>
          </div>
        </div>
      )}

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
          <DatePicker value={localDate} onChange={handleDateChange} />
          <WeekDayPicker
            serviceId={id}
            currentWeekDay={service.weekDay ?? null}
            allServices={allServices ?? []}
          />
        </div>

        {!isPlayingService && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="shadow-sm"
              onClick={handlePlayService}
              disabled={items.length === 0}
            >
              <Play className="mr-2 h-3.5 w-3.5" />
              {t("services.playService")}
            </Button>
            <Button size="sm" className="shadow-sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              {t("services.addItem")}
            </Button>
          </div>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-0">
        {/* Left panel -- Items list */}
        <div className="overflow-auto border-r border-border bg-surface">
          <ServiceItemList
            items={items}
            serviceDate={service?.date ?? null}
            activeItemIndex={isPlayingService ? activeServiceItemIndex : -1}
            onRemove={removeItem}
            onReorder={reorderItems}
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
            <ServiceTimeline
              items={items}
              activeIndex={isPlayingService ? activeServiceItemIndex : -1}
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
  allServices: Service[];
}

function WeekDayPicker({ serviceId, currentWeekDay, allServices }: WeekDayPickerProps) {
  const { t } = useTranslation();
  const setWeekDay = useSetServiceWeekDay();
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

  // Map day value → the service that owns it (excluding current)
  const takenByService = new Map<number, Service>(
    allServices
      .filter((s) => s.id !== serviceId && s.weekDay !== null)
      .map((s) => [s.weekDay as number, s]),
  );

  const handleClick = (value: number) => {
    // Toggle off: active day clicked → clear
    if (currentWeekDay === value) {
      setWeekDay.mutate({ id: serviceId, weekDay: null });
      return;
    }
    // Taken by another service → open confirmation dialog
    if (takenByService.has(value)) {
      setPendingDay(value);
      return;
    }
    // Free day → assign directly
    setWeekDay.mutate({ id: serviceId, weekDay: value });
  };

  const handleConfirmOverride = () => {
    if (pendingDay !== null) {
      setWeekDay.mutate({ id: serviceId, weekDay: pendingDay });
    }
    setPendingDay(null);
  };

  const conflictingService = pendingDay !== null ? takenByService.get(pendingDay) : null;
  const pendingDayLabel = pendingDay !== null ? DAYS.find((d) => d.value === pendingDay)?.label : null;

  return (
    <>
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-white/4 px-1.5 py-1">
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
                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40"
                  : isTaken
                    ? "cursor-not-allowed text-muted-foreground/30"
                    : "text-muted-foreground/60 hover:bg-white/8 hover:text-foreground",
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
