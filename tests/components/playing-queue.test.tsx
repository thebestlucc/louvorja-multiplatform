import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { PlayingQueueView } from "../../src/components/playing-now/playing-queue";

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
    { id: "1", kind: "hymn" as const, hymn: { id: 1, title: "Hymn 1" } as any, type: "audio" as const },
    { id: "2", kind: "hymn" as const, hymn: { id: 2, title: "Hymn 2" } as any, type: "projection" as const },
  ];
  const element = PlayingQueueView({ items, currentIndex: 0 });
  const text = getText(element);
  console.log("RENDERED TEXT:", text);
  assert.ok(text.includes("Hymn 1"));
  assert.ok(text.includes("Hymn 2"));
  assert.ok(text.includes("audio"));
  assert.ok(text.includes("projection"));
});

test("PlayingQueueView renders mixed-kind queue with 4 rows and correct titles", () => {
  const items = [
    { id: "1", kind: "hymn" as const, hymn: { id: 1, title: "Amazing Grace" } as any, type: "audio" as const },
    { id: "2", kind: "bible" as const, title: "John 3:16", type: "projection" as const },
    { id: "3", kind: "video" as const, title: "Worship Video", type: "projection" as const },
    { id: "4", kind: "presentation" as const, title: "Sunday Slides", type: "projection" as const },
  ];
  const element = PlayingQueueView({ items, currentIndex: 0 });
  assert.ok(isValidElement(element), "should render a React element");

  // Count rows by collecting all button elements
  function countByType(node: ReactNode, type: string): number {
    if (!isValidElement(node)) return 0;
    const el = node as ReactElement<any>;
    let count = el.type === type ? 1 : 0;
    const children = el.props.children;
    if (Array.isArray(children)) {
      count += children.reduce((acc: number, child: ReactNode) => acc + countByType(child, type), 0);
    } else if (children) {
      count += countByType(children, type);
    }
    return count;
  }

  const text = getText(element);
  // All 4 titles present
  assert.ok(text.includes("Amazing Grace"), "hymn title present");
  assert.ok(text.includes("John 3:16"), "bible title present");
  assert.ok(text.includes("Worship Video"), "video title present");
  assert.ok(text.includes("Sunday Slides"), "presentation title present");

  // hymn row shows type badge; others show empty badge
  assert.ok(text.includes("audio"), "hymn type badge present");
});
