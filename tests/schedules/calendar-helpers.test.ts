import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildMonthGrid,
  getWeekdayPatternDates,
  toggleSelectedDate,
  toIsoDate,
} from "../../src/lib/schedules";

test("buildMonthGrid returns a stable full-month matrix", () => {
  const grid = buildMonthGrid(2026, 3);

  assert.equal(grid.length, 6);
  assert.ok(grid.every((week) => week.length === 7));
  assert.equal(grid[0]?.[0]?.isoDate, "2026-03-01");
  assert.equal(grid[5]?.[6]?.isoDate, "2026-04-11");
});

test("getWeekdayPatternDates returns all Sundays for a month", () => {
  assert.deepEqual(getWeekdayPatternDates(2026, 3, 0), [
    "2026-03-01",
    "2026-03-08",
    "2026-03-15",
    "2026-03-22",
    "2026-03-29",
  ]);
});

test("selected dates are normalized as YYYY-MM-DD", () => {
  assert.equal(toIsoDate("2026-3-8"), "2026-03-08");
  assert.deepEqual(toggleSelectedDate(["2026-3-8"], "2026-03-09"), [
    "2026-03-08",
    "2026-03-09",
  ]);
});
