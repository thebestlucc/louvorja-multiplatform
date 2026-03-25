---
name: tauri-command
description: Scaffold a new Tauri command end-to-end (Rust query → command → lib.rs registration → TS wrapper → TanStack Query hook)
---

# Tauri Command Scaffolder

Scaffolds the full pipeline for a new Tauri command following the project's 5-step checklist.

## Arguments

- `name`: Command name in snake_case (e.g., `get_hymn_by_id`)
- `domain`: Domain module (e.g., `music`, `bible`, `slides`, `liturgy`, `settings`, `display`, `audio`)
- `args`: Comma-separated list of arguments with types (e.g., `id: i64, title: String`)
- `return_type`: Rust return type (e.g., `Hymn`, `Vec<Slide>`, `()`)
- `description`: Short description of what the command does

## Steps

### Step 1: DB Query — `src-tauri/src/db/queries/{domain}.rs`

Add a new function to the appropriate queries module:

```rust
pub fn {name}(conn: &Connection, {args}) -> Result<{return_type}, AppError> {
    // TODO: Implement query
    Err(AppError::Internal("Not implemented".into()))
}


### Step 2: Command Handler — src-tauri/src/commands/{domain}.rs
Add a new #[tauri::command] function:

```rust
#[tauri::command]
pub fn {name}({args}, state: tauri::State<'_, AppState>) -> Result<{return_type}, AppError> {
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    db::queries::{domain}::{name}(&conn, {forwarded_args})
}
```

- Always take state: tauri::State<'_, AppState>.
- Lock state.db mutex and delegate to the query function.
- For long-running operations, use std::thread::spawn and return immediately.

### Step 3: Register in lib.rs
Add commands::{domain}::{name} to the tauri::generate_handler![...] macro invocation.

### Step 4: TypeScript Wrapper — src/tauri.ts

Add a typed async functon:

```typescript
export async function {camelCaseName}({tsArgs}): Promise<{TsReturnType}> {
  return invoke<{TsReturnType}>("{name}", { {invokeArgs} });
}
```

- Use camelCase for the function name.
- Match Rust types: i64 → number, String → string, bool → boolean, Vec<T> → T[].
- Structs with #[serde(rename_all = "camelCase")] use camelCase field names in TS.

### Step 5: TanStack Query Hook — queries.ts

For read commands (queries):

```typescript
export function use{PascalCaseName}({hookArgs}) {
  return useQuery({
    queryKey: ["{domain}", {keyArgs}],
    queryFn: () => {camelCaseName}({fnArgs}),
    enabled: {enableCondition},
  });
}
```

For write commands (mutations):

```typescript
export function use{PascalCaseName}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { {varsType} }) => {camelCaseName}({varsArgs}),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["{domain}"] });
    },
  });
}
```

## Validation Checklist

- [ ] Query function compiles: cargo build --manifest-path src-tauri/Cargo.toml
- [ ] Command is registered in lib.rs
- [ ] TS wrapper matches Rust signature
- [ ] Query hook has correct queryKey for cache invalidation
- [ ] pnpm vite build succeeds
- [ ] npx tsc --noEmit passes