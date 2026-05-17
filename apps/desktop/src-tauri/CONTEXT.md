# Backend

Tauri 2 + Rust backend for the worship desktop app. Owns canonical state for the things shown on screens (projector, return, SSE consumers), plus database, audio, video, archive, and content-sync subsystems.

This document grows over time. Subsystem-specific terms are added as they get sharpened.

## Language

### Projection

**Projection State**:
The authoritative, in-memory representation of what should be shown right now: which slide, which overlay, frozen or not, current alert. Lives in the backend. Surfaces are views onto it; events are notifications of its mutation.
_Avoid_: "current slide" alone (it's only one field), "screen state", "view state"

**Projection Snapshot**:
A copy of Projection State at a point in time, used to hydrate a Surface when it attaches. Contains every field a Surface needs to materialize the current display from cold.
_Avoid_: "initial state", "bootstrap payload"

**Projection Delta**:
A versioned record of a state transition: `from_version → to_version` plus one or more atomic Events that describe what changed (slide changed, overlay changed, freeze changed, alert changed). Surfaces apply Deltas after hydrating from a Snapshot.
_Avoid_: "projection event" (too broad — runtime telemetry is not a Delta), "slide event"

**Mutation**:
A caller's *intent* to change Projection State. Distinct from Delta: a Mutation may produce one Delta with several Events (e.g. `Mutation::Project(ServiceItem)` could emit `SlideChanged + AlertChanged` atomically). Every change to Projection State enters the Hub through `apply(Mutation)` or `apply_batch(Vec<Mutation>)`.
_Avoid_: "command" (overloaded with Tauri commands), "action" (overloaded with React/Redux), "set_slide call" (too granular — Mutation is the abstraction)

**Version**:
A monotonic `u64` on Projection State, incremented exactly once per `apply` or `apply_batch`. Carried on Snapshots (`version`) and Deltas (`from_version`, `to_version`). The universal recovery rule for Surfaces: *if `delta.from_version != local_version`, re-hydrate from a fresh Snapshot.*
_Avoid_: "sequence number" (correct but generic), "revision"

**Projection Hub**:
The single owner of Projection State. Mutates state, emits Deltas, hands out Snapshots to attaching Surfaces. Does not render, does not know about transports, does not know about URL schemes.
_Avoid_: "dispatcher", "slide manager", "projection service"

**Projection Surface** (or just **Surface**):
An adapter that materializes Projection State for one transport. Examples: the projector webview, the return webview, an SSE channel, a remote-PWA WebSocket. A Surface hydrates from a Snapshot, then consumes Deltas. Each Surface owns its own transport contract, serialization, and URL derivation.
_Avoid_: "output", "consumer", "renderer" (renderer is the frontend half — see relationships)

**Hydrate**:
What a Surface does when it attaches: take a Snapshot and materialize it immediately so the consumer sees current state from the first frame, with no replay required.
_Avoid_: "initialize", "bootstrap", "catch up"

**Materialize**:
What a Surface does in response to Snapshots and Deltas — produce the transport-specific representation (a webview event, an SSE payload, a WebSocket frame) and deliver it.
_Avoid_: "render" (render is the frontend's job after the event arrives), "emit"

**Asset Identity**:
A stable, transport-independent reference to a media asset stored in Projection State (e.g. a local file path, a video asset id). Surfaces derive transport-specific URLs (`file://`, `http://localhost/stream/...`) from Asset Identity at materialization time. Projection State never holds transport-specific URLs.
_Avoid_: "asset URL" (URLs are not canonical), "media reference"

**Runtime/Media Event**:
Operational events from media subsystems — video buffering, YouTube heartbeat, FTS-ready, preload completion, pipeline frame-ready. These are **not** Projection Deltas; they belong to their own subsystems and do not flow through the Hub.
_Avoid_: bundling these into a single "ProjectionEvent" enum (semantic collapse — see ADR-0001)

## Relationships

- A **Projection Hub** owns exactly one **Projection State**.
- A **Projection State** can be observed by zero or more **Surfaces**.
- A **Surface** attaches by first taking a **Snapshot**, then subscribing to **Deltas**.
- A **Mutation** is the only way to change **Projection State**; the Hub validates and translates it into a **Delta**.
- A **Delta** describes one atomic transition of **Projection State**; the Hub emits Deltas only after the transition has been applied to State and **Version** has been incremented.
- A **Surface** has a Rust half (transport, lifecycle, delivery) and a frontend half (rendering, media orchestration). They are conceptually one Surface, physically two halves. The contract between halves is the serialized Snapshot/Delta schema.
- **Runtime/Media Events** are emitted by their own subsystems (video pipeline, YouTube bridge, ytdlp) directly to the frontend; they bypass the Hub.

## Example dialogue

> **Dev:** "If the return window opens five seconds after the slide was projected, how does it know what to show?"
> **Domain:** "It attaches as a Surface. The Hub gives it a Projection Snapshot, the Surface hydrates from it, then subscribes to Deltas. No replay of the last event — the Snapshot is the source of truth."
>
> **Dev:** "What about the local file path versus the SSE streaming URL — those differ per surface."
> **Domain:** "Projection State only holds Asset Identity. Each Surface derives its own URL form when it materializes. The webview Surface produces `file://`, the SSE Surface produces the streaming URL. The Hub never sees a URL."
>
> **Dev:** "Is video buffering a Delta?"
> **Domain:** "No — that's a Runtime/Media Event. It doesn't change Projection State. It goes from the video pipeline straight to the frontend renderer."

## Flagged ambiguities

- "slide-changed" was used in code to mean both *the Delta* and *the Tauri event name carrying it*. Going forward: the Delta is `SlideChanged`; the transport-level event name is an implementation detail of the WebviewSurface adapter.
- "current slide" was used to mean both *the SlideContent value* and *Projection State as a whole*. Going forward: "current slide" is one field of Projection State; the whole thing is "Projection State" or "Snapshot".
- "Surface" vs "renderer" vs "consumer": Surface is the adapter (Rust + frontend halves together). Renderer is the frontend half only. Consumer is whoever subscribes downstream of a Surface (a webview, an SSE client, a remote PWA).
