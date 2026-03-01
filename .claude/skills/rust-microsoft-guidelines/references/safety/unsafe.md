# M-UNSAFE-IMPLIES-UB & M-UNSAFE — Unsafe Code Guidelines

**Source:** [Microsoft Pragmatic Rust Guidelines](https://microsoft.github.io/rust-guidelines/)

---

## M-UNSAFE-IMPLIES-UB — Unsafe Implies Undefined Behavior

**ID:** `M-UNSAFE-IMPLIES-UB`
**Version:** 1.0
**Why:** To ensure semantic consistency and prevent warning fatigue.

The marker `unsafe` may **only** be applied to functions and traits if misuse implies the risk of **undefined behavior (UB)**.
It must not be used to mark functions that are dangerous for other reasons.

```rust
// M-UNSAFE-IMPLIES-UB from @references/safety/unsafe.md

// ✅ Valid: misuse can cause UB (dereferencing raw pointer)
unsafe fn print_string(x: *const String) { }

// ❌ Invalid: dangerous, but no UB risk
unsafe fn delete_database() { }
```

---

## M-UNSAFE — Unsafe Needs Reason, Should be Avoided

**ID:** `M-UNSAFE`
**Version:** 0.2
**Why:** To prevent undefined behavior, attack surface, and similar accidents.

### Valid Reasons for `unsafe`

1. **Novel abstractions** — new smart pointer or allocator
2. **Performance** — e.g., calling `.get_unchecked()`
3. **FFI and platform calls** — calling into C or the kernel

### Invalid Uses of `unsafe`

Do NOT use ad-hoc `unsafe` to:
- Shorten a safe Rust program (e.g., `transmute` for enum casts)
- Bypass `Send`/`Sync` bounds (`unsafe impl Send`)
- Bypass lifetime requirements via `transmute`

### Checklist: Novel Abstractions

- [ ] Verify there is no established alternative; prefer that if available
- [ ] Abstraction must be minimal and testable
- [ ] Hardened against ["adversarial code"](https://cheats.rs/#adversarial-code):
  - If accepting closures: must become invalid if closure panics
  - Must assume safe traits (`Deref`, `Clone`, `Drop`) can misbehave
- [ ] Every `unsafe` block must have plain-text safety reasoning
- [ ] Must pass [Miri](https://github.com/rust-lang/miri) including adversarial cases
- [ ] Follow all [unsafe code guidelines](https://rust-lang.github.io/unsafe-code-guidelines/)

### Checklist: Performance

- [ ] Benchmark before using `unsafe` for performance
- [ ] Every `unsafe` block has plain-text safety reasoning
- [ ] Code passes [Miri](https://github.com/rust-lang/miri)
- [ ] Follow [unsafe code guidelines](https://rust-lang.github.io/unsafe-code-guidelines/)

### Checklist: FFI

- [ ] Use an established interop library to avoid `unsafe` constructs
- [ ] Follow [unsafe code guidelines](https://rust-lang.github.io/unsafe-code-guidelines/)
- [ ] Document generated bindings with permissible call patterns

### Example: Correct unsafe with safety comments

```rust
// M-UNSAFE from @references/safety/unsafe.md

/// Returns the element at `index` without bounds checking.
///
/// # Safety
/// Caller must ensure `index < slice.len()`. Violating this
/// causes undefined behavior (out-of-bounds memory access).
pub unsafe fn get_unchecked_item(slice: &[u8], index: usize) -> u8 {
    // SAFETY: Caller guarantees index < slice.len()
    *slice.get_unchecked(index)
}
```

---

## M-UNSOUND — All Code Must be Sound

**ID:** `M-UNSOUND`
**Version:** 1.0
**Why:** To prevent unexpected runtime behavior.

Unsound code = seemingly *safe* code that may produce UB when called from other safe code.

**No exceptions.** Unsound abstractions are never permissible.

```rust
// M-UNSOUND from @references/safety/unsafe.md

// ❌ Unsound: safe signature, but causes UB
fn unsound_ref<T>(x: &T) -> &u128 {
    unsafe { std::mem::transmute(x) }
}

// ❌ Unsound: bypasses Send without justification
struct AlwaysSend<T>(T);
unsafe impl<T> Send for AlwaysSend<T> {}
```

> **Note:** Soundness boundaries equal module boundaries. Within a module,
> safe functions may rely on invariants established by sibling code.

### Further Reading

- [Nomicon](https://doc.rust-lang.org/nightly/nomicon/)
- [Unsafe Code Guidelines](https://rust-lang.github.io/unsafe-code-guidelines/)
- [Miri](https://github.com/rust-lang/miri)
- [Adversarial code](https://cheats.rs/#adversarial-code)
- [Unsafe, Unsound, Undefined](https://cheats.rs/#unsafe-unsound-undefined)
