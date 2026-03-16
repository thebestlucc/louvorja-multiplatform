# Track Specification: Legacy Desktop Parity Features

## 1. Context and Problem Statement
The LouvorJA Multiplatform application is missing several key operator utilities that existed in the legacy Delphi application. To reach full feature parity and improve operator productivity, these tools must be implemented.

## 2. Goals
1. **Interactive Text & Alerts (Ticker)**: Allow projection of temporary static alerts or scrolling text (tickers) without interrupting the current presentation flow.
2. **Favorites System**: Implement the UI for adding, removing, and viewing favorite hymns and Bible verses. The underlying database table (`favorites`) already exists from the migration phase.
3. **Monitor Identification Helper**: Create a visual helper in the monitor settings screen to flash screen numbers, making it easier to assign Projector and Return roles.
4. **Collection Integrity Tools**: Provide a utility interface to scan the library for missing audio/video files and identify orphaned/excess media files.

## 3. Scope
*   **Interactive Text**: Frontend UI in `/utilities/interactive-text`, backend state for active alerts, SSE broadcast updates, and overlay rendering on projector/return screens.
*   **Favorites UI**: 'Star'/'Heart' button on hymn cards and Bible verses. A dedicated "Favorites" view/tab in the hymnal and Bible modules.
*   **Monitor ID**: Native Tauri/wry window creation on all monitors displaying their index for 3-5 seconds.
*   **Integrity Tools**: Backend rust command to cross-reference database media paths with the file system. Frontend UI in `/utilities/integrity` to display results and optionally clean up excess files.
