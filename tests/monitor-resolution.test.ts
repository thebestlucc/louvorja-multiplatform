import { test } from "node:test";
import { strict as assert } from "node:assert";

import { resolveAutomaticProjectionAssignments, resolveProjectionMonitorIndexes } from "../src/lib/monitor-resolution";
import { getPreferredMonitorName } from "../src/lib/monitor-display-name";
import type { MonitorConfig, MonitorInfo } from "../src/types/settings";

const monitors = [
  createMonitor("monitor-0", true),
  createMonitor("monitor-1"),
  createMonitor("monitor-2"),
];

test("returns null when no monitors are available", () => {
  assert.equal(resolveProjectionMonitorIndexes([], []), null);
});

test("uses deterministic fallbacks when no configs exist", () => {
  const resolved = resolveProjectionMonitorIndexes(monitors, []);
  assert.deepEqual(resolved, { projectorIndex: 1, returnIndex: 2 });
});

test("prefers an external monitor as default projector even when primary is not first", () => {
  const reordered = [
    createMonitor("monitor-external-a"),
    createMonitor("monitor-primary", true),
    createMonitor("monitor-external-b"),
  ];
  const resolved = resolveProjectionMonitorIndexes(reordered, []);

  assert.deepEqual(resolved, { projectorIndex: 0, returnIndex: 2 });
});

test("uses configured monitor IDs when available", () => {
  const resolved = resolveProjectionMonitorIndexes(monitors, [
    { id: 1, monitor_id: "monitor-2", role: "projector", enabled: true },
    { id: 2, monitor_id: "monitor-0", role: "return", enabled: true },
  ]);

  assert.deepEqual(resolved, { projectorIndex: 2, returnIndex: 0 });
});

test("falls back when configured monitor IDs are not connected", () => {
  const resolved = resolveProjectionMonitorIndexes(monitors, [
    { id: 1, monitor_id: "missing-monitor", role: "projector", enabled: true },
  ]);

  assert.deepEqual(resolved, { projectorIndex: 1, returnIndex: 2 });
});

test("supports legacy index-based monitor IDs for backward compatibility", () => {
  const stableMonitors = [
    createMonitor("monitor-a", true),
    createMonitor("monitor-b"),
    createMonitor("monitor-c"),
  ];
  const resolved = resolveProjectionMonitorIndexes(stableMonitors, [
    { id: 1, monitor_id: "monitor-2", role: "projector", enabled: true },
    { id: 2, monitor_id: "monitor-1", role: "return", enabled: true },
  ]);

  assert.deepEqual(resolved, { projectorIndex: 2, returnIndex: 1 });
});

test("auto-assigns a newly connected monitor as projector", () => {
  const currentMonitors = [
    createMonitor("monitor-primary", true),
    createMonitor("monitor-external-a"),
    createMonitor("monitor-external-b"),
  ];
  const configs: MonitorConfig[] = [
    { id: 1, monitor_id: "monitor-external-a", role: "projector", enabled: true },
    { id: 2, monitor_id: "monitor-primary", role: "return", enabled: true },
  ];

  const resolved = resolveAutomaticProjectionAssignments(
    currentMonitors,
    configs,
    ["monitor-primary", "monitor-external-a"],
    "monitor-primary",
  );

  assert.deepEqual(resolved, {
    projectorMonitorId: "monitor-external-b",
    returnMonitorId: "monitor-primary",
  });
});

test("auto-assigns projector when OS primary monitor changes", () => {
  const currentMonitors = [
    createMonitor("monitor-integrated"),
    createMonitor("monitor-external", true),
  ];
  const configs: MonitorConfig[] = [
    { id: 1, monitor_id: "monitor-external", role: "projector", enabled: true },
    { id: 2, monitor_id: "monitor-integrated", role: "return", enabled: true },
  ];

  const resolved = resolveAutomaticProjectionAssignments(
    currentMonitors,
    configs,
    ["monitor-integrated", "monitor-external"],
    "monitor-integrated",
  );

  assert.deepEqual(resolved, {
    projectorMonitorId: "monitor-integrated",
    returnMonitorId: "monitor-external",
  });
});

test("skips auto-assignment when monitor topology and primary monitor are unchanged", () => {
  const currentMonitors = [
    createMonitor("monitor-primary", true),
    createMonitor("monitor-external"),
  ];

  const resolved = resolveAutomaticProjectionAssignments(
    currentMonitors,
    [
      { id: 1, monitor_id: "monitor-external", role: "projector", enabled: true },
      { id: 2, monitor_id: "monitor-primary", role: "return", enabled: true },
    ],
    ["monitor-primary", "monitor-external"],
    "monitor-primary",
  );

  assert.equal(resolved, null);
});

test("separates return monitor when projector and return resolve to the same index", () => {
  const resolved = resolveProjectionMonitorIndexes(monitors, [
    { id: 1, monitor_id: "monitor-1", role: "projector", enabled: true },
    { id: 2, monitor_id: "monitor-1", role: "return", enabled: true },
  ]);

  assert.deepEqual(resolved, { projectorIndex: 1, returnIndex: 0 });
});

test("keeps single-monitor setups safe", () => {
  const singleMonitor = [createMonitor("monitor-0", true)];
  const resolved = resolveProjectionMonitorIndexes(singleMonitor, [
    { id: 1, monitor_id: "monitor-0", role: "projector", enabled: true },
    { id: 2, monitor_id: "monitor-0", role: "return", enabled: true },
  ]);

  assert.deepEqual(resolved, { projectorIndex: 0, returnIndex: 0 });
});

test("renders brand and model when monitor name provides it", () => {
  const monitor = createMonitor("monitor-0", false, "DELL U2720Q");
  assert.equal(getPreferredMonitorName(monitor, 0), "Dell U2720Q");
});

test("falls back to monitor index name for synthetic monitor identifiers", () => {
  const monitor = createMonitor("monitor-0", false, "monitor-6f8a32c2");
  assert.equal(getPreferredMonitorName(monitor, 0), "Monitor 1");
});

test("normalizes apple built-in monitor names", () => {
  const monitor = createMonitor("monitor-0", true, "Color LCD");
  assert.equal(getPreferredMonitorName(monitor, 0), "Apple Built-in Display");
});

test("prefers explicit manufacturer/model fields when present", () => {
  const monitor = createMonitor("monitor-0", false, "monitor-6f8a32c2");
  monitor.manufacturer = "Dell";
  monitor.model = "U2720Q";
  assert.equal(getPreferredMonitorName(monitor, 0), "Dell U2720Q");
});

function createMonitor(id: string, isPrimary = false, name = id): MonitorInfo {
  return {
    id,
    name,
    width: 1920,
    height: 1080,
    is_primary: isPrimary,
    x: 0,
    y: 0,
    scale_factor: 1,
  };
}
