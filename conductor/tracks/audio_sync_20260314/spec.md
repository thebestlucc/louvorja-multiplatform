# Specification: Enhance audio synchronization and live streaming features

## 1. Overview
This track aims to finalize and polish the audio synchronization and live streaming features of the LouvorJA Multiplatform application, based on the current uncommitted changes.

## 2. Goals
- Improve the sync mechanism between rodio playback and slide events.
- Enhance the SSE streaming templates (`music.html` and `return.html`).
- Ensure the `playing-now` route displays synchronized audio data correctly.
- Establish robust unit tests for `audio-sync.ts`.

## 3. Technical Requirements
- Frontend uses React 19, TypeScript, and Zustand for audio state.
- Backend uses Tauri, Rust, and the `rodio` engine for audio.
- Streaming runs over an SSE server sending raw low-latency events.
- All code changes must be validated by the automated test suite.