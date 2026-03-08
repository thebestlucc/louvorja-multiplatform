# Presentation Bridge Plan

**Date:** 2026-03-07
**Contract:** `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`
**Goal:** Move external presentation control into a standalone `presentation-bridge` process that can run either:

- as an app-managed child process, or
- as an OS-started independent background process

**Primary target:** Windows + Microsoft PowerPoint slideshow mode
**Secondary targets:** macOS scriptable apps later; Linux only after an explicit portal/X11 strategy

## Why Rewrite the Design

The previous plan kept the external-control logic inside the main Tauri process. Your change is stronger:

- isolate PowerPoint automation from the main app,
- allow the helper to survive independently when configured,
- make the main app attach to an existing helper instead of assuming it owns lifecycle,
- keep crash/focus/input problems away from the core LouvorJA runtime.

This is the right architecture if `presentation-bridge` is treated as a small daemon with a narrow responsibility.

This implementation plan is subordinate to the lifecycle/IPC design doc. If a task here conflicts with that design doc, the design doc wins and the task should be updated before execution.

## Scope

### In Scope for MVP

- `presentation-bridge` is a standalone executable shipped with LouvorJA.
- The bridge owns external slide-control input and PowerPoint automation.
- The main app can detect, attach to, configure, and monitor an already-running bridge.
- The bridge supports two lifecycle modes:
  - `managed`
  - `independent`
- A new setting allows `Start with OS` for the bridge.
- If `Start with OS` is enabled, the bridge is allowed to run without the main app being started first.

### Out of Scope for MVP

- Generic key injection into arbitrary unfocused windows
- Keynote / Impress adapters
- Linux Wayland support
- Raw HID clicker support if the device does not emit keyboard events
- Multi-user or remote-network bridge control

## Core Design

## Process Model

There are now two separate runtimes:

1. **LouvorJA main app**
   - settings UI
   - bridge supervision UI
   - bridge configuration writer
   - optional managed spawning

2. **`presentation-bridge`**
   - singleton daemon/helper
   - global input capture for external presentation control
   - adapter execution for PowerPoint
   - IPC server for status/config/shutdown

The main app should not be the primary runtime for this feature anymore. The bridge should own the external-control loop.

## Lifecycle Modes

### Mode 1: Managed

Used when:

- `presentation.bridge.enabled = true`
- `presentation.bridge.startWithOs = false`

Behavior:

- Main app starts bridge if it is not already running.
- Main app owns the session.
- Bridge shuts down when the main app exits, crashes, or disconnects.
- This mode satisfies the earlier requirement that the bridge close when the app closes.

### Mode 2: Independent

Used when:

- `presentation.bridge.enabled = true`
- `presentation.bridge.startWithOs = true`

Behavior:

- Bridge is registered to start with the OS.
- Bridge is allowed to run before the main app opens.
- Main app must probe for an existing bridge on startup and attach if found.
- Main app exiting does **not** shut down an OS-managed bridge.
- This mode satisfies the new requirement that the bridge can run without spawning the main app.

## Startup and Shutdown Rules

### Main App Startup

On startup, the main app must:

1. Read `presentation.bridge.enabled`.
2. If disabled, do nothing except optionally show bridge status if discovered.
3. If enabled, probe the bridge IPC discovery point first.
4. If a healthy bridge is already running:
   - attach,
   - fetch status,
   - push/sync config if needed,
   - never spawn a duplicate.
5. If no bridge is running:
   - in `managed` mode, spawn one;
   - in `independent` mode, either:
     - attach to none and show "not running", or
     - start one as an independent session without claiming ownership.

**Recommendation:** for MVP, if independent mode is enabled and no bridge is running, start it once from the main app but mark it as independent. Do not treat that instance as child-owned for shutdown purposes.

### Main App Shutdown

- If the bridge session is `managed`, send a shutdown command and also rely on parent-death detection as a fallback.
- If the bridge session is `independent`, detach only. Do not terminate it.

### Bridge Startup

Bridge startup must:

1. Acquire singleton ownership.
2. Start the IPC server.
3. Load its persisted config.
4. Register global shortcuts if enabled.
5. Start adapter services.

If a second bridge instance starts:

- it should contact the existing instance,
- report "already running",
- exit immediately.

## Configuration Model

Use dedicated bridge settings instead of overloading LouvorJA’s current slide-control flow.

### Required Settings

- `presentation.bridge.enabled`
  - `true` or `false`
  - master switch for bridge management

- `presentation.bridge.startWithOs`
  - `true` or `false`
  - if `true`, bridge may run independently from the main app

- `presentation.bridge.targetApp`
  - `powerpoint-windows`
  - future:
    - `keynote-macos`
    - `impress`

