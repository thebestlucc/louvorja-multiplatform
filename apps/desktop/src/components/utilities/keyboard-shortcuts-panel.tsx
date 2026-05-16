import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_CATEGORY_ORDER,
  comboToDisplayKeys,
  normalizeShortcutCombo,
} from "../../lib/shortcut-definitions";
import { useSetting } from "../../lib/queries";

export const SHORTCUTS_PANEL_OPEN_EVENT = "louvorja.shortcuts.open";

export function openKeyboardShortcutsPanel() {
  window.dispatchEvent(new Event(SHORTCUTS_PANEL_OPEN_EVENT));
}

function ShortcutKeys({
  id,
  combo,
}: {
  id: string;
  combo: string | undefined;
}) {
  if (!combo) {
    return <span className="text-xs text-muted-foreground">---</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {comboToDisplayKeys(combo).map((keyPart) => (
        <kbd
          key={`${id}-${combo}-${keyPart}`}
          className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {keyPart}
        </kbd>
      ))}
    </div>
  );
}

function ShortcutRow({ def }: { def: (typeof SHORTCUT_DEFINITIONS)[number] }) {
  const { t } = useTranslation();
  const { data: localSetting } = useSetting(`shortcut.${def.id}.local`);
  const { data: globalSetting } = useSetting(`shortcut.${def.id}.global`);

  const localCombo = localSetting?.value
    ? normalizeShortcutCombo(localSetting.value, "local")
    : def.defaultLocal;
  const globalCombo = globalSetting?.value
    ? normalizeShortcutCombo(globalSetting.value, "global")
    : def.defaultGlobal;

  const displayCombo = localCombo ?? globalCombo;

  if (def.id === "app-command-palette") {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
        <span className="text-sm text-foreground">{t(def.labelKey)}</span>
        <div className="flex min-w-[16rem] flex-col gap-2 text-right">
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.shortcuts.localLabel")}
            </span>
            <div className="flex justify-end">
              <ShortcutKeys id={`${def.id}-local`} combo={localCombo} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.shortcuts.globalLabel")}
            </span>
            <div className="flex justify-end">
              <ShortcutKeys id={`${def.id}-global`} combo={globalCombo} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-sm text-foreground">{t(def.labelKey)}</span>
      <ShortcutKeys id={def.id} combo={displayCombo} />
    </div>
  );
}

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
      SHORTCUT_DEFINITIONS.filter((def) => {
        if (!normalizedQuery) return true;
        const label = t(def.labelKey).toLowerCase();
        const category = t(`shortcuts.categories.${def.category}`).toLowerCase();
        return label.includes(normalizedQuery) || category.includes(normalizedQuery);
      }),
    [normalizedQuery, t],
  );

  const grouped = useMemo(
    () =>
      SHORTCUT_CATEGORY_ORDER.map((category) => ({
        category,
        entries: filtered.filter((def) => def.category === category),
      })).filter((g) => g.entries.length > 0),
    [filtered],
  );

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
                  {group.entries.map((def) => (
                    <ShortcutRow key={def.id} def={def} />
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
