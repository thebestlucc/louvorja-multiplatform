# Phase 12 Tasks — Monitor Assignment in Settings

## Summary

Scope is limited to adding monitor assignment controls in Settings and aligning runtime monitor selection behavior with saved assignments. Existing persistence APIs are reused.

## Task List

### T-001 — Shared Monitor Resolution Logic

- Type: Foundation
- Deliverable: Single resolver used by both projection startup and manual monitor toggles.
- Success Criteria:
  - Projector/return resolution logic is not duplicated.
  - Fallback behavior remains deterministic.
  - Existing behavior for disconnected monitors remains safe.
- Dependencies: None
- Estimate: 2.0 AI-agent-hours (Medium confidence)

### T-002 — Settings Monitor Assignment UI

- Type: Feature
- Deliverable: Settings section to assign `projector` and `return` roles and persist changes.
- Success Criteria:
  - Settings loads current assignments.
  - User can save projector and return assignments.
  - Save feedback is visible.
- Dependencies: T-001
- Estimate: 3.0 AI-agent-hours (High confidence)

### T-003 — Settings Test Actions

- Type: Feature
- Deliverable: Test buttons in Settings to temporarily open projector/return on selected monitors.
- Success Criteria:
  - Projector test opens and closes projector window on selected monitor.
  - Return test opens and closes return window on selected monitor.
  - Disabled states apply when no monitor is available.
- Dependencies: T-001, T-002
- Estimate: 2.0 AI-agent-hours (High confidence)

### T-004 — Runtime Toggle Alignment

- Type: Integration
- Deliverable: `toggleProjector` and `toggleReturn` resolve target indexes from saved monitor configs.
- Success Criteria:
  - Status bar controls use configured monitors.
  - Keyboard shortcuts (F5 / Shift+F5) use configured monitors.
  - No regression in projection startup flow.
- Dependencies: T-001
- Estimate: 2.0 AI-agent-hours (Medium confidence)

### T-005 — Localization and UX Polish

- Type: Polish
- Deliverable: New/updated strings and minor UX states for settings monitor assignment.
- Success Criteria:
  - EN/PT/ES keys added.
  - No raw i18n keys rendered in UI.
  - Labels/tooltips are clear for live operation.
- Dependencies: T-002, T-003
- Estimate: 1.5 AI-agent-hours (High confidence)

### T-006 — Validation and Smoke

- Type: Integration
- Deliverable: Build/type/backend checks and manual smoke for monitor assignment flow.
- Success Criteria:
  - `vite build`, `tsc --noEmit`, `cargo check` pass.
  - Manual smoke confirms Settings assignment and shortcut behavior.
- Dependencies: T-002, T-003, T-004, T-005
- Estimate: 1.5 AI-agent-hours (High confidence)

## Critical Path

T-001 → T-002 → T-003 → T-005 → T-006

T-004 can run after T-001 in parallel with T-002/T-003.

## Total Estimate

- Raw AI estimate: **12.0 AI-agent-hours**
- Suggested multiplier for human validation: **1.5x**
- Adjusted execution estimate: **18.0 hours** (+ contingency)