- `presentation.bridge.shortcutNext`
  - global shortcut string bridge registers itself

- `presentation.bridge.shortcutPrev`
  - global shortcut string bridge registers itself

### Setting Semantics

- `startWithOs` can only be enabled when `presentation.bridge.enabled` is enabled.
- Disabling `presentation.bridge.enabled` should:
  - unregister OS startup,
  - stop bridge input capture,
  - request bridge shutdown if it is running.

## Input Ownership

Because the bridge must work independently from the main app, the bridge must own the external slide-control shortcuts.

That means the external-clicker path should no longer depend on:

- the main app’s `global-shortcut` event, or
- `use-keyboard.ts`

for the external-control feature.

LouvorJA can keep its own local shortcuts and unrelated global shortcuts, but bridge-owned external next/previous shortcuts must have a single owner to avoid registration conflicts.

## IPC Contract

The main app should detect the bridge by probing a fixed local IPC discovery point, not by scanning the process table as the source of truth.

### Current IPC transport

- Windows MVP: loopback TCP on `127.0.0.1`, with the active port written to a fixed temp port file and guarded by a fixed lock file
- macOS/Linux: Unix domain socket, with a fixed socket path and fixed lock file

### Suggested Commands

- `ping`
- `status`
- `apply_config`
- `next`
- `previous`
- `shutdown`

### Suggested Status Response

- version
- platform
- lifecycle mode: `managed` or `independent`
- target app
- shortcut registration status
- adapter health
- ownership/session metadata

### Security note

The current Windows MVP transport is local-only, but not transport-enforced same-user isolation. The bridge must therefore keep its IPC surface strictly allowlisted and never accept arbitrary command or script input.

## Packaging Strategy

`presentation-bridge` should be bundled as a sidecar binary, not generated ad hoc at runtime.

### Packaging Requirements

- Create a dedicated Rust binary for the bridge.
- Bundle it with Tauri as an external binary / sidecar.
- Launch it through a controlled Rust-only path.

Relevant Tauri documentation confirms that sidecars are bundled via `bundle.externalBin` and launched from Rust through the shell sidecar API.

## Existing Repo Context

These existing repo points matter to the rewrite:

- `src-tauri/src/lib.rs`
  - already initializes plugins including app autostart
- `src/routes/settings/index.tsx`
  - already has main-app autostart UI
- `src-tauri/Cargo.toml`
  - already includes `tauri-plugin-autostart`
- `src-tauri/tauri.conf.json`
  - currently has no sidecar/external binary config

This means the new bridge autostart setting must be separate from the existing LouvorJA app autostart setting.

## Delivery Plan

## Task 1: Define the Bridge Binary and Shared Modules

**Target:** backend
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/src/bin/presentation-bridge.rs` (new)
- `src-tauri/src/presentation_bridge/mod.rs` (new)
- `src-tauri/src/presentation_bridge/ipc.rs` (new)
- `src-tauri/src/presentation_bridge/config.rs` (new)
- `src-tauri/src/presentation_bridge/lifecycle.rs` (new)
- `src-tauri/src/presentation_bridge/powerpoint.rs` (new)

**Implementation notes:**

- The bridge binary must be able to run without the main app.
- Keep bridge-specific code outside the main Tauri runtime.
- Expose a small shared library surface for config, IPC, lifecycle, and adapter logic.

**Acceptance criteria:**

- There is a standalone binary target for `presentation-bridge`.
- Bridge logic is physically isolated from LouvorJA’s main Tauri process.

## Task 2: Bundle the Bridge as a Tauri Sidecar

**Target:** shared
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/desktop.json`
- build helper script if needed under `scripts/` or `src-tauri/scripts/`

**Implementation notes:**

- Add sidecar bundling configuration for `presentation-bridge`.
- Add the shell plugin if required for controlled Rust-side sidecar launching.
- Restrict execution to the named sidecar only.
- Ensure packaged builds include the bridge executable for the host target.

**Acceptance criteria:**

- Production bundles include `presentation-bridge`.
- LouvorJA can launch the bundled bridge without using arbitrary shell execution.

## Task 3: Build the Bridge IPC Server and Singleton Guard

**Target:** backend
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/src/presentation_bridge/ipc.rs`
- `src-tauri/src/presentation_bridge/lifecycle.rs`
- `src-tauri/src/bin/presentation-bridge.rs`

**Implementation notes:**

- Use a fixed local endpoint.
- Enforce a single running bridge instance.
- Expose `ping`, `status`, `apply_config`, and `shutdown`.
- Do not use process enumeration as the primary detection mechanism.

**Acceptance criteria:**

- A second bridge instance exits cleanly.
- Main app can determine whether a healthy bridge instance already exists.

## Task 4: Implement Lifecycle Modes

**Target:** backend
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/src/presentation_bridge/lifecycle.rs`
- `src-tauri/src/bin/presentation-bridge.rs`

