// src/lib/shortcut-definitions.ts
// Single source of truth for all keyboard shortcut definitions.
// Both the shortcuts panel and use-keyboard.ts import from here.

export interface ShortcutDefinition {
  id: string;
  category: "app" | "slides" | "display" | "playback";
  labelKey: string; // i18n key, e.g. "shortcuts.items.nextSlide"
  defaultLocal?: string; // key combo for in-app (e.g. "ArrowRight", "F5", "Shift+F5")
  defaultGlobal?: string; // key combo for OS-level (e.g. "Alt+Right")
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "slides-next",
    category: "slides",
    labelKey: "shortcuts.items.nextSlide",
    defaultLocal: "ArrowRight",
    defaultGlobal: "Alt+Right",
  },
  {
    id: "slides-prev",
    category: "slides",
    labelKey: "shortcuts.items.previousSlide",
    defaultLocal: "ArrowLeft",
    defaultGlobal: "Alt+Left",
  },
  {
    id: "slides-clear",
    category: "slides",
    labelKey: "shortcuts.items.clearProjection",
    defaultLocal: "Escape",
  },
  {
    id: "display-projector",
    category: "display",
    labelKey: "shortcuts.items.toggleProjector",
    defaultLocal: "F5",
  },
  {
    id: "display-return",
    category: "display",
    labelKey: "shortcuts.items.toggleReturn",
    defaultLocal: "Shift+F5",
  },
  {
    id: "display-black",
    category: "display",
    labelKey: "shortcuts.items.toggleBlack",
    defaultLocal: "b",
    defaultGlobal: "Alt+B",
  },
  {
    id: "display-logo",
    category: "display",
    labelKey: "shortcuts.items.toggleLogo",
    defaultLocal: "l",
    defaultGlobal: "Alt+L",
  },
  {
    id: "app-command-palette",
    category: "app",
    labelKey: "shortcuts.items.openCommandPalette",
    defaultLocal: "Meta+k",
    defaultGlobal: "CmdOrCtrl+Shift+K",
  },
  {
    id: "app-shortcuts-help",
    category: "app",
    labelKey: "shortcuts.items.openShortcutsHelp",
    defaultLocal: "Meta+/",
    defaultGlobal: "Alt+H",
  },
  {
    id: "playback-play-pause",
    category: "playback",
    labelKey: "shortcuts.items.playPause",
    defaultLocal: "p",
  },
  {
    id: "playback-mute",
    category: "playback",
    labelKey: "shortcuts.items.mute",
    defaultLocal: "m",
  },
  {
    id: "playback-prev-item",
    category: "playback",
    labelKey: "shortcuts.items.prevItem",
    defaultLocal: "[",
  },
  {
    id: "playback-next-item",
    category: "playback",
    labelKey: "shortcuts.items.nextItem",
    defaultLocal: "]",
  },
  {
    id: "playback-stop",
    category: "playback",
    labelKey: "shortcuts.items.stop",
    defaultLocal: "s",
  },
  {
    id: "playback-restart",
    category: "playback",
    labelKey: "shortcuts.items.restart",
    defaultLocal: "r",
  },
  {
    id: "playback-volume-up",
    category: "playback",
    labelKey: "shortcuts.items.volumeUp",
    defaultLocal: "ArrowUp",
  },
  {
    id: "playback-volume-down",
    category: "playback",
    labelKey: "shortcuts.items.volumeDown",
    defaultLocal: "ArrowDown",
  },
];

export const SHORTCUT_CATEGORY_ORDER: ShortcutDefinition["category"][] = [
  "app",
  "slides",
  "playback",
  "display",
];

type ShortcutLayer = "local" | "global";

export type ShortcutKeyboardEventLike = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

