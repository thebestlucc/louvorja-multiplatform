# M-HOTPATH — Identify, Profile, Optimize the Hot Path Early

**Source:** [Microsoft Pragmatic Rust Guidelines](https://microsoft.github.io/rust-guidelines/)
**ID:** `M-HOTPATH`
**Version:** 0.1
**Why:** To end up with high performance code.

---

## Guideline

You should, **early in the development process**, identify if your crate is performance or COGS relevant. If it is:

- Identify hot paths and create benchmarks around them
- Regularly run a profiler collecting CPU and allocation insights
- Document or communicate the most performance sensitive areas

## Benchmarking

Recommended crates: [`criterion`](https://crates.io/crates/criterion) or [`divan`](https://crates.io/crates/divan).

Benchmarks should not only measure elapsed wall time, but also used CPU time over all threads.

Enable debug symbols for benchmarks in `Cargo.toml` for meaningful profiler output:

```toml
[profile.bench]
debug = 1
```

## Profiling Tools (Windows)

- [Intel VTune](https://www.intel.com/content/www/us/en/developer/tools/oneapi/vtune-profiler.html)
- [Superluminal](https://superluminal.eu/)

## Common Hot Path Issues

> Anecdotally, ~15% benchmark gains on hot paths from `String` optimizations alone; up to 50% in highly optimized versions.

- Frequent re-allocations: cloned, growing, or `format!`-assembled strings
- Short-lived allocations (prefer bump allocators)
- Memory copy overhead from cloning `String`s and collections
- Repeated re-hashing of equal data structures
- Using Rust's default hasher where collision resistance isn't needed

## Example: Benchmark Setup with criterion

```rust
// benches/my_bench.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn benchmark_hot_path(c: &mut Criterion) {
    // M-HOTPATH from @references/perf/hotpath.md
    let data = prepare_test_data();
    c.bench_function("process_items", |b| {
        b.iter(|| process_items(&data))
    });
}

criterion_group!(benches, benchmark_hot_path);
criterion_main!(benches);
```

## Further Reading

- [Performance Tips (cheats.rs)](https://cheats.rs/#performance-tips)
- See also: [@references/perf/allocators.md](./allocators.md) for M-MIMALLOC-APPS
- See also: [@references/perf/allocators.md](./allocators.md) for M-THROUGHPUT
