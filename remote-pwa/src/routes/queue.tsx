import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Music, ChevronDown, ChevronUp } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

export default function QueueRoute() {
  const { t } = useTranslation();
  const ws = useConnectionStore((s) => s.ws);
  const queue = useConnectionStore((s) => s.currentQueue);

  const [historyOpen, setHistoryOpen] = useState(false);

  const sendCmd = useCallback(
    (op: string, payload: Record<string, unknown> = {}) => {
      ws?.send(op, payload);
    },
    [ws],
  );

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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Now playing */}
      {queue?.nowPlaying && (
        <section className="px-4 py-3">
          <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">
            {t("remote.queue.now_playing")}
          </h3>
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg truncate">{queue.nowPlaying.title}</p>
              {queue.nowPlaying.artist && (
                <p className="text-xs text-fg-muted truncate">{queue.nowPlaying.artist}</p>
              )}
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
            {queue.upNext.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => sendCmd("queue.play", { id: item.id })}
                  className={cn(
                    "w-full text-left rounded-lg border border-border bg-surface-1 p-3",
                    "hover:bg-surface-2 active:scale-[0.99] transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  )}
                >
                  <p className="text-sm font-medium text-fg truncate">{item.title}</p>
                  {item.artist && <p className="text-xs text-fg-muted truncate">{item.artist}</p>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* History — accordion, collapsed by default */}
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
                    <p className="text-sm font-medium text-fg truncate">{item.title}</p>
                    {item.artist && <p className="text-xs text-fg-muted truncate">{item.artist}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
