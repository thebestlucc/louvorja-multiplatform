# Event-Driven Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition the timer state from a polling model to a push-based model using Tauri events for 50ms high-precision updates.

**Architecture:** A background thread in Rust will emit `timer-state-updated` events every 50ms while the timer is active. The React frontend will subscribe to these events to update the TanStack Query cache.

**Tech Stack:** Tauri 2.9.4, React 19, Rust, TanStack Query.

---

### Task 1: Update Backend State

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add thread management to AppState**
Modify `AppState` in `src-tauri/src/state.rs` to include `timer_update_stop`.

```rust
pub struct AppState {
    // ... existing fields ...
    pub timer_update_stop: Mutex<Option<(std::sync::mpsc::Sender<()>, std::thread::JoinHandle<()>)>>,
}
```

- [ ] **Step 2: Initialize the new field in lib.rs**
Update the `app.manage(AppState { ... })` call in `src-tauri/src/lib.rs`.

```rust
utility_projection_stop: Mutex::new(None),
timer_update_stop: Mutex::new(None), // Add this
```

- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "chore: add timer_update_stop to AppState"
```

---

### Task 2: Implement Background Update Thread

**Files:**
- Modify: `src-tauri/src/commands/timer.rs`

- [ ] **Step 1: Implement `stop_timer_update_thread` helper**
Add a helper to gracefully stop and join the existing thread. **CRITICAL:** We must release the Mutex lock BEFORE joining the thread to avoid deadlocks.

```rust
fn stop_timer_update_thread(state: &AppState) {
    let handle_to_join = {
        let mut stop_guard = state.timer_update_stop.lock().unwrap();
        if let Some((tx, handle)) = stop_guard.take() {
            let _ = tx.send(());
            Some(handle)
        } else {
            None
        }
    };

    if let Some(handle) = handle_to_join {
        let _ = handle.join();
    }
}
```

- [ ] **Step 2: Implement `start_timer_update_thread` helper**
Add a helper to spawn the 50ms loop.

```rust
fn start_timer_update_thread(app: AppHandle) {
    let state = app.state::<AppState>();
    stop_timer_update_thread(&state);

    let (tx, rx) = std::sync::mpsc::channel();
    
    let app_handle = app.clone();
    let handle = std::thread::spawn(move || {
        let state = app_handle.state::<AppState>();
        loop {
            if rx.try_recv().is_ok() { break; }

            let timer_data = {
                let (timer, err) = crate::utils::catcher::catcher(state.timer.write());
                if err.is_some() { break; }
                let mut timer = timer.unwrap();
                crate::commands::timer::normalize_timer_runtime(&mut timer);
                if !timer.is_running() {
                    break;
                }
                timer.to_data()
            };

            let _ = app_handle.emit("timer-state-updated", timer_data);
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        
        // Final cleanup: only clear if it's still us (avoid clearing a newer thread's sender)
        // But since stop_timer_update_thread joins, this is mostly for auto-stop.
        let mut stop_guard = state.timer_update_stop.lock().unwrap();
        *stop_guard = None; 
    });

    let mut stop_guard = state.timer_update_stop.lock().unwrap();
    *stop_guard = Some((tx, handle));
}
```

- [ ] **Step 3: Update Timer Commands**
Update `start_timer`, `pause_timer`, `resume_timer`, `reset_timer`, and `adjust_countdown_timer` to call these helpers.

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/commands/timer.rs
git commit -m "feat: implement background timer update thread"
```

---

### Task 3: Refactor Frontend Subscription

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Update `useTimerState` hook**
Replace polling with event subscription. Includes a `cancelled` flag to prevent memory leaks during async setup.

```typescript
export function useTimerState(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (options?.enabled === false) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const unsubscribe = await listen<TimerStateData>("timer-state-updated", (event) => {
        if (cancelled) return;
        queryClient.setQueryData(queryKeys.utilities.timerState, event.payload);
      });
      
      if (cancelled) {
        unsubscribe();
        return;
      }
      unlisten = unsubscribe;
    };

    setup();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [queryClient, options?.enabled]);

  return useQuery({
    queryKey: queryKeys.utilities.timerState,
    queryFn: () => getTimerState(),
    enabled: options?.enabled,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
  });
}
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/queries.ts
git commit -m "feat: refactor useTimerState to use push events"
```

---

### Task 4: Verification

- [ ] **Step 1: Verify UI responsiveness**
Run `pnpm tauri dev` and start a timer. Verify it updates smoothly at 50ms.

- [ ] **Step 2: Verify idle overhead**
Verify no `get_timer_state` calls are happening in the network/IPC logs when the timer is paused.

- [ ] **Step 3: Verify auto-stop**
Start a countdown and let it reach zero. Verify the UI stops and no more events are emitted.
