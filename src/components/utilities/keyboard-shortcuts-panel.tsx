import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

export const SHORTCUTS_PANEL_OPEN_EVENT = "louvorja.shortcuts.open";

export function openKeyboardShortcutsPanel() {
  window.dispatchEvent(new Event(SHORTCUTS_PANEL_OPEN_EVENT));
}

interface ShortcutEntry {
  id: string;
  category: "app" | "slides" | "display" | "utilities";
  keys: string[];
  labelKey: string;
}

const SHORTCUT_CATEGORY_ORDER: ShortcutEntry["category"][] = [
  "app",
  "slides",
  "display",
  "utilities",
];

const SHORTCUTS: ShortcutEntry[] = [
  {
    id: "global-command-palette",
    category: "app",
    keys: ["Cmd/Ctrl", "K"],
    labelKey: "shortcuts.items.openCommandPalette",
  },
  {
    id: "global-shortcuts-help",
    category: "app",
    keys: ["Cmd/Ctrl", "/"],
    labelKey: "shortcuts.items.openShortcutsHelp",
  },
  {
    id: "navigation-next-slide",
    category: "slides",
    keys: ["Arrow Right / Space / PageDown"],
    labelKey: "shortcuts.items.nextSlide",
  },
  {
    id: "navigation-prev-slide",
    category: "slides",
    keys: ["Arrow Left / PageUp"],
    labelKey: "shortcuts.items.previousSlide",
  },
  {
    id: "navigation-clear-slide",
    category: "slides",
    keys: ["Escape"],
    labelKey: "shortcuts.items.clearProjection",
  },
  {
    id: "display-toggle-projector",
    category: "display",
    keys: ["F5"],
    labelKey: "shortcuts.items.toggleProjector",
  },
  {
    id: "display-toggle-return",
    category: "display",
    keys: ["Shift", "F5"],
    labelKey: "shortcuts.items.toggleReturn",
  },
  {
    id: "display-toggle-black",
    category: "display",
    keys: ["B"],
    labelKey: "shortcuts.items.toggleBlack",
  },
  {
    id: "display-toggle-logo",
    category: "display",
    keys: ["L"],
    labelKey: "shortcuts.items.toggleLogo",
  },
  {
    id: "utilities-timer-project",
    category: "utilities",
    keys: ["Cmd/Ctrl", "K", "Timer"],
    labelKey: "shortcuts.items.projectTimer",
  },
  {
    id: "utilities-clock-project",
    category: "utilities",
    keys: ["Cmd/Ctrl", "K", "Clock"],
    labelKey: "shortcuts.items.projectClock",
  },
  {
    id: "utilities-lottery-project",
    category: "utilities",
    keys: ["Cmd/Ctrl", "K", "Lottery"],
    labelKey: "shortcuts.items.projectLottery",
  },
];

export function KeyboardShortcutsPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(SHORTCUTS_PANEL_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(SHORTCUTS_PANEL_OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      SHORTCUTS.filter((entry) => {
        if (!normalizedQuery) {
          return true;
        }

        const label = t(entry.labelKey).toLowerCase();
        const category = t(`shortcuts.categories.${entry.category}`).toLowerCase();
        const keys = entry.keys.join(" ").toLowerCase();
        return label.includes(normalizedQuery)
          || category.includes(normalizedQuery)
          || keys.includes(normalizedQuery);
      }),
    [normalizedQuery, t],
  );

  const grouped = useMemo(() => {
    return SHORTCUT_CATEGORY_ORDER.map((category) => ({
      category,
      entries: filtered.filter((entry) => entry.category === category),
    })).filter((group) => group.entries.length > 0);
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("shortcuts.searchPlaceholder")}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("shortcuts.noResults")}</p>
          ) : (
            grouped.map((group) => (
              <section key={group.category} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`shortcuts.categories.${group.category}`)}
                </h3>
                <div className="space-y-2">
                  {group.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <span className="text-sm text-foreground">{t(entry.labelKey)}</span>
                      <div className="flex flex-wrap gap-1">
                        {entry.keys.map((keyPart) => (
                          <kbd
                            key={`${entry.id}-${keyPart}`}
                            className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {keyPart}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