**Implementation notes:**

- Add explicit lifecycle mode handling:
  - `managed`
  - `independent`
- In `managed` mode:
  - bridge exits on supervisor disconnect,
  - bridge exits on parent-death detection.
- In `independent` mode:
  - bridge survives main-app exit,
  - bridge remains controllable over IPC.

**Windows-specific note:**

- Use parent-death enforcement that survives abnormal app termination.
- A Job Object or equivalent is preferred for managed mode.

**Acceptance criteria:**

- Managed bridge dies with the app.
- Independent bridge remains alive across app exit.

## Task 5: Add Bridge Config Persistence

**Target:** backend
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/src/presentation_bridge/config.rs`
- `src-tauri/src/commands/settings.rs` or a new bridge settings command file
- `src/lib/queries.ts`
- `src/lib/tauri.ts`
- `src/lib/bindings.ts`

**Implementation notes:**

- Persist bridge settings independently from transient runtime state.
- Prefer a dedicated bridge config file in app data rather than coupling the bridge to the full app database.
- Main app writes config.
- Bridge reads config at startup and accepts `apply_config` for live reload.

**Acceptance criteria:**

- Bridge can start independently and still load its own configuration.
- Main app can update settings without restarting the whole app.

## Task 6: Move External Shortcut Ownership into the Bridge

**Target:** backend/frontend
**Working Directory:** `.`
**Files to Create/Modify:**

- `src-tauri/src/bin/presentation-bridge.rs`
- `src-tauri/src/presentation_bridge/config.rs`
- `src/hooks/use-keyboard.ts`
- `src/lib/shortcut-definitions.ts`

**Implementation notes:**

- Bridge registers and owns the external next/previous global shortcuts.
- Main app must not register conflicting bridge-owned shortcuts.
- Keep LouvorJA local shortcuts intact.
- Preserve unrelated global shortcuts in the main app.

**Acceptance criteria:**

- There is one and only one owner for bridge next/previous shortcuts.
- Bridge can advance PowerPoint even when LouvorJA is not running.

## Task 7: Implement the PowerPoint Adapter Inside the Bridge

**Target:** backend
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/src/presentation_bridge/powerpoint.rs`
- `src-tauri/Cargo.toml`

**Implementation notes:**

- Prefer native PowerPoint automation over key simulation.
- The bridge must:
  - connect to a running PowerPoint instance,
  - locate an active slideshow,
  - call next/previous,
  - return typed errors.

**Allowed fallback for MVP:**

- fixed internal PowerShell helper only if native COM integration proves too expensive for the first iteration

**Not allowed:**

- arbitrary command strings from the UI
- focus stealing as the primary control path
- generic PageDown injection to arbitrary windows

**Acceptance criteria:**

- Bridge can control a live PowerPoint slideshow without PowerPoint being focused.

## Task 8: Add Main-App Bridge Management Commands

**Target:** backend
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/src/commands/presentation_bridge.rs` (new)
- `src-tauri/src/lib.rs`

**Suggested commands:**

- `bridge_status`
- `bridge_start`
- `bridge_stop`
- `bridge_apply_config`
- `bridge_register_autostart`
- `bridge_unregister_autostart`

**Implementation notes:**

- `bridge_start` must probe before spawning.
- `bridge_stop` must respect lifecycle mode.
- Do not kill an independent bridge automatically on app close.

**Acceptance criteria:**

- Main app can attach to or start bridge without duplicating it.
- Main app can manage bridge lifecycle explicitly.

## Task 9: Add Settings UI for Bridge Control

**Target:** frontend
**Working Directory:** `.`
**Files to Create/Modify:**

- `src/routes/settings/index.tsx`
- `src/components/settings/shortcuts-tab.tsx`
- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`

**New settings UI:**

- `Enable presentation bridge`
- `Start presentation bridge with OS`
- `Target app`
- `Next shortcut`
- `Previous shortcut`
- bridge status indicator:
  - Running (managed)
  - Running (independent)
  - Not running
  - Error

**Implementation notes:**

- Keep this clearly separate from the existing main-app `Launch at startup` setting.
- If `Start presentation bridge with OS` is enabled:
  - explain that bridge may run without LouvorJA being open.
- During implementation, use the `i18n-key` skill to add locale keys atomically.

**Acceptance criteria:**

