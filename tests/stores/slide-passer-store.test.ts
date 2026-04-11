import { test, describe, beforeEach } from "node:test";
import * as assert from "node:assert";

// Stub Tauri IPC so plugin-store calls don't throw in Node
(globalThis as any).window = { __TAURI_INTERNALS__: { invoke: () => Promise.resolve(null) } };

import { useSlidePasserStore } from "../../src/stores/slide-passer-store";

// Mock plugin-store: setPreference/getPreference are async no-ops in test env
// The store calls `void setPreference(...)` which is fire-and-forget, so no mock needed.

describe("Slide Passer Store", () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useSlidePasserStore.setState({
      config: {
        enabled: false,
        mode: "internal",
        mappings: {
          nextSlide: "PageDown",
          prevSlide: "PageUp",
          blackScreen: ".",
          toggleProjection: "F5",
        },
        externalApp: "powerpoint",
      },
      lastEventKey: null,
      lastEventTimestamp: null,
      isActive: false,
      loaded: false,
    });
  });

  test("initial state has expected defaults", () => {
    const state = useSlidePasserStore.getState();
    assert.strictEqual(state.config.enabled, false);
    assert.strictEqual(state.config.mode, "internal");
    assert.strictEqual(state.config.mappings.nextSlide, "PageDown");
    assert.strictEqual(state.config.mappings.prevSlide, "PageUp");
    assert.strictEqual(state.config.mappings.blackScreen, ".");
    assert.strictEqual(state.config.mappings.toggleProjection, "F5");
    assert.strictEqual(state.config.externalApp, "powerpoint");
    assert.strictEqual(state.isActive, false);
    assert.strictEqual(state.loaded, false);
  });

  test("setEnabled toggles enabled flag", () => {
    useSlidePasserStore.getState().setEnabled(true);
    assert.strictEqual(useSlidePasserStore.getState().config.enabled, true);

    useSlidePasserStore.getState().setEnabled(false);
    assert.strictEqual(useSlidePasserStore.getState().config.enabled, false);
  });

  test("setMode changes mode", () => {
    useSlidePasserStore.getState().setMode("external");
    assert.strictEqual(useSlidePasserStore.getState().config.mode, "external");

    useSlidePasserStore.getState().setMode("internal");
    assert.strictEqual(useSlidePasserStore.getState().config.mode, "internal");
  });

  test("setMapping updates a specific mapping", () => {
    useSlidePasserStore.getState().setMapping("nextSlide", "ArrowDown");
    const mappings = useSlidePasserStore.getState().config.mappings;
    assert.strictEqual(mappings.nextSlide, "ArrowDown");
    // Other mappings unchanged
    assert.strictEqual(mappings.prevSlide, "PageUp");
    assert.strictEqual(mappings.blackScreen, ".");
  });

  test("setMapping can clear a mapping to null", () => {
    useSlidePasserStore.getState().setMapping("blackScreen", null);
    assert.strictEqual(
      useSlidePasserStore.getState().config.mappings.blackScreen,
      null,
    );
  });

  test("setExternalApp changes target app", () => {
    useSlidePasserStore.getState().setExternalApp("keynote");
    assert.strictEqual(
      useSlidePasserStore.getState().config.externalApp,
      "keynote",
    );
  });

  test("recordEvent sets lastEventKey, timestamp, and isActive", () => {
    const before = Date.now();
    useSlidePasserStore.getState().recordEvent("PageDown");
    const state = useSlidePasserStore.getState();

    assert.strictEqual(state.lastEventKey, "PageDown");
    assert.strictEqual(state.isActive, true);
    assert.ok(state.lastEventTimestamp! >= before);
    assert.ok(state.lastEventTimestamp! <= Date.now());
  });

  test("clearActive resets isActive without clearing event data", () => {
    useSlidePasserStore.getState().recordEvent("PageUp");
    useSlidePasserStore.getState().clearActive();

    const state = useSlidePasserStore.getState();
    assert.strictEqual(state.isActive, false);
    assert.strictEqual(state.lastEventKey, "PageUp"); // preserved
    assert.ok(state.lastEventTimestamp !== null); // preserved
  });

  test("setConfig merges partial config", () => {
    useSlidePasserStore
      .getState()
      .setConfig({ enabled: true, mode: "external" });
    const config = useSlidePasserStore.getState().config;
    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.mode, "external");
    // Unchanged fields preserved
    assert.strictEqual(config.mappings.nextSlide, "PageDown");
    assert.strictEqual(config.externalApp, "powerpoint");
  });

  test("multiple setMapping calls are independent", () => {
    useSlidePasserStore.getState().setMapping("nextSlide", "n");
    useSlidePasserStore.getState().setMapping("prevSlide", "p");

    const mappings = useSlidePasserStore.getState().config.mappings;
    assert.strictEqual(mappings.nextSlide, "n");
    assert.strictEqual(mappings.prevSlide, "p");
    assert.strictEqual(mappings.blackScreen, "."); // unchanged
  });

  test("setEnabled does not reset other config fields", () => {
    // Setup non-default config
    useSlidePasserStore.getState().setMode("external");
    useSlidePasserStore.getState().setMapping("nextSlide", "ArrowRight");
    useSlidePasserStore.getState().setExternalApp("keynote");

    // Toggle enabled
    useSlidePasserStore.getState().setEnabled(true);

    const config = useSlidePasserStore.getState().config;
    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.mode, "external");
    assert.strictEqual(config.mappings.nextSlide, "ArrowRight");
    assert.strictEqual(config.externalApp, "keynote");
  });
});

