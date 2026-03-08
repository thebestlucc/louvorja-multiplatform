import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Play, Square, SkipForward, SkipBack } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { catcher } from "../../lib/catcher";
import { useServiceEditor } from "../../hooks/use-service";
import { usePresentationStore } from "../../stores/presentation-store";
import { setSlideContext } from "../../lib/tauri";
import { projectSlideWithType } from "../../lib/projection-playback";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { ServiceItemList } from "../../components/services/service-item-list";
import { ServiceTimeline } from "../../components/services/service-timeline";
import { AddItemModal } from "../../components/services/add-item-modal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import type { ServiceItem, SlideContent } from "../../lib/bindings";

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
};

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

  const {
    setActiveService,
    isPlayingService,
    activeServiceItemIndex,
    setPlayingService,
    setActiveServiceItemIndex,
  } = usePresentationStore();

  // Set active service for cross-module integration
  useEffect(() => {
    setActiveService(id);
    return () => {
      setActiveService(null);
      setPlayingService(false);
    };
  }, [id, setActiveService, setPlayingService]);

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

  const handlePlayService = () => {
    if (items.length === 0) return;
    setPlayingService(true);
    setRightTab("timeline");
  };

  const handleStopService = () => {
    setPlayingService(false);
  };

  const handleNextItem = () => {
    if (activeServiceItemIndex < items.length - 1) {
      setActiveServiceItemIndex(activeServiceItemIndex + 1);
      return;
    }

    // End of service timeline: stop playback and clear projection.
    setPlayingService(false);
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
    return <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Link to="/services">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <Input
          className="max-w-xs font-semibold"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
        />

        <Input
          type="date"
          className="w-40"
          value={localDate}
          onChange={(e) => handleDateChange(e.target.value)}
        />

        <div className="ml-auto flex items-center gap-2">
          {isPlayingService ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrevItem}
                disabled={activeServiceItemIndex <= 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {activeServiceItemIndex + 1}/{items.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextItem}
                disabled={items.length === 0}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStopService}>
                <Square className="mr-2 h-4 w-4" />
                {t("services.stopService")}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePlayService}
                disabled={items.length === 0}
              >
                <Play className="mr-2 h-4 w-4" />
                {t("services.playService")}
              </Button>
              <Button size="sm" onClick={() => setAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("services.addItem")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
        {/* Left panel — Items list */}
        <div className="overflow-auto rounded-lg border border-border">
          <ServiceItemList
            items={items}
            activeItemIndex={isPlayingService ? activeServiceItemIndex : -1}
            onRemove={removeItem}
            onReorder={reorderItems}
            onProject={projectItem}
            onEditItem={editItem}
          />
        </div>

        {/* Right panel — Notes / Timeline */}
        <div className="hidden lg:flex flex-col overflow-hidden rounded-lg border border-border">
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            <button
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                rightTab === "notes"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setRightTab("notes")}
            >
              {t("services.serviceNotes")}
            </button>
            <button
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                rightTab === "timeline"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setRightTab("timeline")}
            >
              {t("services.timeline")}
            </button>
          </div>

          {/* Tab content */}
          {rightTab === "notes" ? (
            <div className="flex flex-1 flex-col gap-3 overflow-auto p-3">
              <textarea
                className="flex-1 resize-none rounded-md border border-border bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