- User can understand the difference between app autostart and bridge autostart.
- User can see whether the main app attached to an already-running bridge.

## Task 10: Implement Bridge OS Autostart

**Target:** backend
**Working Directory:** `src-tauri`
**Files to Create/Modify:**

- `src-tauri/src/commands/presentation_bridge.rs`
- bridge platform-specific startup registration files/modules

**Implementation notes:**

- This is separate from the existing Tauri autostart plugin for the main app.
- For MVP, Windows support is mandatory because PowerPoint support is Windows-first.
- macOS/Linux registration can be planned but may remain unsupported until adapters exist.

**Windows-first recommendation:**

- Register `presentation-bridge` directly for user login.
- Store enough metadata to unregister it reliably.

**Acceptance criteria:**

- Enabling `Start presentation bridge with OS` causes bridge to launch on login without starting LouvorJA.
- Disabling it unregisters the bridge cleanly.

## Task 11: Startup Attach Flow in LouvorJA

**Target:** backend/frontend
**Working Directory:** `.`
**Files to Create/Modify:**

- `src-tauri/src/lib.rs`
- `src/routes/settings/index.tsx`
- `src/lib/queries.ts`

**Implementation notes:**

- On app startup, if bridge management is enabled:
  - probe bridge,
  - attach if found,
  - sync config,
  - otherwise start it if policy requires.
- Surface bridge mode/status in settings.

**Acceptance criteria:**

- Main app reliably detects an already-running bridge.
- Main app no longer assumes it is the creator of the bridge process.

## Task 12: Tests

**Target:** backend/frontend
**Working Directory:** `.`
**Files to Create/Modify:**

- bridge unit tests under `src-tauri`
- frontend settings tests
- integration tests for startup attach behavior where practical

**Minimum automated coverage:**

- bridge singleton enforcement
- startup probe attaches to existing bridge
- managed mode exits on supervisor loss
- independent mode survives supervisor loss
- config load/apply behavior
- unsupported platform behavior

**Manual test matrix:**

1. Windows, bridge disabled, app start
2. Windows, managed mode, app starts bridge, app exit kills bridge
3. Windows, independent mode, bridge started by app, app exit does not kill bridge
4. Windows, bridge already running before app start, app attaches without spawning duplicate
5. Windows, OS login starts bridge, PowerPoint slideshow responds before opening LouvorJA
6. Windows, PowerPoint closed or not in slideshow mode

## Verification

Run these after implementation:

```bash
pnpm build
pnpm test:unit
cd src-tauri && cargo check
```

Expected results:

- `pnpm build` succeeds
- `pnpm test:unit` succeeds
- `cargo check` succeeds

Additional manual verification on Windows:

1. Enable `presentation.bridge.enabled`.
2. Set `Start presentation bridge with OS = true`.
3. Log out and log back in on Windows.
4. Confirm `presentation-bridge` is already running before LouvorJA opens.
5. Start a PowerPoint slideshow.
6. Press the configured clicker shortcut.
7. Confirm the slideshow advances without LouvorJA running.
8. Open LouvorJA.
9. Confirm the app detects and attaches to the existing bridge instance.

## Risks

- Some clickers do not emit normal keyboard shortcuts.
- Independent bridge autostart is OS-specific and should not be conflated with Tauri app autostart.
- Running two owners for the same global shortcut will fail or produce undefined behavior.
- PowerPoint automation may behave differently between edit mode and slideshow mode.
- Sidecar packaging requires explicit build/distribution wiring.

## Recommendation

Build this as a daemon-style sidecar with strict ownership rules:

1. Bridge owns external slide shortcuts.
2. Main app owns settings and supervision UI.
3. Managed mode kills the bridge with the app.
4. Independent mode lets the bridge live on its own and the app attaches when available.

That gives you the process isolation you asked for without making the app startup/shutdown behavior ambiguous.

## References

- Tauri sidecar / external binaries: [Embedding External Binaries](https://v2.tauri.app/fr/develop/sidecar/)
- Tauri plugin catalog and autostart support table: [Features & Recipes](https://v2.tauri.app/plugin/)
- Tauri autostart plugin: [Autostart](https://tauri.ubitools.com/plugin/autostart/)
- Microsoft Office automation: [Control One Office App from Another](https://learn.microsoft.com/en-us/office/vba/powerpoint/how-to/control-one-microsoft-office-application-from-another)
- PowerPoint Application object: [PowerPoint.Application](https://learn.microsoft.com/en-us/office/vba/api/PowerPoint.Application)
- PowerPoint slideshow next: [SlideShowView.Next](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.slideshowview.next)
- PowerPoint slideshow previous: [SlideShowView.Previous](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.slideshowview.previous)
