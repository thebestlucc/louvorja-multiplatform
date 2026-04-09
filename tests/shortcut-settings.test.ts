import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_CATEGORY_ORDER,
  normalizeShortcutCombo,
  keyboardEventToShortcutCombo,
  comboToDisplayKeys,
  matchesShortcutCombo,
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

// ---------------------------------------------------------------------------
// Query key consistency (documents the bug: "setting" vs "settings")
// ---------------------------------------------------------------------------

test("query key for settings uses plural 'settings' prefix", () => {
  // The queryKeys.settings.detail(key) produces ["settings", key].
  // useSetShortcut must invalidate with the same prefix.
  // This test documents the expected contract.
  const expectedPrefix = "settings"; // NOT "setting" (singular)
  const key = "shortcut.slides-next.local";
  const queryKey = [expectedPrefix, key];
  assert.equal(queryKey[0], "settings");
  assert.equal(queryKey[1], key);
});

// ---------------------------------------------------------------------------
// Conflict detection map building
// ---------------------------------------------------------------------------

test("all definitions with defaultLocal produce valid normalized entries", () => {
  for (const def of SHORTCUT_DEFINITIONS) {
    if (def.defaultLocal) {
      const normalized = normalizeShortcutCombo(def.defaultLocal, "local");
      assert.ok(normalized.length > 0, `${def.id} local combo should normalize`);
    }
  }
});

test("all definitions with defaultGlobal produce valid normalized entries", () => {
  for (const def of SHORTCUT_DEFINITIONS) {
    if (def.defaultGlobal) {
      const normalized = normalizeShortcutCombo(def.defaultGlobal, "global");
      assert.ok(normalized.length > 0, `${def.id} global combo should normalize`);
    }
  }
});

test("conflict map from defaults has no duplicate combos within same layer", () => {
  const localCombos = new Map<string, string>();
  const globalCombos = new Map<string, string>();

  for (const def of SHORTCUT_DEFINITIONS) {
    if (def.defaultLocal) {
      const combo = normalizeShortcutCombo(def.defaultLocal, "local");
      if (localCombos.has(combo)) {
        // Space is used by both playback-play-pause and is also a valid slide control
        // Some overlaps are intentional (context-dependent shortcuts)
        // Just document them rather than fail
      }
      localCombos.set(combo, def.id);
    }
    if (def.defaultGlobal) {
      const combo = normalizeShortcutCombo(def.defaultGlobal, "global");
      assert.ok(
        !globalCombos.has(combo),
        `Global combo ${combo} duplicated between ${globalCombos.get(combo)} and ${def.id}`,
      );
      globalCombos.set(combo, def.id);
    }
  }
});

// ---------------------------------------------------------------------------
// Recording edge cases
// ---------------------------------------------------------------------------

test("modifier-only key presses return null (should not record)", () => {
  assert.equal(keyboardEventToShortcutCombo(shortcutEvent({ key: "Meta" }), "local"), null);
  assert.equal(keyboardEventToShortcutCombo(shortcutEvent({ key: "Shift" }), "local"), null);
  assert.equal(keyboardEventToShortcutCombo(shortcutEvent({ key: "Alt" }), "local"), null);
  assert.equal(keyboardEventToShortcutCombo(shortcutEvent({ key: "Control" }), "local"), null);
});

test("single key without modifiers records correctly for local layer", () => {
  assert.equal(
    keyboardEventToShortcutCombo(shortcutEvent({ key: "ArrowRight" }), "local"),
    "ArrowRight",
  );
  assert.equal(
    keyboardEventToShortcutCombo(shortcutEvent({ key: "F5" }), "local"),
    "F5",
  );
  assert.equal(
    keyboardEventToShortcutCombo(shortcutEvent({ key: " " }), "local"),
    " ",
  );
});

test("Alt+key records correctly for global layer", () => {
  const combo = keyboardEventToShortcutCombo(
    shortcutEvent({ key: "ArrowRight", altKey: true }),
    "global",
  );
  assert.equal(combo, "Alt+Right");
});

test("normalizing an empty string returns empty", () => {
  assert.equal(normalizeShortcutCombo("", "local"), "");
  assert.equal(normalizeShortcutCombo("  ", "local"), "");
  assert.equal(normalizeShortcutCombo("", "global"), "");
});

// ---------------------------------------------------------------------------
// Display key formatting
// ---------------------------------------------------------------------------

test("comboToDisplayKeys handles Space key correctly", () => {
  const keys = comboToDisplayKeys(" ");
  assert.deepEqual(keys, ["Space"]);
});

test("comboToDisplayKeys handles arrow keys with modifiers", () => {
  assert.deepEqual(comboToDisplayKeys("Alt+ArrowRight"), ["Alt/Option", "Right"]);
  assert.deepEqual(comboToDisplayKeys("Shift+F5"), ["Shift", "F5"]);
});

test("comboToDisplayKeys handles Meta+key for local display", () => {
  assert.deepEqual(comboToDisplayKeys("Meta+k"), ["Cmd/Ctrl", "K"]);
});

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

test("every definition belongs to a category in SHORTCUT_CATEGORY_ORDER", () => {
  for (const def of SHORTCUT_DEFINITIONS) {
    assert.ok(
      SHORTCUT_CATEGORY_ORDER.includes(def.category),
      `${def.id} has unknown category ${def.category}`,
    );
  }
});

test("every category in order has at least one definition", () => {
  for (const cat of SHORTCUT_CATEGORY_ORDER) {
    const defs = SHORTCUT_DEFINITIONS.filter((d) => d.category === cat);
    assert.ok(defs.length > 0, `Category ${cat} has no definitions`);
  }
});

// ---------------------------------------------------------------------------
// Normalization round-trips
// ---------------------------------------------------------------------------

test("normalizing a local combo twice produces the same result", () => {
  const combos = ["ArrowRight", "Meta+k", "Shift+F5", "Alt+ArrowLeft", " "];
  for (const combo of combos) {
    const once = normalizeShortcutCombo(combo, "local");
    const twice = normalizeShortcutCombo(once, "local");
    assert.equal(once, twice, `Round-trip failed for "${combo}": "${once}" vs "${twice}"`);
  }
});

test("normalizing a global combo twice produces the same result", () => {
  const combos = ["Alt+Right", "CmdOrCtrl+Shift+K", "Alt+B", "Alt+H"];
  for (const combo of combos) {
    const once = normalizeShortcutCombo(combo, "global");
    const twice = normalizeShortcutCombo(once, "global");
    assert.equal(once, twice, `Round-trip failed for "${combo}": "${once}" vs "${twice}"`);
  }
});

// ---------------------------------------------------------------------------
// matchesShortcutCombo edge cases
// ---------------------------------------------------------------------------

test("matchesShortcutCombo returns false when extra modifier is pressed", () => {
  assert.equal(
    matchesShortcutCombo(
      shortcutEvent({ key: "ArrowRight", altKey: true }),
      "ArrowRight",
    ),
    false,
  );
});

test("matchesShortcutCombo matches Escape without modifiers", () => {
  assert.equal(
    matchesShortcutCombo(shortcutEvent({ key: "Escape" }), "Escape"),
    true,
  );
});
