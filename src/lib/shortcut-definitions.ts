// src/lib/shortcut-definitions.ts
// Single source of truth for all keyboard shortcut definitions.
// Both the shortcuts panel and use-keyboard.ts import from here.

export interface ShortcutDefinition {
  id: string;
  category: "app" | "slides" | "display";
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
    defaultGlobal: "Alt+K",
  },
  {
    id: "app-shortcuts-help",
    category: "app",
    labelKey: "shortcuts.items.openShortcutsHelp",
    defaultLocal: "Meta+/",
    defaultGlobal: "Alt+H",
  },
];

export const SHORTCUT_CATEGORY_ORDER: ShortcutDefinition["category"][] = [
  "app",
  "slides",
  "display",
];

// Resolve a stored combo string into display label array for <kbd> chips.
// e.g. "Shift+F5" → ["Shift", "F5"], "Meta+k" → ["Cmd/Ctrl", "K"]
export function comboToDisplayKeys(combo: string): string[] {
  return combo.split("+").map((part) => {
    switch (part.toLowerCase()) {
      case "meta":
        return "Cmd/Ctrl";
      case "shift":
        return "Shift";
      case "alt":
        return "Alt/Option";
      case "ctrl":
        return "Ctrl";
      default:
        return part.toUpperCase();
    }
  });
}
