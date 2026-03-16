# Plan: Implement Catcher and CatcherAsync in Rust

This plan adds the `catcher` and `catcher_async` utility functions to the Rust backend, mirroring the error-handling pattern used in the React frontend. These functions wrap `Result` types and return a `(Option<T>, Option<AppError>)` tuple to simplify error handling in specific contexts (like background threads or complex conditional logic).

## 1. Create `src-tauri/src/utils/catcher.rs`
Create the utility module containing the `catcher` and `catcher_async` functions.

### `catcher`
- **Input:** `Result<T, E>` where `E` can be converted into `AppError`.
- **Output:** `(Option<T>, Option<AppError>)`.
- **Purpose:** Converts a `Result` into a tuple for easy destructuring.

### `catcher_async`
- **Input:** A `Future` that resolves to `Result<T, E>`.
- **Output:** `(Option<T>, Option<AppError>)`.
- **Purpose:** Wraps an async operation's result into a tuple.

## 2. Register Module in `src-tauri/src/utils/mod.rs`
Expose the new `catcher` module.

## 3. Register `utils` in `src-tauri/src/lib.rs` (if not already public)
Ensure `utils` is accessible. (Checked: it's already `mod utils;` in `lib.rs`).

## 4. Verification
- Verify that `catcher` and `catcher_async` correctly handle both `Ok` and `Err` variants.
- Ensure `E: Into<AppError>` correctly handles standard errors already defined in `error.rs`.

---

## File Contents

### `src-tauri/src/utils/catcher.rs`
```rust
use crate::error::AppError;
use std::future::Future;

/// Standardizes error handling by wrapping a Result and returning a (Option<T>, Option<AppError>) tuple.
/// Similar to the frontend's catcher utility.
///
/// # Example
/// ```rust
/// let (data, err) = catcher(some_fn());
/// if let Some(e) = err {
///     return Err(e);
/// }
/// let data = data.unwrap();
/// ```
pub fn catcher<T, E>(result: Result<T, E>) -> (Option<T>, Option<AppError>)
where
    E: Into<AppError>,
{
    match result {
        Ok(data) => (Some(data), None),
        Err(err) => (None, Some(err.into())),
    }
}

/// Standardizes error handling for async operations.
pub async fn catcher_async<F, T, E>(future: F) -> (Option<T>, Option<AppError>)
where
    F: Future<Output = Result<T, E>>,
    E: Into<AppError>,
{
    catcher(future.await)
}

/// Standardizes error handling for closures.
pub fn catcher_sync<F, T, E>(f: F) -> (Option<T>, Option<AppError>)
where
    F: FnOnce() -> Result<T, E>,
    E: Into<AppError>,
{
    catcher(f())
}
```

### `src-tauri/src/utils/mod.rs` (Updated)
```rust
pub mod paths;
pub mod catcher;
```
