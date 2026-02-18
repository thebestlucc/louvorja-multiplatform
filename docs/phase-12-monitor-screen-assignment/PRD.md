# Phase 12 PRD — Monitor Assignment in Settings

## 1. Context

Monitor-role persistence (projector/return) already exists and is used by projection startup flows. Today, users can assign screens only during onboarding, which is insufficient when hardware changes after first run.

## 2. Problem Statement

Operators need to reconfigure monitor-to-projection mapping directly in Settings. Without this, they must rerun onboarding or depend on hardcoded fallback behavior, increasing setup time and live-operation risk.

## 3. Goals

1. Add a Settings section to assign monitors to projection roles (`projector`, `return`).
2. Allow quick validation of assignments via role-specific test actions.
3. Persist assignments using existing monitor config storage.
4. Ensure projection controls and shortcuts use saved assignments consistently.
5. Keep behavior localized in EN/PT/ES.

## 4. Non-Goals

1. No new monitor role model changes (for example, no new `confidence/priority` fields).
2. No monitor identification animation (flash/border/highlight) in this phase.
3. No changes to database schema.
4. No redesign of projector default-content settings.

## 5. Primary Users

1. Worship operators configuring projector/return screens before or during rehearsals.
2. Technical volunteers handling venue hardware swaps.

## 6. User Stories

1. As an operator, I can select which monitor is used as projector output in Settings.
2. As an operator, I can select which monitor is used as return output in Settings.
3. As an operator, I can test each configured output without leaving Settings.
4. As an operator, I can update monitor assignments after hardware changes without rerunning onboarding.

## 7. Success Metrics

1. Monitor assignment can be completed from Settings in under 60 seconds.
2. Manual projector/return toggles open on configured monitors in 100% of normal cases.
3. No regression in onboarding monitor setup and projection playback startup behavior.

## 8. Risks and Mitigations

1. Risk: Saved monitor ID no longer exists (monitor disconnected/reordered).
   - Mitigation: Apply deterministic fallback and show user feedback.
2. Risk: Inconsistent monitor logic across auto-start and manual toggles.
   - Mitigation: Centralize monitor index resolution logic.
3. Risk: Locale gaps.
   - Mitigation: Require EN/PT/ES string updates in the same delivery batch.

## 9. Exit Criteria

1. Settings exposes projector/return monitor assignment controls.
2. Assignment changes persist and are reflected immediately in monitor control actions.
3. Test actions open each role window on the selected monitor.
4. Fallback behavior works when configured monitors are unavailable.
5. Type checks and build checks pass.
