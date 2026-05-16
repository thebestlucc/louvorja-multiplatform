import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Circle, Info } from "lucide-react";
import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_CATEGORY_ORDER,
  comboToDisplayKeys,
  keyboardEventToShortcutCombo,
  normalizeShortcutCombo,
} from "../../lib/shortcut-definitions";
import {
  useAllSettings,
  useSetting,
  useSetShortcut,
} from "../../lib/queries";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

// Fixed column widths keep every row perfectly aligned — any combo up to
// "Cmd/Ctrl + Shift + K" (~148px) fits comfortably inside 11rem (176px).
const SHORTCUT_CELL_WIDTH = "w-44";
const GRID_TEMPLATE = "grid-cols-[1fr_11rem_11rem]";

// ---------------------------------------------------------------------------
// Column-label tooltip
// ---------------------------------------------------------------------------
function ColumnLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className="inline-flex w-fit cursor-help items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground">
          {label}
          <Info className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// ShortcutCell – one recording slot (local OR global layer)
// ---------------------------------------------------------------------------
function ShortcutCell({
  def,
  layer,
  allCurrentBindings,
}: {
  def: (typeof SHORTCUT_DEFINITIONS)[number];
  layer: "local" | "global";
  allCurrentBindings: Record<string, string>;
}) {
  const { t } = useTranslation();
  const { data: setting } = useSetting(`shortcut.${def.id}.${layer}`);
  const setShortcut = useSetShortcut();

  const defaultComboRaw = layer === "local" ? def.defaultLocal : def.defaultGlobal;
  const defaultCombo = defaultComboRaw
    ? normalizeShortcutCombo(defaultComboRaw, layer)
    : "";
  const currentCombo = setting?.value
    ? normalizeShortcutCombo(setting.value, layer)
    : defaultCombo;

  const [recording, setRecording] = useState(false);
  const [holdingModifiers, setHoldingModifiers] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const startRecording = useCallback(() => {
    setRecording(true);
    setHoldingModifiers(false);
    setConflict(null);
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(false);
    setHoldingModifiers(false);
  }, []);

  // Keyboard capture while recording
  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        stopRecording();
        return;
      }

      const rawCombo = keyboardEventToShortcutCombo(e, layer);
      if (!rawCombo) {
        // Modifier-only press (Shift, Alt, Meta, Control) — signal the user
        // to press a non-modifier key rather than silently ignoring.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          setHoldingModifiers(true);
        }
        return;
      }
      const combo = normalizeShortcutCombo(rawCombo, layer);

      // Conflict check within same layer
      const layerSuffix = `.${layer}`;
      const conflictEntry = Object.entries(allCurrentBindings).find(
        ([key, val]) =>
          val === combo &&
          key.endsWith(layerSuffix) &&
          key !== `${def.id}.${layer}`,
      );

      if (conflictEntry) {
        const conflictDefId = conflictEntry[0].replace(layerSuffix, "");
        const conflictDef = SHORTCUT_DEFINITIONS.find((d) => d.id === conflictDefId);
        const conflictLabel = conflictDef ? t(conflictDef.labelKey) : conflictDefId;
        setConflict(t("settings.shortcuts.conflict", { action: conflictLabel }));
        stopRecording();
        return;
      }

      setShortcut.mutate({ id: def.id, layer, value: combo });
      stopRecording();
    };

    // Reset the "holding modifiers" hint when all modifiers are released
    const keyupHandler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        setHoldingModifiers(false);
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    window.addEventListener("keyup", keyupHandler, { capture: true });
    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
      window.removeEventListener("keyup", keyupHandler, { capture: true });
    };
  }, [recording, allCurrentBindings, def.id, layer, stopRecording, setShortcut, t]);

  // No slot for this layer (e.g. no global default)
  if (!defaultCombo) {
    return (
      <div className={`flex h-8 ${SHORTCUT_CELL_WIDTH} items-center text-sm text-muted-foreground/40`}>
        &mdash;
      </div>
    );
  }

  const isCustomized = currentCombo && currentCombo !== defaultCombo;

  return (
    <div className="flex flex-col gap-1">
      {recording ? (
        /* Recording state — with modifier-only hint */
        <button
          onClick={stopRecording}
          className={`flex h-8 ${SHORTCUT_CELL_WIDTH} cursor-pointer items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10`}
        >
          <Circle className="h-2 w-2 flex-shrink-0 animate-pulse fill-primary" />
          <span className="truncate">
            {holdingModifiers
              ? t("settings.shortcuts.holdKeyHint")
              : t("settings.shortcuts.recording")}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          {/* Key badges — clickable to start recording */}
          <button
            onClick={startRecording}
            className={`flex h-8 ${SHORTCUT_CELL_WIDTH} cursor-pointer items-center gap-1 overflow-visible rounded-md border border-border bg-surface/50 px-2 transition-colors hover:border-primary/40 hover:bg-surface`}
            title={t("settings.shortcuts.record")}
          >
            {currentCombo ? (
              comboToDisplayKeys(currentCombo).map((k, i) => (
                <kbd
                  key={`${k}-${i}`}
                  className="flex-shrink-0 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground/80"
                >
                  {k}
                </kbd>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                {t("settings.shortcuts.unset")}
              </span>
            )}
          </button>

          {/* Reset to default */}
          {isCustomized && (
            <button
              onClick={() => {
                setShortcut.mutate({ id: def.id, layer, value: defaultCombo });
                setConflict(null);
              }}
              className="flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
              title={t("settings.shortcuts.clear")}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {conflict && <p className="text-xs text-destructive">{conflict}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShortcutsTab – main tab content
// ---------------------------------------------------------------------------
export function ShortcutsTab() {
  const { t } = useTranslation();
  const { data: allSettings = [] } = useAllSettings();

  // Build conflict-detection map: "id.layer" -> normalized combo
  const allCurrentBindings = {
    ...Object.fromEntries(
      SHORTCUT_DEFINITIONS.flatMap((def) => {
        const entries: [string, string][] = [];
        if (def.defaultLocal) {
          entries.push([
            `${def.id}.local`,
            normalizeShortcutCombo(def.defaultLocal, "local"),
          ]);
        }
        if (def.defaultGlobal) {
          entries.push([
            `${def.id}.global`,
            normalizeShortcutCombo(def.defaultGlobal, "global"),
          ]);
        }
        return entries;
      }),
    ),
    ...allSettings.reduce<Record<string, string>>((bindings, setting) => {
      const match = /^shortcut\.(.+)\.(local|global)$/.exec(setting.key);
      if (!match || !setting.value) return bindings;

      const [, id, layer] = match;
      bindings[`${id}.${layer}`] = normalizeShortcutCombo(
        setting.value,
        layer as "local" | "global",
      );
      return bindings;
    }, {}),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("shortcuts.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.shortcuts.description")}
        </p>
      </div>

      {/* Category sections */}
      {SHORTCUT_CATEGORY_ORDER.map((category) => {
        const defs = SHORTCUT_DEFINITIONS.filter((d) => d.category === category);
        if (defs.length === 0) return null;

        return (
          <section key={category} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(`shortcuts.categories.${category}`)}
            </h3>

            <div className="rounded-lg border border-border bg-card">
              {/* Column headers */}
              <div className={`grid ${GRID_TEMPLATE} items-center gap-x-4 border-b border-border px-4 py-2`}>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("settings.shortcuts.actionLabel")}
                </span>
                <ColumnLabel
                  label={t("settings.shortcuts.localLabel")}
                  tooltip={t("settings.shortcuts.localTooltip")}
                />
                <ColumnLabel
                  label={t("settings.shortcuts.globalLabel")}
                  tooltip={t("settings.shortcuts.globalTooltip")}
                />
              </div>

              {/* Rows */}
              {defs.map((def, idx) => (
                <div
                  key={def.id}
                  className={`grid ${GRID_TEMPLATE} items-center gap-x-4 px-4 py-2.5 ${
                    idx < defs.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  <span className="text-sm text-foreground">{t(def.labelKey)}</span>
                  <ShortcutCell def={def} layer="local" allCurrentBindings={allCurrentBindings} />
                  <ShortcutCell def={def} layer="global" allCurrentBindings={allCurrentBindings} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
