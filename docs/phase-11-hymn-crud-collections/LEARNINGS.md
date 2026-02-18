# Phase 11 Learnings - Realtime Projection Synchronization

Date: 2026-02-18
Scope: song/hymn/collection playback, timer/clock updates, projector/return/streaming synchronization

## Incident Summary

Realtime updates became unstable when synchronization relied on polling and route-coupled lifecycle handling. Symptoms included delayed/static timer values, streaming drift, and editor interactions affecting active playback.

## Root Cause

1. Polling loops introduced interval drift and stale reads across app, projector, return, and streaming surfaces.
2. Some subscription lifecycle controls were tied to route mount/unmount, which unintentionally stopped active playback synchronization.
3. Playback queue state and editor/detail interactions were not fully isolated, allowing unrelated flows to interfere.
4. Streaming behavior depended on template refresh assumptions instead of event-driven incremental updates.

## Decision (Mandatory Pattern)

1. Use pub/sub for all live synchronization (audio position, timer, stopwatch, clock, lottery animation, active projected slide).
2. Do not use polling for live sync paths (`setInterval`/periodic fetch loops) unless there is a documented hard constraint and explicit temporary exception.
3. Keep playback/projection state ownership separate from editor/detail state ownership.
4. Keep subscription ownership in playback/projection controllers (long-lived), not in unrelated route screens.
5. Streaming/projector/return must consume the same event contract and update incrementally.

## Implementation Guardrails

1. Define explicit event contracts (name + payload fields + cadence expectations).
2. Use idempotent subscription start/stop APIs.
3. Prefer event patch updates over full-surface rerenders.
4. Apply deterministic operation ordering for manual navigation (`seek` first, then `project`).
5. Protect manual user actions with short conflict locks to ignore stale late events.

## Anti-Patterns to Reject in Review

1. New polling loops for realtime projection synchronization.
2. Route unmount cleanup that stops global playback/projection subscriptions.
3. Editor/detail page actions mutating active playback queue state.
4. Full HTML/template refreshes to update ticking values.

## Regression Checklist

1. While playing, minimize or unfocus app/projector/return/streaming and verify synchronization still updates.
2. Open presentation editor during active song playback and verify queue/projection remains unaffected.
3. Manual next/previous during playback keeps audio and slide index aligned.
4. Stop projection/clear queue stops audio and ends sync event flow.
5. Projector, return, and streaming show consistent values without periodic pull logic.

## References

1. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/CODEX/AGENTS.md`
2. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/SPECS.md`
3. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/TASKS.md`
