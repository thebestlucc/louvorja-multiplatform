# Specification: Rust Error Refactoring

## 1. Goal
The goal is to simplify and standardize error handling in the Rust backend by replacing verbose `match` or `if let` error handling blocks with the `catcher` utilities. This aligns with the frontend's pattern and improves overall readability.

## 2. Scope
- All Rust files in `src-tauri/src/commands/*.rs`.
- Other background-running threads or closures in `src-tauri/src/`.

## 3. Targeted Patterns

### 3.1. Manual Result Matching
**Current Pattern:**
```rust
let data = match some_fallible_call() {
    Ok(d) => d,
    Err(e) => return Err(e.into()),
};
```
**Refactored Pattern:**
```rust
let (data, err) = catcher(some_fallible_call());
if let Some(e) = err {
    return Err(e);
}
let data = data.unwrap();
```
*Note: In cases where early return via `?` is possible and doesn't require extra logic, `?` is still preferred. `catcher` is specifically for when a more explicit destructuring or complex handling is already in place.*

### 3.2. Error Handling in Threads or Closures
**Current Pattern:**
```rust
std::thread::spawn(move || {
    let result = some_fn();
    match result {
        Ok(_) => println!("Success"),
        Err(e) => eprintln!("Error: {}", e),
    }
});
```
**Refactored Pattern:**
```rust
std::thread::spawn(move || {
    let (_, err) = catcher(some_fn());
    if let Some(e) = err {
        eprintln!("Error: {}", e);
    }
});
```

## 4. Constraints
- **Do not replace `?`** when it is the most idiomatic solution (e.g., standard early return from a `Result`-returning function).
- Use `catcher_async` for `Future` results.
- Use `catcher_sync` for closures that return `Result`.
- Ensure all refactored code correctly converts error types to `AppError`.
