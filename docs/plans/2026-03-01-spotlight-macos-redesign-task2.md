# Spotlight UI Redesign — Task 2: Frosted Glass UI

**Status:** Implemented, pending commit
**File:** `src/routes/spotlight.tsx`

---

## What Changed

Complete visual overhaul of the spotlight window to match macOS Spotlight aesthetics.

### Window

| Property | Before | After |
|----------|--------|-------|
| Size | 640×440 | 680×480 |
| Position | Horizontally centered, 120px from top | True center (both axes) |
| Background | Solid `bg-surface` | Transparent (frosted glass via CSS) |
| Transparency | No | `transparent(true)` + `macos-private-api` |

### UI Structure

```
┌─────────────────────────────────────────┐  ← rounded-2xl, border-white/10
│  🔍  Search...                      ✕   │  ← 19px text, 24px icon, clear btn
├─────────────────────────────────────────┤  ← divider (only when results exist)
│                                         │
│  NAVIGATION                             │  ← 10px uppercase tracking-widest
│  [🏠] Home                              │  ← icon badge (h-7 w-7 rounded-lg)
│  [🎵] Hymnal                            │
│  ...                                    │
│                                         │
│  HYMNS                                  │
│  [🎵] Amazing Grace          #42  [📺]  │  ← project button on hover
│  ...                                    │
│                                         │
│  BIBLE                                  │
│  [📖] John 3:16                         │
│       For God so loved the world...     │  ← 2-line layout for bible/collection
│                                         │
├─────────────────────────────────────────┤
│  ↩ to open  ↑↓ to navigate  ⎋ to close │  ← footer hint bar
└─────────────────────────────────────────┘
```

### Key CSS Classes

| Element | Classes |
|---------|---------|
| Outer container | `flex h-screen w-screen items-center justify-center bg-transparent` |
| Glass panel | `w-full overflow-hidden rounded-2xl border border-white/10 bg-black/55 shadow-2xl backdrop-blur-3xl` |
| Search bar | `flex items-center gap-3 px-5 py-4` |
| Input | `text-[19px] text-white bg-transparent outline-none placeholder:text-white/35` |
| Group heading | `text-[10px] uppercase tracking-widest font-semibold text-white/40` |
| Result item | `mx-2 rounded-xl px-3 py-2.5 text-[14px] text-white/90 hover:bg-white/10 aria-selected:bg-white/15` |
| Icon badge | `h-7 w-7 rounded-lg bg-white/10` (wraps each item icon) |
| Footer | `text-[11px] text-white/30 border-t border-white/10` |

### Shared Helpers (defined at module level to avoid repetition)

- `groupHeadingCls` — string constant for all `Command.Group` heading styles via `[&>[cmdk-group-heading]]:*` Tailwind arbitrary variants
- `itemCls` — string constant for all `Command.Item` base styles
- `<IconBadge>` — small component wrapping each result row icon in a rounded badge

---

## Dependencies Enabled

### Cargo.toml
```toml
tauri = { version = "2.9.4", features = ["protocol-asset", "macos-private-api"] }
```

### tauri.conf.json
```json
"app": {
  "macOSPrivateApi": true,
  ...
}
```

These are required for `.transparent(true)` on the window builder to compile and take effect on macOS.

---

## Fullscreen Fix (also in this PR)

`set_macos_collection_behavior` now also calls:
```rust
ns_win.setLevel(NSStatusWindowLevel); // level 25
```

Previously only `FullScreenAuxiliary` collection behavior was set — but without a matching high window level, macOS still places the window behind fullscreen apps. `NSStatusWindowLevel` (25) puts it in the status bar layer, which renders above all Spaces including fullscreen apps.
