# Spec: Event-Driven Timer State Updates

**Date:** 2026-03-20
**Status:** Draft
**Topic:** Transitioning from polling-based to push-based (event-driven) timer state updates in the LouvorJA Multiplatform application.

## 1. Executive Summary

The current implementation of utility timers (countdown and stopwatch) relies on a polling mechanism in the React frontend. The `useTimerState` hook fetches the timer state from the Rust backend every 250ms when running and every 2000ms when idle. This approach introduces unnecessary IPC (Inter-Process Communication) overhead and latency.

This specification proposes a push-based model where the Rust backend broadcasts timer state updates via Tauri events at a high precision (50ms) only when the timer is active.

## 2. Background & Problem Statement

- **Polling Overhead:** Constant `get_timer_state` calls even when no timer is active.
- **Latency:** UI updates are throttled by the polling interval (250ms).
- **Inconsistency:** The projection system already uses an event-based "tick" mechanism, but the main operator UI does not.

## 3. Proposed Design

### 3.1 Backend Architecture (Rust)

#### 3.1.1 State Changes (`AppState`)
Add a new field to `AppState` in `src-tauri/src/state.rs` to manage the lifecycle of the timer update thread:

```rust
pub struct AppState {
    // ... existing fields ...
    pub timer_update_stop: Mutex<Option<(std::sync::mpsc::Sender<()>, std::thread::JoinHandle<()>)>>,
}
```

#### 3.1.2 Background Update Thread
Implement a helper function `start_timer_update_thread(app: AppHandle)` in `src-tauri/src/commands/timer.rs`:

1.  **Stop Existing:** If an update thread is already running (check `timer_update_stop`), signal it to stop via the `Sender` and `join()` on the `JoinHandle` to ensure full cleanup.
2.  **Spawn New:** Create a new `mpsc::channel`, spawn a thread, and store both the `Sender` and `JoinHandle` in the `AppState` mutex.
3.  **Loop:**
    -   Check for stop signal (non-blocking `try_recv`).
    -   Read `TimerRuntimeState` from `AppState` using a `write()` lock occasionally to call `normalize_timer_runtime` (ensuring it pauses at zero) OR ensure the UI logic doesn't depend on the side-effect of `get_timer_state`.
    -   If the timer is NOT running, signal stop and break loop.
    -   Emit `timer-state-updated` event with the serialized `TimerStateData`.
    -   Sleep for 50ms (High precision).
    -   Handle channel disconnection as a signal to terminate.

#### 3.1.3 Command Integration
Update the following commands in `src-tauri/src/commands/timer.rs` to trigger or stop the thread:

-   `start_timer`: Calls `start_timer_update_thread`.
-   `resume_timer`: Calls `start_timer_update_thread`.
-   `pause_timer`: Signals the thread to stop via `timer_update_stop`.
-   `reset_timer`: Signals the thread to stop via `timer_update_stop`.

### 3.2 Frontend Architecture (React)

#### 3.2.1 Hook Refactor (`useTimerState`)
Modify `src/lib/queries.ts` to replace polling with event subscription:

1.  **Remove `refetchInterval`**: Set `staleTime: Infinity` to prevent automatic polling.
2.  **Effect Hook**: Use `useEffect` to listen for the `timer-state-updated` event using Tauri's `listen` API.
3.  **Manual Cache Update**: On each event, use `queryClient.setQueryData` to update the `utilities.timerState` query cache directly.
4.  **Initial Fetch**: Keep the initial `queryFn` to ensure the correct state is loaded when the component mounts.

### 3.3 Data Flow

1.  **User starts timer** &rarr; `start_timer` command &rarr; Rust spawns update thread.
2.  **Rust Thread** &rarr; `app.emit("timer-state-updated", data)` every 50ms.
3.  **React Hook** &rarr; Receives event &rarr; Updates TanStack Query Cache.
4.  **UI Components** &rarr; Re-render with new data from cache.
5.  **User pauses timer** &rarr; `pause_timer` command &rarr; Rust signals thread to stop &rarr; Push updates cease.

## 4. Success Criteria

-   **Precision:** UI timer updates at 20Hz (50ms interval).
-   **Efficiency:** Zero `get_timer_state` IPC calls when the timer is idle or running (after initial load).
-   **Reliability:** No thread leakage on the backend (confirmed via `timer_update_stop` management).
-   **Parity:** UI behavior remains identical or better than the polling version.

## 5. Migration Plan

1.  Update `AppState` struct and initialization.
2.  Implement background thread and helper functions in `timer.rs`.
3.  Refactor backend timer commands to manage the thread.
4.  Update frontend `useTimerState` hook to use events.
5.  Verify behavior in `UtilitiesTimerPage`.

## 6. Testing Strategy

-   **Manual Verification:** Start/Pause/Reset timer and observe UI responsiveness.
-   **Performance Monitoring:** Verify reduced IPC calls in the Tauri development console / network tab (if using browser devtools).
-   **Thread Safety:** Rapidly Start/Pause to ensure no race conditions or multiple threads running simultaneously.
