import { test, describe, beforeEach } from "node:test";
import * as assert from "node:assert";
import {
  registerHiddenHost,
  registerPlayerNode,
  getPlayerNode,
  attachPlayerTo,
  detachPlayerToHost,
  clearPlayerNode,
} from "../../src/lib/video-player-registry";

// Minimal HTMLElement stub for Node.js environment
function makeEl(id: string): HTMLElement {
  return {
    id,
    _parent: null as HTMLElement | null,
    appendChild(child: HTMLElement) {
      (child as unknown as { _parent: HTMLElement | null })._parent = this as unknown as HTMLElement;
    },
  } as unknown as HTMLElement;
}

describe("videoPlayerRegistry", () => {
  beforeEach(() => {
    clearPlayerNode();
  });

  test("getPlayerNode returns null before registration", () => {
    assert.strictEqual(getPlayerNode(), null);
  });

  test("registerPlayerNode makes getPlayerNode return the element", () => {
    const el = makeEl("player");
    registerPlayerNode(el);
    assert.strictEqual(getPlayerNode(), el);
  });

  test("attachPlayerTo moves node to target and sets attached", () => {
    const host = makeEl("host");
    const target = makeEl("target");
    const player = makeEl("player");
    registerHiddenHost(host);
    registerPlayerNode(player);
    attachPlayerTo(target);
    assert.strictEqual((player as unknown as { _parent: HTMLElement })._parent, target);
  });

  test("attachPlayerTo is a no-op if already attached (Strict Mode guard)", () => {
    const host = makeEl("host");
    const target1 = makeEl("t1");
    const target2 = makeEl("t2");
    const player = makeEl("player");
    registerHiddenHost(host);
    registerPlayerNode(player);
    attachPlayerTo(target1);
    attachPlayerTo(target2); // should be no-op
    assert.strictEqual((player as unknown as { _parent: HTMLElement })._parent, target1);
  });

  test("detachPlayerToHost moves node back to host", () => {
    const host = makeEl("host");
    const target = makeEl("target");
    const player = makeEl("player");
    registerHiddenHost(host);
    registerPlayerNode(player);
    attachPlayerTo(target);
    detachPlayerToHost();
    assert.strictEqual((player as unknown as { _parent: HTMLElement })._parent, host);
  });

  test("clearPlayerNode nulls the node", () => {
    registerPlayerNode(makeEl("player"));
    clearPlayerNode();
    assert.strictEqual(getPlayerNode(), null);
  });
});
