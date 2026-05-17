import { test, describe } from "node:test";
import * as assert from "node:assert";

import { applyDelta, overlayBools } from "../../../src/lib/projection/apply-delta";
import type {
  ProjectionDelta,
  ProjectionSnapshot,
  SlideContent,
  SlideContext,
} from "../../../src/lib/bindings";

function emptySnapshot(): ProjectionSnapshot {
  return {
    version: 0,
    currentSlide: null,
    context: null,
    overlay: "none",
    frozen: false,
    alert: null,
  };
}

function lyrics(text: string): SlideContent {
  return {
    slideType: "lyrics",
    text,
    label: null,
    background: {
      kind: "solid",
      color: "#000",
      imagePath: null,
      gradientStart: null,
      gradientEnd: null,
      gradientAngle: null,
      opacity: null,
    },
    text_color: null,
    text_size: null,
  };
}

function sampleContext(title: string): SlideContext {
  return {
    next: null,
    index: 1,
    total: 3,
    title,
    currentSlideStartMs: null,
    nextSlideStartMs: null,
    audioDurationMs: null,
  };
}

describe("applyDelta", () => {
  test("slideChanged: sets currentSlide and bumps version", () => {
    const snapshot = emptySnapshot();
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [{ kind: "slideChanged", slide: lyrics("v1") }],
    };
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.version, 1);
    assert.deepStrictEqual(next.currentSlide, lyrics("v1"));
  });

  test("contextChanged: sets context and bumps version", () => {
    const snapshot = emptySnapshot();
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 2,
      events: [{ kind: "contextChanged", context: sampleContext("Hymn") }],
    };
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.version, 2);
    assert.strictEqual(next.context?.title, "Hymn");
  });

  test("overlayChanged: sets overlay enum value", () => {
    const snapshot = emptySnapshot();
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [{ kind: "overlayChanged", overlay: "black" }],
    };
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.overlay, "black");
  });

  test("freezeChanged: flips frozen", () => {
    const snapshot = emptySnapshot();
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [{ kind: "freezeChanged", frozen: true }],
    };
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.frozen, true);
  });

  test("alertChanged: sets alert", () => {
    const snapshot = emptySnapshot();
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [
        { kind: "alertChanged", alert: { text: "hello", isTicker: true } },
      ],
    };
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.alert?.text, "hello");
    assert.strictEqual(next.alert?.isTicker, true);
  });

  test("clearing fields: alertChanged with null clears the alert", () => {
    const snapshot: ProjectionSnapshot = {
      ...emptySnapshot(),
      alert: { text: "old", isTicker: false },
    };
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [{ kind: "alertChanged", alert: null }],
    };
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.alert, null);
  });

  test("batch delta: applies events in order, final value wins per field", () => {
    const snapshot = emptySnapshot();
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [
        { kind: "slideChanged", slide: lyrics("v1") },
        { kind: "overlayChanged", overlay: "black" },
        { kind: "alertChanged", alert: { text: "go", isTicker: false } },
      ],
    };
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.version, 1);
    assert.deepStrictEqual(next.currentSlide, lyrics("v1"));
    assert.strictEqual(next.overlay, "black");
    assert.strictEqual(next.alert?.text, "go");
  });

  test("immutability: input snapshot is not mutated", () => {
    const snapshot = emptySnapshot();
    const frozen = Object.freeze({ ...snapshot });
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [{ kind: "slideChanged", slide: lyrics("v1") }],
    };
    const next = applyDelta(frozen, delta);
    assert.notStrictEqual(next, frozen);
    assert.strictEqual(frozen.version, 0, "input version untouched");
    assert.strictEqual(frozen.currentSlide, null, "input slide untouched");
  });
});

describe("overlayBools", () => {
  test('"none" → both false', () => {
    assert.deepStrictEqual(overlayBools("none"), {
      blackScreen: false,
      logoScreen: false,
    });
  });
  test('"black" → blackScreen true, logoScreen false', () => {
    assert.deepStrictEqual(overlayBools("black"), {
      blackScreen: true,
      logoScreen: false,
    });
  });
  test('"logo" → blackScreen false, logoScreen true', () => {
    assert.deepStrictEqual(overlayBools("logo"), {
      blackScreen: false,
      logoScreen: true,
    });
  });
});
