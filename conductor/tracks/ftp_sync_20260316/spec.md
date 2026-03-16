# Track Specification: FTP Synchronization

## 1. Context and Problem Statement
The LouvorJA Multiplatform application needs to maintain parity with the legacy Delphi application's ability to synchronize media assets (audio, covers) from the official server. While a future HTTP/CDN architecture is planned, the legacy FTP synchronization remains the primary fallback and immediate solution for users to fetch missing content.

## 2. Goals
- Implement secure fetching of FTP credentials using the static `Api-Token`.
- Provide a robust background FTP synchronization runner.
- Integrate sync status and progress into the existing "Content Sync" UI in Settings.
- Ensure no blocking of the Tauri IPC thread during long-running downloads.

## 3. High-Level Approach
- **Backend**: Use `suppaftp` for the FTP protocol and `reqwest` for the credential API.
- **Background Task**: Spawn a dedicated thread for the sync process, emitting progress events back to the frontend.
- **Logic**: Only download files that are missing or have size mismatches compared to the remote manifest.
- **Security**: Hide the static `Api-Token` within the Rust backend and handle short-lived JWT tokens for FTP access.
