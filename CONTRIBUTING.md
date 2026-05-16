# Contributing

## Prerequisites

- Node.js 22+
- pnpm 10+
- Rust stable

### System dependencies (GStreamer)

The Rust video pipeline links against GStreamer 1.24+ at compile time. Install before running `pnpm tauri dev`.

**macOS**

```bash
brew install gstreamer
```

(`pkgconf` is pulled in automatically as a transitive dependency — no separate install needed, no `PKG_CONFIG_PATH` change required.)

**Linux (Debian/Ubuntu)**

```bash
sudo apt install libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
  libgstreamer-plugins-bad1.0-dev gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-nice
```

**Linux (Fedora/RHEL)**

```bash
sudo dnf install gstreamer1-devel gstreamer1-plugins-base-devel \
  gstreamer1-plugins-good gstreamer1-plugins-bad-free \
  gstreamer1-plugins-ugly gstreamer1-libav gstreamer1-plugin-libnice
```

**Windows**

Install the official MSVC GStreamer **runtime + development** packages (1.24+) from <https://gstreamer.freedesktop.org/download/>. Use the default install path.

## Setup
```bash
pnpm install
pnpm --filter remote-pwa build   # required for Rust compile (embedded in binary)
```

## Local checks
```bash
# From repo root
pnpm build
pnpm test

# Or from apps/desktop/ directly
cd apps/desktop
npx tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
```

## Branch and commit expectations
- Keep commits focused and small.
- Avoid unrelated refactors in feature branches.
- Include updates to docs and locale keys for new UI surfaces.

## Release notes
- Update `CHANGELOG.md` before tagging.
- Create tags in `vX.Y.Z` format to trigger release workflow.
- Configure updater/signing secrets as documented in `docs/UPDATER_SETUP.md`.
