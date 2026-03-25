# M-CANONICAL-DOCS — Documentation Has Canonical Sections

**Source:** [Microsoft Pragmatic Rust Guidelines](https://microsoft.github.io/rust-guidelines/)
**ID:** `M-CANONICAL-DOCS`
**Version:** 1.0
**Why:** To follow established and expected Rust best practices.

---

## Guideline

Public library items **must** contain the canonical doc sections.

The **summary sentence must always be present**. Extended docs and examples are strongly encouraged.
Other sections must be present **when applicable**.

## Canonical Template

```rust
/// Summary sentence < 15 words.
///
/// Extended documentation in free form.
///
/// # Examples
/// One or more examples that show API usage like so.
///
/// # Errors
/// If fn returns `Result`, list known error conditions.
///
/// # Panics
/// If fn may panic, list when this may happen.
///
/// # Safety
/// If fn is `unsafe` or may otherwise cause UB, this section must list
/// all conditions a caller must uphold.
///
/// # Abort
/// If fn may abort the process, list when this may happen.
pub fn foo() {}
```

## Real-World Example: File Copy

```rust
// M-CANONICAL-DOCS from @references/docs/canonical-docs.md

/// Copies a file from `src` to `dst`, preserving metadata.
///
/// Opens `src` for reading and creates or truncates `dst` for writing.
/// Both files must be on accessible paths with appropriate permissions.
///
/// # Examples
///
/// ```no_run
/// use std::path::Path;
/// copy_file(Path::new("input.txt"), Path::new("output.txt"))?;
/// ```
///
/// # Errors
///
/// Returns an error if:
/// - `src` does not exist or is not readable
/// - `dst` cannot be created or written to
/// - A read/write error occurs during the copy
///
/// # Panics
///
/// Does not panic under normal conditions.
pub fn copy_file(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::copy(src, dst)?;
    Ok(())
}
```

## Anti-Pattern: Parameters Table

**Do NOT** create a parameters table (Java/C# style):

```rust,ignore
// ❌ Wrong — not idiomatic Rust
/// Copies a file.
///
/// # Parameters
/// - src: The source.
/// - dst: The destination.
fn copy(src: File, dst: File) {}
```

**Do** explain parameters inline in prose:

```rust,ignore
// ✅ Correct — idiomatic Rust
/// Copies a file from `src` to `dst`.
fn copy(src: File, dst: File) {}
```

---

## M-FIRST-DOC-SENTENCE — First Sentence is One Line; ~15 Words

**ID:** `M-FIRST-DOC-SENTENCE`
**Version:** 1.0
**Why:** To make API docs easily skimmable.

The first sentence becomes the **summary sentence** shown in module-level docs.

```rust
// M-FIRST-DOC-SENTENCE from @references/docs/canonical-docs.md

// ✅ Good: concise, under 15 words, single line
/// Parses a UTF-8 string into a validated URI.
pub fn parse_uri(s: &str) -> Result<Uri, ParseError> { todo!() }

// ❌ Bad: too long, wraps, creates "widow" text
/// This function accepts a string parameter and attempts to parse it as a
/// Uniform Resource Identifier according to RFC 3986.
pub fn parse_uri(s: &str) -> Result<Uri, ParseError> { todo!() }
```

---

## M-MODULE-DOCS — Has Comprehensive Module Documentation

**ID:** `M-MODULE-DOCS`
**Version:** 1.1
**Why:** To allow for better API docs navigation.

Any public library module must have `//!` module documentation.

```rust
// M-MODULE-DOCS from @references/docs/canonical-docs.md

pub mod transport {
    //! HTTP/TCP transport layer for outbound connections.
    //!
    //! This module contains the core transport abstractions used to establish
    //! and manage connections. Use [`TcpTransport`] for raw TCP and
    //! [`HttpTransport`] for HTTP/1.1 and HTTP/2.
    //!
    //! # Examples
    //!
    //! ```no_run
    //! let transport = TcpTransport::connect("127.0.0.1:8080")?;
    //! transport.send(b"hello")?;
    //! ```
    //!
    //! # Side Effects
    //!
    //! Creating a transport opens a system socket. Dropping the transport closes it.

    pub struct TcpTransport;
    pub struct HttpTransport;
}
```

Module docs should cover:
- What the module contains
- When to use it (and when not to)
- Examples
- Observable side effects and guarantees
- Relevant implementation details

---

## M-DOC-INLINE — Mark `pub use` Items with `#[doc(inline)]`

**ID:** `M-DOC-INLINE`
**Version:** 1.0
**Why:** To make re-exported items 'fit in' with their non re-exported siblings.

```rust
// M-DOC-INLINE from @references/docs/canonical-docs.md

// ✅ Correct: re-exported items render inline in the parent module
#[doc(inline)]
pub use inner::Foo;

// Does not apply to std or 3rd party types — those show the re-export
pub use std::collections::HashMap;
```

---

## Related Guidelines

- [M-HOTPATH](../perf/hotpath.md) — document performance-sensitive areas
- [M-PANIC-ON-BUG](../safety/panic.md) — `# Panics` section is mandatory when applicable
- [M-UNSAFE-IMPLIES-UB](../safety/unsafe.md) — `# Safety` section is mandatory for `unsafe fn`
