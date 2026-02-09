# SPEC 08 — HTTP Streaming Server

**Phase:** 7
**Goal:** Replace the Delphi HTTP server with a Rust-native streaming server for live content.

---

## Files to CREATE

### Frontend — Components

#### `src/components/streaming/streaming-controls.tsx`
- Create streaming server control panel component
- Start/Stop server toggle button
- Server status indicator (green = running, red = stopped)
- IP address display (auto-detected local network IP)
- Port input (default: 7070, configurable)
- Active connections count
- Shareable URLs for each endpoint:
  - `/music` — current music/lyrics
  - `/bible` — current Bible verse
  - `/return` — performer feedback view
- QR code for each URL (using `qrcode.react`)
- "Copy URL" button next to each endpoint
- "Open in Browser" button for testing

#### `src/components/streaming/qr-code-display.tsx`
- Create QR code display component
- Renders a QR code for a given URL using `qrcode.react`
- Configurable size
- Label below showing the URL text
- Dark/light mode support for QR code colors

### Frontend — Streaming HTML Templates

#### `public/streaming/music.html`
- Create a self-contained HTML page for music/lyrics streaming
- Connects to the Rust HTTP server via Server-Sent Events (SSE)
- Displays current slide content (lyrics, hymn title, slide number)
- Auto-updates when slide changes
- Responsive design for mobile viewing
- Clean, minimal styling
- Compatible with OBS browser source and vMix

#### `public/streaming/bible.html`
- Create a self-contained HTML page for Bible verse streaming
- Connects via SSE
- Displays current Bible verse (text, reference, version)
- Auto-updates on verse change
- Responsive design

#### `public/streaming/return.html`
- Create a self-contained HTML page for return/performer view streaming
- Connects via SSE
- Displays current slide and next slide preview
- Larger text for readability
- Auto-updates on slide change

---

## Files to UPDATE

### Backend — Streaming Module

#### `src-tauri/src/streaming/mod.rs`
- Implement the embedded HTTP streaming server using `tiny_http`:
  - `StreamingServer` struct:
    - `server: Option<tiny_http::Server>`
    - `port: u16`
    - `is_running: bool`
  - Methods:
    - `new(port: u16) -> Self`
    - `start(&mut self) -> Result<()>` — bind to port and start listening
    - `stop(&mut self)` — shutdown the server
    - `is_running(&self) -> bool`
  - Endpoint handlers:
    - `GET /` — status page (server info, links to endpoints)
    - `GET /music` — serves `music.html` template
    - `GET /bible` — serves `bible.html` template
    - `GET /return` — serves `return.html` template
    - `GET /sse/music` — SSE endpoint for music content updates
    - `GET /sse/bible` — SSE endpoint for Bible content updates
    - `GET /sse/return` — SSE endpoint for return monitor updates
  - SSE implementation:
    - Keep HTTP connections open
    - Send `data:` events when content changes
    - JSON payload with slide content
    - Heartbeat every 30s to keep connection alive
  - Content update mechanism:
    - `update_music_content(content: &SlideContent)` — pushes to all `/sse/music` connections
    - `update_bible_content(content: &BibleSlideContent)` — pushes to all `/sse/bible` connections
    - `update_return_content(content: &ReturnContent)` — pushes to all `/sse/return` connections

### Backend — Streaming Commands

#### `src-tauri/src/commands/streaming.rs`
- Implement streaming server commands:
  - `start_streaming_server(port: Option<u16>, state: State<StreamingState>) -> Result<StreamingInfo, AppError>`
    - Starts the server on the given port (default 7070)
    - Returns: local IP, port, URLs for each endpoint
  - `stop_streaming_server(state: State<StreamingState>) -> Result<(), AppError>`
    - Stops the running server
  - `get_streaming_status(state: State<StreamingState>) -> Result<StreamingInfo, AppError>`
    - Returns server status, port, active connection count, URLs
  - `StreamingInfo` struct: `{ is_running: bool, ip: String, port: u16, urls: StreamingUrls, connections: usize }`
  - `StreamingUrls` struct: `{ music: String, bible: String, return_monitor: String }`

### Backend — State

#### `src-tauri/src/state.rs`
- Add `StreamingState` struct:
  - `server: Mutex<StreamingServer>`
- Add to Tauri managed state in `lib.rs`

### Backend — Integration with Display

#### `src-tauri/src/commands/display.rs` (UPDATE)
- When `set_current_slide` is called, also push content to the streaming server:
  - Call `streaming_state.server.update_music_content()` for music slides
  - Call `streaming_state.server.update_bible_content()` for Bible slides
  - Call `streaming_state.server.update_return_content()` for all content (return monitor)

### Backend — Cargo

#### `src-tauri/Cargo.toml`
- Add `tiny_http = "0.12"` dependency
- Add `qrcode = "0.14"` dependency (optional: for server-side QR generation)

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register streaming commands: `start_streaming_server`, `stop_streaming_server`, `get_streaming_status`
- Initialize `StreamingState` in managed state

### Frontend — npm Dependencies

#### `package.json`
- Add `qrcode.react` dependency

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `startStreamingServer(port?: number): Promise<StreamingInfo>`
  - `stopStreamingServer(): Promise<void>`
  - `getStreamingStatus(): Promise<StreamingInfo>`

### Frontend — Types

#### `src/types/streaming.ts` (CREATE)
- Create streaming types:
  - `StreamingInfo`: `{ isRunning: boolean; ip: string; port: number; urls: StreamingUrls; connections: number }`
  - `StreamingUrls`: `{ music: string; bible: string; returnMonitor: string }`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query keys and hooks:
  - `useStreamingStatus()` — polls streaming server status every 5s when running
  - `useStartStreaming()` — mutation
  - `useStopStreaming()` — mutation

### Frontend — Layout

#### `src/components/layout/status-bar.tsx` (UPDATE)
- Add streaming status indicator in the status bar
- Shows: "Streaming: OFF" or "Streaming: ON (port 7070, 3 connections)"
- Click opens streaming controls panel/modal

### Frontend — Settings

#### `src/routes/settings/route.tsx` (UPDATE)
- Add "Streaming" section to settings
- Default port configuration
- Auto-start streaming option
- Embed streaming controls
