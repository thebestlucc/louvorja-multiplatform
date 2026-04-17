import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Music, BookOpen, Film, Presentation, ChevronDown, ChevronUp, Trash2, Play, X } from "lucide-react";
import { useConnectionStore, type QueueItem } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

function KindIcon({ kind }: { kind?: QueueItem["kind"] }) {
  const cls = "h-3.5 w-3.5 flex-shrink-0 text-fg-muted";
  switch (kind) {
    case "bible":        return <BookOpen className={cls} aria-hidden="true" />;
    case "video":        return <Film className={cls} aria-hidden="true" />;
    case "presentation": return <Presentation className={cls} aria-hidden="true" />;
    default:             return <Music className={cls} aria-hidden="true" />;
  }
}

function ItemContent({ item }: { item: QueueItem }) {
  if (item.kind === "video" && item.thumbnail) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={item.thumbnail}
          alt=""
          className="h-10 w-16 rounded object-cover flex-shrink-0 bg-surface-2"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg truncate">{item.title}</p>
          {item.duration != null && (
            <p className="text-xs text-fg-muted">{formatDuration(item.duration)}</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 min-w-0">
      <KindIcon kind={item.kind} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg truncate">{item.title}</p>
        {item.artist && <p className="text-xs text-fg-muted truncate">{item.artist}</p>}
      </div>
    </div>
  );
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function QueueRoute() {
  const { t } = useTranslation();
  const ws = useConnectionStore((s) => s.ws);
  const queue = useConnectionStore((s) => s.currentQueue);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const sendCmd = useCallback(
    (op: string, payload: Record<string, unknown> = {}) => {
      ws?.send(op, payload);
    },
    [ws],
  );

  const handleTap = useCallback((item: QueueItem) => {
    setSelectedItem((prev) => (prev?.id === item.id ? null : item));
  }, []);

  const handlePlayNow = useCallback(() => {
    if (!selectedItem) return;
    sendCmd("queue.play", { id: selectedItem.id });
    setSelectedItem(null);
  }, [selectedItem, sendCmd]);

  const handleDelete = useCallback(() => {
    if (!selectedItem) return;
    sendCmd("queue.remove", { id: selectedItem.id });
    setSelectedItem(null);
  }, [selectedItem, sendCmd]);

  const isEmpty = !queue || (!queue.nowPlaying && queue.upNext.length === 0 && queue.history.length === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3 p-6">
        <Music className="h-10 w-10 text-fg-subtle" aria-hidden="true" />
        <p className="text-sm text-fg-muted">{t("remote.queue.empty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-16">
      {/* Now playing */}
      {queue?.nowPlaying && (
        <section className="px-4 py-3">
          <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">
            {t("remote.queue.now_playing")}
          </h3>
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <ItemContent item={queue.nowPlaying} />
            </div>
          </div>
        </section>
      )}

      {/* Up next */}
      {queue && queue.upNext.length > 0 && (
        <section className="px-4 py-2">
          <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">
            {t("remote.queue.up_next")}
          </h3>
          <ul className="space-y-1">
            {queue.upNext.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleTap(item)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3",
                      "active:scale-[0.99] transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface-1 hover:bg-surface-2",
                    )}
                  >
                    <ItemContent item={item} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* History — accordion */}
      {queue && queue.history.length > 0 && (
        <section className="px-4 py-2">
          <button
            type="button"
            aria-expanded={historyOpen}
            aria-controls="queue-history-list"
            onClick={() => setHistoryOpen((prev) => !prev)}
            className="flex items-center justify-between w-full mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
              {t("remote.queue.history")}
            </h3>
            {historyOpen ? (
              <ChevronUp className="h-4 w-4 text-fg-muted" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-fg-muted" aria-hidden="true" />
            )}
          </button>
          {historyOpen && (
            <ul id="queue-history-list" className="space-y-1 opacity-60">
              {queue.history.map((item) => (
                <li key={item.id}>
                  <div className="rounded-lg border border-border p-3">
                    <ItemContent item={item} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Bottom action bar — shown when a queue item is selected */}
      {selectedItem && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface shadow-lg pb-safe animate-[slideUp_200ms_ease-out]">
          <div className="flex items-center gap-1.5 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              aria-label={t("remote.queue.action_dismiss")}
              className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 flex-shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="text-xs text-fg-muted truncate flex-1 min-w-0">{selectedItem.title}</span>
            <button
              type="button"
              onClick={handleDelete}
              aria-label={t("remote.queue.action_remove")}
              className={cn(
                "h-9 px-3 rounded-lg text-xs font-medium border border-destructive/30 bg-destructive/10 text-destructive",
                "flex items-center gap-1.5 active:scale-[0.98] transition-transform flex-shrink-0",
              )}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden min-[360px]:inline">{t("remote.queue.action_remove")}</span>
            </button>
            <button
              type="button"
              onClick={handlePlayNow}
              aria-label={t("remote.queue.action_play_now")}
              className={cn(
                "h-9 px-3 rounded-lg text-xs font-semibold bg-primary text-white",
                "flex items-center gap-1.5 active:scale-[0.98] transition-transform flex-shrink-0",
              )}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span className="hidden min-[360px]:inline">{t("remote.queue.action_play_now")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
