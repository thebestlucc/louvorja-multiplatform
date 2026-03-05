import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { PlayingQueueView } from "../../src/components/operator/playing-queue";

// Mock helper to find text in React tree
function getText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => getText(child)).join("");
  }
  if (!isValidElement(node)) {
    return "";
  }
  return getText((node as any).props.children);
}

test("PlayingQueueView renders empty state", () => {
  const element = PlayingQueueView({ items: [], currentIndex: -1, emptyMessage: "Queue is empty" });
  const text = getText(element);
  assert.ok(text.includes("Queue is empty"));
});

test("PlayingQueueView renders list of items", () => {
  const items = [
    { id: "1", hymn: { id: 1, title: "Hymn 1" } as any, type: "audio" as const },
    { id: "2", hymn: { id: 2, title: "Hymn 2" } as any, type: "projection" as const },
  ];
  const element = PlayingQueueView({ items, currentIndex: 0 });
  const text = getText(element);
  console.log("RENDERED TEXT:", text);
  assert.ok(text.includes("Hymn 1"));
  assert.ok(text.includes("Hymn 2"));
  assert.ok(text.includes("audio"));
  assert.ok(text.includes("projection"));
});
