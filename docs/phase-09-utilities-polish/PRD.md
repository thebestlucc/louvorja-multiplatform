# Phase 09 PRD — Utilities & Polish

## 1. Context

Phases 0–8 established the core worship flow: music, Bible, services, multi-monitor output, streaming, and video slides. The remaining adoption gap is operator productivity during live services, where operators still rely on external tools for time control and quick utility workflows.

## 2. Problem Statement

Service operators cannot run timer, clock, lottery, and text utilities end-to-end inside LouvorJA with projection-ready behavior and consistent keyboard-driven operation.

Current pain points:
- Utilities route is still a placeholder and does not provide usable tools.
- Timer and utility backend commands remain stubs.
- Operators switch between multiple apps for countdowns, stopwatch control, and random selection.
- Command discoverability and shortcut affordances are incomplete for utility workflows.

## 3. Goals

1. Deliver a production-usable utilities module with timer/chronometer, clock, lottery/randomizer, and text formatting.
2. Support live projection for utility outputs without breaking ongoing slide workflows.
3. Provide fast keyboard access through command palette coverage and a shortcuts help surface.
4. Complete theme and UI polish for consistent readability in operator and projection contexts.

## 4. Non-Goals

- No migration wizard or Delphi import tooling (Phase 10 scope).
- No video transcoding or advanced media editing (Phase 8/10 adjacent scope).
- No custom shortcut editor with arbitrary key remapping in this phase.

## 5. Users and Primary Jobs

### Primary users
- Worship operator running live service projection.
- Stage/return monitor consumer relying on visible time cues.

### Jobs to be done
- Start/pause/reset countdown and stopwatch quickly during service.
- Project a clear timer or clock onto projector/return as needed.
- Run a fair random name selection during live participation moments.
- Format text quickly for slide-ready copy.
- Trigger actions via keyboard without leaving current screen.

## 6. User Stories

1. As an operator, I want to run a countdown timer and project it, so I can keep service segments on time.
2. As an operator, I want a stopwatch with lap tracking, so I can monitor elapsed activities accurately.
3. As an operator, I want to project a live clock, so the audience and stage team can follow current time cues.
4. As an operator, I want to run a lottery from a name list, so I can select participants transparently.
5. As an operator, I want built-in text formatting helpers, so I can quickly prepare projection-ready text.
6. As an operator, I want comprehensive command palette and shortcut help, so I can operate faster without mouse-heavy navigation.

## 7. Success Metrics

### Product metrics
- 100% of utility commands return typed success/error results (no `"Not implemented"` stubs).
- 0 regressions in existing projection flows (hymn, Bible, presentation, video) after utility integration.
- 100% of utility routes render and operate without runtime errors in manual smoke.

### UX metrics
- Operator starts and projects a timer in under 10 seconds from utilities landing page.
- Command palette includes all utilities and global actions defined for Phase 09.
- All new utility strings are localized in EN/PT/ES.

## 8. Scope

### In scope
- Utilities route architecture and pages for timer, clock, lottery, and text tools.
- Backend timer state machine and utility command implementations.
- Projection integration for utility outputs.
- Command palette action expansion and keyboard shortcuts help panel.
- Theme polish pass and utility status indicators.

### Out of scope
- Arbitrary plugin system for custom utilities.
- Cloud-synced utility presets.
- Full user-customizable hotkey remapping engine.

## 9. Risks and Mitigations

1. High-frequency timer updates may degrade performance.
   - Mitigation: fixed tick cadence, event throttling, and render-mode-aware updates.
2. Utility projection could conflict with current slide projection.
   - Mitigation: explicit utility projection state with clear activation/clear semantics.
3. Shortcut collisions with existing bindings.
   - Mitigation: centralized shortcut registry and conflict checks during implementation.

## 10. Dependencies

- Phase 6 multi-monitor event/render pipeline.
- Phase 7 streaming and status patterns.
- Existing command palette/search foundation from Phase 0+.

## 11. Phase Exit Criteria

Phase 09 is complete when:
1. Timer, clock, lottery, and text utilities are fully operational in `/utilities`.
2. Utility outputs can be projected reliably and cleared cleanly.
3. Command palette and shortcuts help include utility workflows.
4. Theme/polish scope is applied without regressions.
5. Build/check commands pass and manual acceptance smoke succeeds.
