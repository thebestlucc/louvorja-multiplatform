import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useServiceEditor } from "../../hooks/use-service";
import { usePresentationStore } from "../../stores/presentation-store";
import { ServiceItemList } from "../../components/services/service-item-list";
import { AddItemModal } from "../../components/services/add-item-modal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export const Route = createFileRoute("/services/$serviceId")({
  component: ServiceEditor,
});

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
  } = useServiceEditor({ serviceId: id });

  const { setActiveService } = usePresentationStore();

  // Set active service for cross-module integration
  useEffect(() => {
    setActiveService(id);
    return () => setActiveService(null);
  }, [id, setActiveService]);

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

        <div className="ml-auto">
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("services.addItem")}
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Left panel — Items list */}
        <div className="flex-1 overflow-auto rounded-lg border border-border">
          <ServiceItemList
            items={items}
            onRemove={removeItem}
            onReorder={reorderItems}
          />
        </div>

        {/* Right panel — Notes */}
        <div className="hidden w-72 shrink-0 flex-col gap-3 overflow-auto rounded-lg border border-border p-3 lg:flex">
          <h3 className="text-sm font-medium">{t("services.serviceNotes")}</h3>
          <textarea
            className="flex-1 resize-none rounded-md border border-border bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={t("services.notes")}
            value={localNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
          />
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
