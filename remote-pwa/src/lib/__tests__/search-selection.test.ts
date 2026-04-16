import { describe, it, expect } from "vitest";
import { compositeId, type SelectedItem } from "../search-selection";

describe("search-selection", () => {
  it("builds unique keys across tabs", () => {
    expect(compositeId("hymns", "1")).toBe("hymns:1");
    expect(compositeId("bible", "1")).toBe("bible:1");
    expect(compositeId("hymns", "1") !== compositeId("bible", "1")).toBe(true);
  });

  it("narrows by kind", () => {
    const it1: SelectedItem = {
      tab: "hymns", id: "1", title: "t",
      payload: { kind: "hymn", hymnId: 1 },
    };
    if (it1.payload.kind === "hymn") {
      expect(it1.payload.hymnId).toBe(1);
    }
  });
});
