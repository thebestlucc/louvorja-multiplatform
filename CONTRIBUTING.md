# Contributing

## Prerequisites
- Node.js 22+
- pnpm 10+
- Rust stable
- Tauri dependencies for your operating system

## Setup
```bash
pnpm install
```

## Local checks
```bash
pnpm exec tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
pnpm exec vite build
```

## Branch and commit expectations
- Keep commits focused and small.
- Avoid unrelated refactors in feature branches.
- Include updates to docs and locale keys for new UI surfaces.

## Release notes
- Update `CHANGELOG.md` before tagging.
- Create tags in `vX.Y.Z` format to trigger release workflow.
- Configure updater/signing secrets as documented in `docs/UPDATER_SETUP.md`.
