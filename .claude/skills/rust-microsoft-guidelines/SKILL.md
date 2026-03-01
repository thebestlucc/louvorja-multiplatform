---
name: rust-microsoft-guidelines
version: 1.0.0
description: Microsoft Pragmatic Rust Guidelines - organized references for performance, safety, and documentation
allowed-tools: ["Read", "Write", "Grep", "Bash"]
source: https://microsoft.github.io/rust-guidelines/
license: MIT © Microsoft Corporation
---

# Rust Microsoft Guidelines Skill

Apply Microsoft's Pragmatic Rust Guidelines to code reviews, implementations, and documentation tasks.

## Usage Process

1. **Load [@references/index.md](references/index.md)** for a full table of contents and quick lookup
2. **Perf tasks:** grep `@references/perf/` or read specific files
3. **Safety tasks:** read `@references/safety/`
4. **Docs tasks:** read `@references/docs/`
5. **Comment code** with guideline ID: `// M-HOTPATH from @references/perf/hotpath.md`

## When This Skill Applies

Use this skill when the user asks you to:
- Optimize Rust code for performance (hot paths, allocators, throughput)
- Review or write `unsafe` code
- Decide between panic and `Result` for error handling
- Write or review `rustdoc` documentation
- Set up benchmarking or profiling
- Review any Rust code against best practices

## Reference Files

```
references/
├── index.md                  ← Start here: full guideline table of contents
├── perf/
│   ├── hotpath.md            ← M-HOTPATH, M-THROUGHPUT (benchmarking, profiling)
│   └── allocators.md         ← M-MIMALLOC-APPS, M-THROUGHPUT, M-YIELD-POINTS
├── safety/
│   ├── unsafe.md             ← M-UNSAFE-IMPLIES-UB, M-UNSAFE, M-UNSOUND
│   └── panic.md              ← M-PANIC-IS-STOP, M-PANIC-ON-BUG
└── docs/
    └── canonical-docs.md     ← M-CANONICAL-DOCS, M-MODULE-DOCS, M-DOC-INLINE
```

## Guideline Quick Reference

### Performance

**M-HOTPATH** — Identify hot paths early, benchmark with criterion/divan, profile with VTune/Superluminal.

**M-MIMALLOC-APPS** — Set mimalloc as global allocator in all application binaries (up to 25% gains).

```rust
// M-MIMALLOC-APPS from @references/perf/allocators.md
use mimalloc::MiMalloc;
#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;
```

**M-THROUGHPUT** — Optimize for items/CPU-cycle. Batch work, avoid hot spinning, yield cooperatively.

**M-YIELD-POINTS** — Long CPU-bound tasks must `yield_now().await` every 10–100µs.

### Safety

**M-UNSAFE-IMPLIES-UB** — `unsafe` only when misuse risks UB. Not for "dangerous but correct" functions.

**M-UNSAFE** — Valid reasons: novel abstractions, performance (benchmarked), FFI. Always add safety comments.

```rust
// M-UNSAFE from @references/safety/unsafe.md
// SAFETY: caller guarantees index < slice.len()
unsafe { *slice.get_unchecked(index) }
```

**M-UNSOUND** — No exceptions. Safe-looking code that can cause UB is never acceptable.

**M-PANIC-IS-STOP** — Panics signal program termination, not recoverable errors. Don't use as exceptions.

**M-PANIC-ON-BUG** — Contract violations and programming bugs → panic. Don't return `Result` for these.

```rust
// M-PANIC-ON-BUG from @references/safety/panic.md
fn divide_by(x: u32, y: u32) -> u32 {
    assert!(y != 0, "divide_by: y must be non-zero (programming error)");
    x / y
}
```

### Documentation

**M-CANONICAL-DOCS** — All public items need: summary sentence, `# Examples`, `# Errors`, `# Panics`, `# Safety`.

```rust
// M-CANONICAL-DOCS from @references/docs/canonical-docs.md
/// Parses a URI from a UTF-8 string slice.
///
/// # Examples
/// ```
/// let uri = parse_uri("https://example.com")?;
/// ```
/// # Errors
/// Returns `ParseError` if `s` is not a valid URI.
pub fn parse_uri(s: &str) -> Result<Uri, ParseError> { todo!() }
```

**M-FIRST-DOC-SENTENCE** — Summary sentence ≤ 15 words on a single line.

**M-MODULE-DOCS** — Every public module needs `//!` docs covering what, when, examples, side effects.

**M-DOC-INLINE** — Use `#[doc(inline)]` on `pub use` of your own types.

## Code Annotation Convention

When flagging a guideline in code, use this format:

```rust
// M-<ID> from @references/<category>/<file>.md
```

Examples:
```rust
// M-HOTPATH from @references/perf/hotpath.md
// M-MIMALLOC-APPS from @references/perf/allocators.md
// M-UNSAFE-IMPLIES-UB from @references/safety/unsafe.md
// M-PANIC-ON-BUG from @references/safety/panic.md
// M-CANONICAL-DOCS from @references/docs/canonical-docs.md
```

## Test Command

```
/rust-microsoft-guidelines "optimize this hotpath"
/rust-microsoft-guidelines "review this unsafe block"
/rust-microsoft-guidelines "should this panic or return Result?"
/rust-microsoft-guidelines "write docs for this public API"
```

## How to Use in Practice

### Reviewing a PR for Rust best practices

1. Read `@references/index.md`
2. For each changed file, grep for `unsafe`, `panic`, `unwrap`, `expect`, `///`
3. Check against relevant guidelines
4. Comment violations with: `// Violates M-<ID>: <reason>`

### Optimizing a hot path

1. Read `@references/perf/hotpath.md`
2. Identify allocation patterns (String clones, Vec grows, format! calls)
3. Add `mimalloc` per `@references/perf/allocators.md` if it's an app binary
4. Add criterion benchmark, enable `[profile.bench] debug = 1`
5. Profile with VTune or Superluminal

### Writing public API docs

1. Read `@references/docs/canonical-docs.md`
2. Apply M-CANONICAL-DOCS template: summary + Examples + Errors + Panics + Safety
3. Keep summary sentence ≤ 15 words (M-FIRST-DOC-SENTENCE)
4. Add `//!` module docs (M-MODULE-DOCS)
