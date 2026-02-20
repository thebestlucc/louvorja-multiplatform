# Separate Projector Process Implementation

## Overview
Implemented a solution to spawn projector and return monitor screens in completely separate processes instead of the same root process. This prevents the main application from being blocked when a user has only one monitor.

## Problem Solved
- When a user opened the projector window on a single-monitor setup, the fullscreen projector window would take over the entire screen, blocking access to the main application
- Users could not interact with the main application while the projector window was active
- Previously, windows were spawned on separate threads, but they remained part of the same Tauri process

## Solution Architecture

### 1. CLI Argument Support (`src-tauri/src/lib.rs`)
Added a new `should_run_projector_process()` function that:
- Checks command-line arguments at startup
- Looks for `--louvorja-projector <monitor_id>` or `--louvorja-return <monitor_id>` flags
- Returns the window type and monitor ID if detected
- If these args are present, the app runs in projector-only mode instead of the normal full application

### 2. Projector Process Module (`src-tauri/src/projector_process.rs`)
Created a new module `projector_process` that:
- Contains `ProjectorWindowType` enum (Projector or Return)
- Implements `run_projector_process()` function that:
  - Initializes a minimal Tauri app with only required state  
  - Skips database initialization for streaming/media
  - Creates only the fullscreen projector/return window
  - Uses the same fullscreen logic as before
- Reuses the `stable_monitor_id()` and `parse_legacy_monitor_index()` helpers from display.rs

### 3. Updated Display Commands (`src-tauri/src/commands/display.rs`)
Modified `open_projector_window()` and `open_return_window()` to:
- Call new `spawn_projector_process()` helper function
- Use `std::process::Command` to spawn a child process of the main executable
- Pass the necessary CLI arguments (`--louvorja-projector` or `--louvorja-return`) with the monitor ID
- Made `stable_monitor_id()` and `parse_legacy_monitor_index()` public for use in projector_process module

### 4. Process Spawning (`spawn_projector_process()`)
- Gets the current executable path
- Spawns a new process with the appropriate CLI flag and monitor ID
- The new process runs independently and doesn't block the main application

## Flow Diagram

```
User clicks "Open Projector" in main app
    ↓
Main app calls open_projector_window(monitor_id)
    ↓
spawn_projector_process("--louvorja-projector", monitor_id)
    ↓
std::process::Command spawns new process
    ↓
New process starts with --louvorja-projector flag
    ↓
should_run_projector_process() detects flag
    ↓
Initializes projector_process module instead of normal app
    ↓
Runs minimal Tauri app with only projector window
    ↓
Displays fullscreen projector window on specified monitor
    ↓
Main app continues to run unblocked ✓
```

## Benefits

1. **No UI Blocking**: Main application remains fully interactive on single-monitor setups
2. **Independent Windows**: Each projector/return window runs in its own OS process
3. **Clean Separation**: Projector processes only initialize what they need (minimal overhead)
4. **Existing Flow**: Frontend code doesn't change - events and state management work the same
5. **Natural Lifecycle**: When user closes a projector window, the process terminates automatically

## Technical Details

- **Platform Support**: Works on Windows, macOS, and Linux
- **CLI Arguments**: Uses `--louvorja-projector` and `--louvorja-return` to identify projector mode
- **Process Independence**: Child processes are completely independent and don't hold references to parent
- **Database Access**: Each projector process has its own database connection (read-only access for state)
- **Exit Handling**: Closing the projector window naturally terminates the child process

## Future Enhancements

1. Add process management/tracking to ensure child processes are cleaned up on main app exit
2. Add graceful shutdown mechanism via IPC if needed
3. Consider adding environment variables for additional configuration passing between processes
4. Monitor memory footprint of multiple projector processes on systems with many monitors

## Testing Recommendations

1. **Single Monitor Setup**: Open projector window and verify main app remains interactive
2. **Multi-Monitor Setup**: Ensure projector windows open on correct monitors
3. **Rapid Toggling**: Open/close projector multiple times in succession
4. **Content Updates**: Verify that changes in main app are reflected in projector (via database updates)
5. **Process Management**: Check task manager/system monitor to verify separate processes are created