describe("Slide Passer Key Matching", () => {
  // Test the key matching logic used in use-slide-passer.ts
  function findMatchedAction(
    pressedKey: string,
    mappings: Record<string, string | null>,
  ): string | null {
    for (const [action, mappedKey] of Object.entries(mappings)) {
      if (mappedKey && pressedKey === mappedKey) {
        return action;
      }
    }
    return null;
  }

  const defaultMappings = {
    nextSlide: "PageDown",
    prevSlide: "PageUp",
    blackScreen: ".",
    toggleProjection: "F5",
  };

  test("PageDown matches nextSlide", () => {
    assert.strictEqual(findMatchedAction("PageDown", defaultMappings), "nextSlide");
  });

  test("PageUp matches prevSlide", () => {
    assert.strictEqual(findMatchedAction("PageUp", defaultMappings), "prevSlide");
  });

  test(". matches blackScreen", () => {
    assert.strictEqual(findMatchedAction(".", defaultMappings), "blackScreen");
  });

  test("F5 matches toggleProjection", () => {
    assert.strictEqual(findMatchedAction("F5", defaultMappings), "toggleProjection");
  });

  test("unmapped key returns null", () => {
    assert.strictEqual(findMatchedAction("ArrowRight", defaultMappings), null);
    assert.strictEqual(findMatchedAction("a", defaultMappings), null);
    assert.strictEqual(findMatchedAction("Escape", defaultMappings), null);
  });

  test("null mapping is skipped", () => {
    const mappings = { ...defaultMappings, blackScreen: null };
    assert.strictEqual(findMatchedAction(".", mappings), null);
  });

  test("custom mappings work", () => {
    const custom = {
      nextSlide: "ArrowRight",
      prevSlide: "ArrowLeft",
      blackScreen: "b",
      toggleProjection: null,
    };
    assert.strictEqual(findMatchedAction("ArrowRight", custom), "nextSlide");
    assert.strictEqual(findMatchedAction("ArrowLeft", custom), "prevSlide");
    assert.strictEqual(findMatchedAction("b", custom), "blackScreen");
    assert.strictEqual(findMatchedAction("F5", custom), null);
  });

  test("exact match required (case-sensitive)", () => {
    assert.strictEqual(findMatchedAction("pagedown", defaultMappings), null);
    assert.strictEqual(findMatchedAction("PAGEDOWN", defaultMappings), null);
    assert.strictEqual(findMatchedAction("f5", defaultMappings), null);
  });
});