function normalizeShortcutKey(key: string, layer: ShortcutLayer): string {
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();

  if (layer === "local") {
    switch (lower) {
      case "right":
        return "ArrowRight";
      case "left":
        return "ArrowLeft";
      case "up":
        return "ArrowUp";
      case "down":
        return "ArrowDown";
      case "space":
        return " ";
      case "esc":
        return "Escape";
      default:
        if (trimmed.length === 1) return trimmed.toLowerCase();
        if (/^f\d+$/i.test(trimmed)) return trimmed.toUpperCase();
        return trimmed;
    }
  }

  switch (lower) {
    case "arrowright":
      return "Right";
    case "arrowleft":
      return "Left";
    case "arrowup":
      return "Up";
    case "arrowdown":
      return "Down";
    case "space":
    case "":
      return "Space";
    case "esc":
      return "Escape";
    default:
      if (trimmed.length === 1) return trimmed.toUpperCase();
      if (/^f\d+$/i.test(trimmed)) return trimmed.toUpperCase();
      return trimmed;
  }
}

function normalizeShortcutModifier(
  part: string,
  layer: ShortcutLayer,
): string | null {
  switch (part.trim().toLowerCase()) {
    case "meta":
    case "cmd":
    case "command":
    case "super":
    case "commandorcontrol":
    case "commandorctrl":
    case "cmdorcontrol":
    case "cmdorctrl":
      return layer === "local" ? "Meta" : "CmdOrCtrl";
    case "ctrl":
    case "control":
      return layer === "local" ? "Meta" : "Ctrl";
    case "alt":
    case "option":
      return "Alt";
    case "shift":
      return "Shift";
    default:
      return null;
  }
}

export function normalizeShortcutCombo(
  combo: string,
  layer: ShortcutLayer,
): string {
  if (!combo.trim()) return "";

  let hasCommand = false;
  let hasAlt = false;
  let hasShift = false;
  let key = "";

  for (const part of combo.split("+")) {
    const modifier = normalizeShortcutModifier(part, layer);
    if (modifier === "Meta" || modifier === "CmdOrCtrl") {
      hasCommand = true;
      continue;
    }
    if (modifier === "Alt") {
      hasAlt = true;
      continue;
    }
    if (modifier === "Shift") {
      hasShift = true;
      continue;
    }

    key = normalizeShortcutKey(part, layer);
  }

  const parts: string[] = [];
  if (hasCommand) parts.push(layer === "local" ? "Meta" : "CmdOrCtrl");
  if (hasShift) parts.push("Shift");
  if (hasAlt) parts.push("Alt");
  if (key) parts.push(key);

  return parts.join("+");
}

export function keyboardEventToShortcutCombo(
  event: ShortcutKeyboardEventLike,
  layer: ShortcutLayer,
): string | null {
  if (["Meta", "Shift", "Alt", "Control"].includes(event.key)) {
    return null;
  }

  const key = normalizeShortcutKey(event.key, layer);
  if (!key) return null;

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    parts.push(layer === "local" ? "Meta" : "CmdOrCtrl");
  }
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");
  parts.push(key);

  return parts.join("+");
}

export function matchesShortcutCombo(
  event: ShortcutKeyboardEventLike,
  combo: string,
): boolean {
  return keyboardEventToShortcutCombo(event, "local") === normalizeShortcutCombo(combo, "local");
}

// Resolve a stored combo string into display label array for <kbd> chips.
// e.g. "Shift+F5" → ["Shift", "F5"], "Meta+k" → ["Cmd/Ctrl", "K"]
export function comboToDisplayKeys(combo: string): string[] {
  return normalizeShortcutCombo(combo, combo.includes("CmdOrCtrl") ? "global" : "local")
    .split("+")
    .map((part) => {
    switch (part.toLowerCase()) {
      case "meta":
      case "cmdorctrl":
        return "Cmd/Ctrl";
      case "shift":
        return "Shift";
      case "alt":
        return "Alt/Option";
      case "ctrl":
        return "Ctrl";
      case "arrowright":
      case "right":
        return "Right";
      case "arrowleft":
      case "left":
        return "Left";
      case "arrowup":
      case "up":
        return "Up";
      case "arrowdown":
      case "down":
        return "Down";
      case "escape":
        return "Esc";
      case " ":
        return "Space";
      default:
        return part.toUpperCase();
    }
  });
}
