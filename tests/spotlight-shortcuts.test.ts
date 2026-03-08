import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  SHORTCUT_DEFINITIONS,
  comboToDisplayKeys,
  keyboardEventToShortcutCombo,
  matchesShortcutCombo,
  normalizeShortcutCombo,
  type ShortcutKeyboardEventLike,
} from "../src/lib/shortcut-definitions";

function shortcutEvent(
  overrides: Partial<ShortcutKeyboardEventLike>,
): ShortcutKeyboardEventLike {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

test("spotlight definition uses the expected local and global defaults", () => {
  const spotlight = SHORTCUT_DEFINITIONS.find(
    (definition) => definition.id === "app-command-palette",
  );

  assert.ok(spotlight);
  assert.equal(spotlight.defaultLocal, "Meta+k");
  assert.equal(spotlight.defaultGlobal, "CmdOrCtrl+Shift+K");
});

test("bridge-owned slide navigation shortcuts are not exposed as app global bindings", () => {
  const nextSlide = SHORTCUT_DEFINITIONS.find(
    (definition) => definition.id === "slides-next",
  );
  const previousSlide = SHORTCUT_DEFINITIONS.find(
    (definition) => definition.id === "slides-prev",
  );
  const blackScreen = SHORTCUT_DEFINITIONS.find(
    (definition) => definition.id === "display-black",
  );

  assert.ok(nextSlide);
  assert.ok(previousSlide);
  assert.ok(blackScreen);
  assert.equal(nextSlide.defaultGlobal, undefined);
  assert.equal(previousSlide.defaultGlobal, undefined);
  assert.equal(nextSlide.globalOwner, "bridge");
  assert.equal(previousSlide.globalOwner, "bridge");
  assert.equal(blackScreen.defaultGlobal, "Alt+B");
  assert.equal(blackScreen.globalOwner, "app");
});

test("matches Meta+k for both macOS and control-based keyboard events", () => {
  assert.equal(
    matchesShortcutCombo(shortcutEvent({ key: "k", metaKey: true }), "Meta+k"),
    true,
  );
  assert.equal(
    matchesShortcutCombo(shortcutEvent({ key: "k", ctrlKey: true }), "Meta+k"),
    true,
  );
  assert.equal(
    matchesShortcutCombo(shortcutEvent({ key: "k", shiftKey: true, metaKey: true }), "Meta+k"),
    false,
  );
});

test("normalizes command-based global combos to Tauri-compatible format", () => {
  assert.equal(
    normalizeShortcutCombo("Meta+Shift+k", "global"),
    "CmdOrCtrl+Shift+K",
  );
  assert.equal(
    normalizeShortcutCombo("Cmd+Shift+k", "global"),
    "CmdOrCtrl+Shift+K",
  );
});

test("records global keyboard events using the canonical command format", () => {
  assert.equal(
    keyboardEventToShortcutCombo(
      shortcutEvent({ key: "k", metaKey: true, shiftKey: true }),
      "global",
    ),
    "CmdOrCtrl+Shift+K",
  );
  assert.equal(
    keyboardEventToShortcutCombo(
      shortcutEvent({ key: "k", ctrlKey: true, shiftKey: true }),
      "global",
    ),
    "CmdOrCtrl+Shift+K",
  );
});

test("formats spotlight helper display keys for local and global bindings", () => {
  assert.deepEqual(comboToDisplayKeys("Meta+k"), ["Cmd/Ctrl", "K"]);
  assert.deepEqual(comboToDisplayKeys("CmdOrCtrl+Shift+K"), [
    "Cmd/Ctrl",
    "Shift",
    "K",
  ]);
});
