import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Music,
  BookOpen,
  Presentation,
  StickyNote,
  Link2,
  FileIcon,
  ChevronLeft,
} from "lucide-react";
import { useHymns, usePresentations, useBibleVersions, useBooks, useVerses } from "../../lib/queries";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import type { ServiceItemType } from "../../types/service";
import { CoverImage } from "../media/cover-image";
import { LibraryBrowser } from "../media/library-browser";
import type { Hymn, Presentation as PresentationType, BibleVersion, Book, Verse } from "../../lib/bindings";
import { catcherSync } from "../../lib/catcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  onAdd: (itemType: string, title: string, itemId: number | null, notes: string | null) => void;
}

const ITEM_TYPES: { type: ServiceItemType; icon: typeof Music; color: string }[] = [
  { type: "hymn", icon: Music, color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
  { type: "bible", icon: BookOpen, color: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" },
  { type: "presentation", icon: Presentation, color: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20" },
  { type: "annotation", icon: StickyNote, color: "bg-green-500/10 text-green-600 hover:bg-green-500/20" },
  { type: "url", icon: Link2, color: "bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20" },
  { type: "file", icon: FileIcon, color: "bg-gray-500/10 text-gray-600 hover:bg-gray-500/20" },
];

export function AddItemModal({ open, onOpenChange, onAdd }: AddItemModalProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ServiceItemType | null>(null);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) setSelectedType(null);
  }, [open]);

  const handleAdd = (itemType: string, title: string, itemId: number | null, notes: string | null) => {
    onAdd(itemType, title, itemId, notes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-5 pt-5 pb-3 mb-6">
          {selectedType && (
            <button
              onClick={() => setSelectedType(null)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <DialogTitle className="text-base">
            {selectedType
              ? t(`services.itemTypes.${selectedType}`)
              : t("services.addItem")}
          </DialogTitle>
        </div>

        {/* Content */}
        <div className="px-5 pb-5">
          {!selectedType ? (
            /* Step 1: Type picker grid */
            <div className="grid grid-cols-3 gap-2">
              {ITEM_TYPES.map(({ type, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-lg p-4 transition-colors duration-150",
                    color,
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium">
                    {t(`services.itemTypes.${type}`)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            /* Step 2: Type-specific form */
            <div className="pt-1">
              {selectedType === "hymn" && <HymnForm onAdd={handleAdd} />}
              {selectedType === "bible" && <BibleForm onAdd={handleAdd} />}
              {selectedType === "presentation" && <PresentationForm onAdd={handleAdd} />}
              {selectedType === "annotation" && <AnnotationForm onAdd={handleAdd} />}
              {selectedType === "url" && <UrlForm onAdd={handleAdd} />}
              {selectedType === "file" && <FileForm onAdd={handleAdd} />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Type-specific forms ──────────────────────────────────── */

function HymnForm({ onAdd }: { onAdd: AddItemModalProps["onAdd"] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: hymns } = useHymns(query);

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("hymnal.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <ScrollArea className="h-56">
        <div className="flex flex-col gap-0.5">
          {(hymns ?? []).map((hymn: Hymn) => (
            <button
              key={hymn.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
              onClick={() => onAdd("hymn", hymn.title, hymn.id, null)}
            >
              <CoverImage
                path={hymn.coverPath}
                title={hymn.title}
                className="h-7 w-7 rounded shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  {hymn.number != null && (
                    <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded bg-blue-500/10 text-[10px] font-semibold tabular-nums text-blue-600">
                      #{hymn.number}
                    </span>
                  )}
                  <span className="truncate font-medium">{hymn.title}</span>
                </div>
                {hymn.album && (
                  <span className="truncate text-[10px] text-muted-foreground">{hymn.album}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function BibleForm({ onAdd }: { onAdd: AddItemModalProps["onAdd"] }) {
  const { t } = useTranslation();
  const [versionId, setVersionId] = useState(0);
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState(0);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);

  const { data: versions } = useBibleVersions();
  const { data: books } = useBooks(versionId);
  const { data: verses } = useVerses(versionId, book, chapter);

  useEffect(() => {
    if (versions && versions.length > 0 && versionId === 0) {
      setVersionId(versions[0].id);
    }
  }, [versions, versionId]);

  const currentVersion = versions?.find((v: BibleVersion) => v.id === versionId);
  const currentBook = books?.find((b: Book) => b.name === book);

  const toggleVerse = (v: number) => {
    setSelectedVerses((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b),
    );
  };

  const handleAdd = () => {
    if (!book || !chapter || selectedVerses.length === 0) return;
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const range = sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`;
    const title = `${book} ${chapter}:${range}${currentVersion ? ` (${currentVersion.abbreviation})` : ""}`;
    const verseSet = new Set(sorted);
    const verseTexts = (verses ?? [])
      .filter((v: Verse) => verseSet.has(v.verse))
      .map((v: Verse) => `${v.verse} ${v.text}`)
      .join("\n");
    onAdd("bible", title, null, verseTexts || null);
  };

  const handleBack = () => {
    if (chapter > 0) { setChapter(0); setSelectedVerses([]); }
    else if (book) { setBook(""); }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Version buttons */}
      {versions && versions.length > 1 && (
        <div className="flex gap-1.5">
          {versions.map((v: BibleVersion) => (
            <Button
              key={v.id}
              variant={v.id === versionId ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => { setVersionId(v.id); setBook(""); setChapter(0); setSelectedVerses([]); }}
            >
              {v.abbreviation}
            </Button>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      {book && (
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={handleBack} className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-medium">{book}</span>
          {chapter > 0 && <span className="text-muted-foreground">{chapter}</span>}
          {selectedVerses.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {selectedVerses.length} {t("bible.verses").toLowerCase()}
            </span>
          )}
        </div>
      )}

      {/* Book list */}
      {!book && (
        <ScrollArea className="h-56">
          <div className="grid grid-cols-3 gap-1">
            {(books ?? []).map((b: Book) => (
              <button
                key={b.name}
                className="cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover"
                onClick={() => setBook(b.name)}
              >
                {b.name}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Chapter grid */}
      {book && chapter === 0 && currentBook && (
        <ScrollArea className="h-56">
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: currentBook.chapterCount }, (_, i) => i + 1).map((ch) => (
              <button
                key={ch}
                className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-border text-xs font-medium transition-colors hover:bg-surface-hover"
                onClick={() => setChapter(ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Verse picker */}
      {book && chapter > 0 && (
        <>
          <ScrollArea className="h-44">
            {(() => {
              const selectedVerseSet = new Set(selectedVerses);
              return (
            <div className="grid grid-cols-8 gap-1.5">
              {(verses ?? []).map((v: Verse) => (
                <button
                  key={v.verse}
                  className={cn(
                    "flex h-7 cursor-pointer items-center justify-center rounded-md text-xs font-medium transition-colors duration-150",
                    selectedVerseSet.has(v.verse)
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-surface-hover",
                  )}
                  onClick={() => toggleVerse(v.verse)}
                >
                  {v.verse}
                </button>
              ))}
            </div>
              );
            })()}
          </ScrollArea>
          <Button size="sm" disabled={selectedVerses.length === 0} onClick={handleAdd}>
            {t("actions.add")}
          </Button>
        </>
      )}
    </div>
  );
}

function PresentationForm({ onAdd }: { onAdd: AddItemModalProps["onAdd"] }) {
  const { data: presentations } = usePresentations();

  return (
    <ScrollArea className="h-56">
      <div className="flex flex-col gap-0.5">
        {(presentations ?? []).map((pres: PresentationType) => (
          <button
            key={pres.id}
            className="cursor-pointer rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
            onClick={() => onAdd("presentation", pres.title, pres.id, null)}
          >
            <span className="truncate">{pres.title}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function AnnotationForm({ onAdd }: { onAdd: AddItemModalProps["onAdd"] }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("services.title")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="rounded-md border border-border bg-transparent p-2.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
        rows={3}
        placeholder={t("services.notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button size="sm" disabled={title.trim().length === 0} onClick={() => onAdd("annotation", title.trim(), null, notes.trim() || null)}>
        {t("actions.add")}
      </Button>
    </div>
  );
}

function UrlForm({ onAdd }: { onAdd: AddItemModalProps["onAdd"] }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const [validUrlData, urlError] = catcherSync(() => new URL(url));
  const isValidUrl = !urlError && !!validUrlData;

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("services.urlTitlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <Input
        type="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      {url.length > 0 && !isValidUrl && (
        <p className="text-xs text-destructive">{t("services.invalidUrl")}</p>
      )}
      <Button size="sm" disabled={!isValidUrl || title.trim().length === 0} onClick={() => onAdd("url", title.trim(), null, url)}>
        {t("actions.add")}
      </Button>
    </div>
  );
}

function FileForm({ onAdd }: { onAdd: AddItemModalProps["onAdd"] }) {
  const { t } = useTranslation();
  const [filePath, setFilePath] = useState("");

  const handleBrowse = async () => {
    const selected = await openFileDialog({ multiple: false });
    if (selected && !Array.isArray(selected)) setFilePath(selected);
  };

  const fileName = filePath ? filePath.split(/[\\/]/).pop() ?? filePath : "";

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="upload">{t("services.fileTabs.upload", "Local File")}</TabsTrigger>
        <TabsTrigger value="library">{t("services.fileTabs.library", "Library")}</TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input readOnly placeholder={t("services.filePlaceholder")} value={filePath} className="flex-1" />
          <Button size="sm" variant="outline" onClick={handleBrowse}>
            {t("services.browse")}
          </Button>
        </div>
        <Button size="sm" disabled={filePath.length === 0} onClick={() => onAdd("file", fileName, null, filePath)}>
          {t("actions.add")}
        </Button>
      </TabsContent>

      <TabsContent value="library">
        <LibraryBrowser onSelect={(name, path) => onAdd("file", name, null, path)} />
      </TabsContent>
    </Tabs>
  );
}
