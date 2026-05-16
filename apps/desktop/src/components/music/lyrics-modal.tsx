import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Hymn } from "../../types/hymn";

interface LyricsModalProps {
  hymn: Hymn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LyricsModal({ hymn, open, onOpenChange }: LyricsModalProps) {
  const { t } = useTranslation();
  const stanzas = (hymn.lyrics ?? "").split(/\n\n+/).filter(Boolean);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col p-6 gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">{hymn.title}</Dialog.Title>
              {hymn.author && <p className="text-sm text-muted-foreground">{hymn.author}</p>}
            </div>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto flex flex-col gap-4 text-sm leading-relaxed pr-2">
            {stanzas.length > 0 ? (
              stanzas.map((stanza, i) => (
                <p key={i} className="whitespace-pre-line">{stanza}</p>
              ))
            ) : (
              <p className="text-muted-foreground italic">{t("hymn.lyricsModal.noLyrics")}</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
