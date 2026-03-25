# M-PANIC-IS-STOP & M-PANIC-ON-BUG — Panic Guidelines

**Source:** [Microsoft Pragmatic Rust Guidelines](https://microsoft.github.io/rust-guidelines/)

---

## M-PANIC-IS-STOP — Panic Means 'Stop the Program'

**ID:** `M-PANIC-IS-STOP`
**Version:** 1.0
**Why:** To ensure soundness and predictability.

**Panics are not exceptions.** They mean immediate program termination.

Your code must be [panic-safe](https://doc.rust-lang.org/nomicon/exception-safety.html)
(a survived panic may not leave inconsistent state), but invoking panic means *this program should stop now*.

### Invalid uses of panic

- Using panics to communicate errors upstream
- Using panics to handle self-inflicted error conditions
- Assuming panics will be caught by your code

### Warning: `panic = "abort"` in release

If the calling application uses:

```toml
[profile.release]
panic = "abort"
```

Any panic will cause an otherwise functioning program to needlessly abort.

### Valid reasons to panic

- **Programming error:** `x.expect("must never happen")`
- **Const contexts:** `const { foo.unwrap() }`
- **User-requested:** providing your own `unwrap()` method
- **Poisoned lock:** calling `unwrap()` on a lock result (signals another thread already panicked)

All of these are directly or indirectly linked to **programming errors**.

---

## M-PANIC-ON-BUG — Detected Programming Bugs are Panics, Not Errors

**ID:** `M-PANIC-ON-BUG`
**Version:** 1.0
**Why:** To avoid impossible error handling code and ensure runtime consistency.

When an **unrecoverable programming error** is detected, libraries and applications **must panic**.

No `Error` type should be introduced or returned in these cases — such an error could not be acted upon at runtime.

Contract violations (breaking invariants within a library or by a caller) are **programming errors** and must panic.

### Decision guide

```rust
// M-PANIC-ON-BUG from @references/safety/panic.md

// ✅ Panic: y == 0 is a contract violation (caller's bug)
fn divide_by(x: u32, y: u32) -> u32 {
    assert!(y != 0, "divide_by: y must not be zero");
    x / y
}

// ✅ Also acceptable: omit check, return unspecified (not undefined) result
fn divide_by_fast(x: u32, y: u32) -> u32 {
    x / y // panics naturally on division by zero in debug
}

// ✅ Result: parsing is inherently fallible, not a contract violation
fn parse_uri(s: &str) -> Result<Uri, ParseError> {
    // ...
    # todo!()
}
```

### Correct pattern: panic on invariant violation, not Result

```rust
// M-PANIC-ON-BUG from @references/safety/panic.md

struct RingBuffer {
    data: Vec<u8>,
    capacity: usize,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        // Capacity zero is a programming error, not a runtime condition
        assert!(capacity > 0, "RingBuffer capacity must be > 0");
        Self { data: Vec::with_capacity(capacity), capacity }
    }

    pub fn push(&mut self, byte: u8) {
        // Internal invariant: data.len() never exceeds capacity
        debug_assert!(self.data.len() <= self.capacity, "invariant violated");
        if self.data.len() < self.capacity {
            self.data.push(byte);
        }
    }
}
```

### Tip: Prefer "Correct by Construction"

> While panicking on a detected programming error is the 'least bad option',
> use the type system to avoid panicking code paths altogether when possible.
> Strong types prevent invalid states from being representable.

---

## Related Guidelines

- [M-PANIC-IS-STOP](#m-panic-is-stop) — Panic semantics
- See [@references/safety/unsafe.md](./unsafe.md) for M-UNSOUND (unsound code that causes UB instead of panic)
