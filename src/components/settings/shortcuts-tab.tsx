import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, Circle } from "lucide-react";
import { catcher } from "../../lib/catcher";
import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_CATEGORY_ORDER,
  comboToDisplayKeys,
  keyboardEventToShortcutCombo,
  normalizeShortcutCombo,
} from "../../lib/shortcut-definitions";
import {
  useAllSettings,
  useApplyPresentationBridgeConfig,
  usePresentationBridgeStatus,
  useSetting,
  useSetShortcut,
} from "../../lib/queries";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import type { BridgeConfig } from "../../lib/bindings";

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  enabled: false,
  startWithOs: false,
  targetApp: "power-point-windows",
  shortcutNext: "Alt+Right",
  shortcutPrev: "Alt+Left",
};

// A single shortcut recording cell (local or global layer)
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
  const [conflict, setConflict] = useState<string | null>(null);

  const startRecording = useCallback(() => {
    setRecording(true);
    setConflict(null);
  }, []);

  const stopRecording = useCallback(() => setRecording(false), []);

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        stopRecording();
        return;
      }

      const combo = keyboardEventToShortcutCombo(e, layer);
      if (!combo) return;

      // Conflict check: scan all bindings in the same layer
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

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [recording, allCurrentBindings, def.id, layer, stopRecording, setShortcut, t]);

  // If this shortcut has no layer slot, render empty
  if (!defaultCombo) {
    return <div className="w-28" />;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {recording ? (
          <span className="flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <Circle className="h-2 w-2 animate-pulse fill-primary" />
            {t("settings.shortcuts.recording")}
          </span>
        ) : (
          <>
            <div className="flex min-w-[5rem] gap-1">
              {currentCombo ? (
                comboToDisplayKeys(currentCombo).map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("settings.shortcuts.unset")}
                </span>
              )}
            </div>
            <button
              onClick={startRecording}
              className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              {t("settings.shortcuts.record")}
            </button>
            {currentCombo && currentCombo !== defaultCombo && (
              <button
                onClick={() => {
                  setShortcut.mutate({ id: def.id, layer, value: defaultCombo });
                  setConflict(null);
                }}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                title="Reset to default"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
      {conflict && <p className="text-xs text-destructive">{conflict}</p>}
    </div>
  );
}

// A full action row: label + local cell + global cell
function ShortcutActionRow({
  def,
  allCurrentBindings,
}: {
  def: (typeof SHORTCUT_DEFINITIONS)[number];
  allCurrentBindings: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-start gap-x-6 gap-y-1 rounded-md border border-border bg-background px-4 py-3">
      <span className="self-start pt-1 text-sm text-foreground">{t(def.labelKey)}</span>
      <ShortcutCell def={def} layer="local" allCurrentBindings={allCurrentBindings} />
      <ShortcutCell def={def} layer="global" allCurrentBindings={allCurrentBindings} />
    </div>
  );
}

export function ShortcutsTab() {
  const { t } = useTranslation();
  const { data: allSettings = [] } = useAllSettings();
  const bridgeStatusQuery = usePresentationBridgeStatus();
  const applyBridgeConfig = useApplyPresentationBridgeConfig();
  const bridgeConfig = bridgeStatusQuery.data?.config ?? DEFAULT_BRIDGE_CONFIG;
  const [bridgeShortcutNext, setBridgeShortcutNext] = useState(bridgeConfig.shortcutNext);
  const [bridgeShortcutPrev, setBridgeShortcutPrev] = useState(bridgeConfig.shortcutPrev);

  useEffect(() => {
    setBridgeShortcutNext(bridgeConfig.shortcutNext);
    setBridgeShortcutPrev(bridgeConfig.shortcutPrev);
  }, [bridgeConfig.shortcutNext, bridgeConfig.shortcutPrev]);

  // Build a flat map of default bindings for conflict detection.
  // Key format: "id.layer" → combo string.
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
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("shortcuts.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.shortcuts.description")}
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">{t("settings.bridge.shortcutsTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings.bridge.shortcutsDescription")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("settings.bridge.nextShortcut")}
              </label>
              <Input
                value={bridgeShortcutNext}
                onChange={(event) => setBridgeShortcutNext(event.target.value)}
                placeholder={t("settings.bridge.nextShortcutPlaceholder")}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("settings.bridge.previousShortcut")}
              </label>
              <Input
                value={bridgeShortcutPrev}
                onChange={(event) => setBridgeShortcutPrev(event.target.value)}
                placeholder={t("settings.bridge.previousShortcutPlaceholder")}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={applyBridgeConfig.isPending}
              onClick={() => {
                void catcher(
                  applyBridgeConfig.mutateAsync({
                    ...bridgeConfig,
                    shortcutNext: bridgeShortcutNext.trim() || "Alt+Right",
                    shortcutPrev: bridgeShortcutPrev.trim() || "Alt+Left",
                  }),
                  { notify: true },
                );
              }}
            >
              {t("settings.bridge.saveShortcuts")}
            </Button>
          </div>
        </div>
      </section>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Action</span>
        <span className="w-32 text-center">{t("settings.shortcuts.localLabel")}</span>
        <span className="w-32 text-center">{t("settings.shortcuts.globalLabel")}</span>
      </div>

      {SHORTCUT_CATEGORY_ORDER.map((category) => {
        const defs = SHORTCUT_DEFINITIONS.filter((d) => d.category === category);
        if (defs.length === 0) return null;

        return (
          <section key={category} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(`shortcuts.categories.${category}`)}
            </h3>
            <div className="space-y-2">
              {defs.map((def) => (
                <ShortcutActionRow
                  key={def.id}
                  def={def}
                  allCurrentBindings={allCurrentBindings}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
