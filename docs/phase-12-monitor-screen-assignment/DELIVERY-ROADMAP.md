# Phase 12 Delivery Roadmap — Monitor Assignment in Settings

## Planning Inputs

Because team/cadence details were not provided, this roadmap uses explicit assumptions:

1. Start date: **2026-02-19**
2. Team: **1 developer**
3. Cadence: **continuous delivery**
4. Validation multiplier: **1.5x** (standard)
5. Capacity utilization: **90%**

## Capacity Calculation

1. AI estimate from tasks: 12.0 hours
2. Adjusted with multiplier: 18.0 hours
3. Calendar hours at 90% utilization: 20.0 hours
4. Calendar days (8h/day, 1 dev): 2.5 days
5. Contingency buffer (15%): 0.4 days
6. Planned duration: **3 working days**

## Delivery Timeline

### Day 1 — 2026-02-19

1. T-001 Shared monitor resolution logic
2. Start T-002 Settings monitor assignment UI

### Day 2 — 2026-02-20

1. Complete T-002
2. T-003 Settings test actions
3. T-004 Runtime toggle alignment

### Day 3 — 2026-02-23

1. T-005 Localization and UX polish
2. T-006 Validation and smoke
3. Release-ready check and handoff prep

## Parallelization Strategy

1. After T-001, T-004 can proceed in parallel with T-002/T-003.
2. T-005 starts as soon as the settings UI strings stabilize.

## Key Risks

1. Hardware-dependent monitor behavior differs by OS display ordering.
2. Existing hardcoded toggle assumptions may reveal hidden coupling.
3. Monitor ID drift after physical display changes.

## Risk Mitigation

1. Keep deterministic fallback for unavailable monitor IDs.
2. Validate both startup and manual toggle paths in smoke checks.
3. Include manual test matrix: single monitor, dual monitor, monitor removed.

## Go/No-Go Criteria

Go to implementation when:
1. PRD, SPECS, TASKS are approved.
2. Assumptions above are accepted or replaced with real team inputs.
