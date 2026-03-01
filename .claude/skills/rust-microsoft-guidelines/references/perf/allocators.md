# M-MIMALLOC-APPS & M-THROUGHPUT — Allocators and Throughput Optimization

**Source:** [Microsoft Pragmatic Rust Guidelines](https://microsoft.github.io/rust-guidelines/)

---

## M-MIMALLOC-APPS — Use Mimalloc for Apps

**ID:** `M-MIMALLOC-APPS`
**Version:** 0.1
**Why:** To get significant performance for free.

Applications should set [mimalloc](https://crates.io/crates/mimalloc) as their global allocator.
This usually results in notable performance increases along allocating hot paths;
**up to 25% benchmark improvements** have been observed.

### Setup

Add to `Cargo.toml`:

```toml
[dependencies]
mimalloc = { version = "0.1" } # Or later version if available
```

Use in `main.rs`:

```rust
// M-MIMALLOC-APPS from @references/perf/allocators.md
use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

fn main() {
    // Your application code — now using mimalloc globally
}
```

### When to Apply

- All production applications (not library crates)
- Any binary crate that allocates on hot paths
- Applications with high request/message throughput

### Notes

- Only applies to **applications** (binaries), not libraries
- Libraries should not set global allocators (would force the allocator on consumers)
- Combine with [M-HOTPATH](./hotpath.md) benchmarking to measure the actual gain

---

## M-THROUGHPUT — Optimize for Throughput, Avoid Empty Cycles

**ID:** `M-THROUGHPUT`
**Version:** 0.1
**Why:** To ensure COGS savings at scale.

Key metric: **items per CPU cycle**.

### Design Principles

**Do:**
- Partition reasonable chunks of work ahead of time
- Let individual threads and tasks deal with their slice of work independently
- Sleep or yield when no work is present
- Design your own APIs for batched operations
- Perform work via batched APIs where available
- Yield within long individual items, or between chunks of batches (see M-YIELD-POINTS)
- Exploit CPU caches, temporal and spatial locality

**Do Not:**
- Hot spin to receive individual items faster
- Perform work on individual items if batching is possible
- Do work stealing or similar to balance individual items

Shared state should only be used if the cost of sharing is less than the cost of re-computation.

---

## M-YIELD-POINTS — Long-Running Tasks Should Have Yield Points

**ID:** `M-YIELD-POINTS`
**Version:** 0.2
**Why:** To ensure you don't starve other tasks of CPU time.

If you perform long running computations, they should contain `yield_now().await` points.

### With I/O (automatic preemption)

```rust
// M-YIELD-POINTS from @references/perf/allocators.md
// The runtime preempts automatically at await points
async fn process_items(items: &[Item]) {
    for i in items {
        read_item(i).await; // yield point — runtime preempts here
    }
}
```

### CPU-bound without I/O (manual yield)

```rust
// M-YIELD-POINTS from @references/perf/allocators.md
use tokio::task::yield_now;

async fn decompress_all(zip_file: File) {
    let items = zip_file.read_items();
    for item in items {
        decompress(&item);
        yield_now().await; // cooperatively yield after each item
    }
}
```

### Yield Frequency Guidance

> In a thread-per-core model: balance task switching cost vs. starvation risk.
> Runtime task switching takes ~100s of ns. Continuous execution between yields
> should be long enough that switching cost is negligible (<1%).
>
> **Target: 10–100µs of CPU-bound work between yield points.**
