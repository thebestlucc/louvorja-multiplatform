# Microsoft Pragmatic Rust Guidelines — Reference Index

**Source:** https://microsoft.github.io/rust-guidelines/
**License:** MIT © Microsoft Corporation
**Package version:** 1.0.0

This index maps all covered guidelines to their reference files.

---

## Performance Guidelines

| ID | Title | File |
|----|-------|------|
| `M-HOTPATH` | Identify, Profile, Optimize the Hot Path Early | [@references/perf/hotpath.md](./perf/hotpath.md) |
| `M-MIMALLOC-APPS` | Use Mimalloc for Apps | [@references/perf/allocators.md](./perf/allocators.md) |
| `M-THROUGHPUT` | Optimize for Throughput, Avoid Empty Cycles | [@references/perf/allocators.md](./perf/allocators.md) |
| `M-YIELD-POINTS` | Long-Running Tasks Should Have Yield Points | [@references/perf/allocators.md](./perf/allocators.md) |

## Safety Guidelines

| ID | Title | File |
|----|-------|------|
| `M-UNSAFE-IMPLIES-UB` | Unsafe Implies Undefined Behavior | [@references/safety/unsafe.md](./safety/unsafe.md) |
| `M-UNSAFE` | Unsafe Needs Reason, Should be Avoided | [@references/safety/unsafe.md](./safety/unsafe.md) |
| `M-UNSOUND` | All Code Must be Sound | [@references/safety/unsafe.md](./safety/unsafe.md) |
| `M-PANIC-IS-STOP` | Panic Means 'Stop the Program' | [@references/safety/panic.md](./safety/panic.md) |
| `M-PANIC-ON-BUG` | Detected Programming Bugs are Panics, Not Errors | [@references/safety/panic.md](./safety/panic.md) |

## Documentation Guidelines

| ID | Title | File |
|----|-------|------|
| `M-CANONICAL-DOCS` | Documentation Has Canonical Sections | [@references/docs/canonical-docs.md](./docs/canonical-docs.md) |
| `M-FIRST-DOC-SENTENCE` | First Sentence is One Line; ~15 Words | [@references/docs/canonical-docs.md](./docs/canonical-docs.md) |
| `M-MODULE-DOCS` | Has Comprehensive Module Documentation | [@references/docs/canonical-docs.md](./docs/canonical-docs.md) |
| `M-DOC-INLINE` | Mark `pub use` Items with `#[doc(inline)]` | [@references/docs/canonical-docs.md](./docs/canonical-docs.md) |

## Universal Guidelines (covered in references)

| ID | Title | Notes |
|----|-------|-------|
| `M-CONCISE-NAMES` | Names are Free of Weasel Words | Avoid `Service`, `Manager`, `Factory` suffixes |
| `M-DOCUMENTED-MAGIC` | Magic Values are Documented | Comment why, side effects, external systems |
| `M-LINT-OVERRIDE-EXPECT` | Use `#[expect]` not `#[allow]` | Prevents stale lint accumulation |
| `M-LOG-STRUCTURED` | Use Structured Logging with Message Templates | `tracing` events with named properties |
| `M-PUBLIC-DEBUG` | Public Types are Debug | `#[derive(Debug)]`; custom impl for sensitive types |
| `M-PUBLIC-DISPLAY` | Public Types Meant to be Read are Display | Error types, string wrappers |
| `M-REGULAR-FN` | Prefer Regular over Associated Functions | Don't host unrelated logic in `impl` blocks |

## Application Guidelines (covered in references)

| ID | Title | Notes |
|----|-------|-------|
| `M-APP-ERROR` | Applications may use Anyhow or Derivatives | `anyhow`/`eyre` for app-level errors; not for libraries |
| `M-MIMALLOC-APPS` | Use Mimalloc for Apps | See [@references/perf/allocators.md](./perf/allocators.md) |

## FFI Guidelines

| ID | Title | Notes |
|----|-------|-------|
| `M-ISOLATE-DLL-STATE` | Isolate DLL State Between FFI Libraries | Only share `#[repr(C)]` portable types across DLL boundaries |

## AI / Design Guidelines

| ID | Title | Notes |
|----|-------|-------|
| `M-DESIGN-FOR-AI` | Design with AI use in Mind | Idiomatic APIs, thorough docs/examples, strong types, testable |

---

## Quick Lookup

```
Optimize performance?     → M-HOTPATH, M-MIMALLOC-APPS, M-THROUGHPUT
Writing unsafe code?      → M-UNSAFE-IMPLIES-UB, M-UNSAFE, M-UNSOUND
Error vs panic decision?  → M-PANIC-IS-STOP, M-PANIC-ON-BUG
Writing public API docs?  → M-CANONICAL-DOCS, M-FIRST-DOC-SENTENCE, M-MODULE-DOCS
```
