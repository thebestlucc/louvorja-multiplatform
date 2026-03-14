# Product Definition

## Vision
LouvorJA Multiplatform is a modern, cross-platform church worship management desktop application. Re-engineered from the legacy Delphi version, it provides a stable, performant experience across Windows, macOS, and Linux.

## Target Audience
- **AV Operators:** Technical volunteers who manage live services and projection screens.

## Core Value Proposition
- **Cross-Platform Stability:** A robust and modern alternative to legacy systems on any operating system.
- **All-in-One Workflow:** Consolidates music, Bibles, and presentations into a single, cohesive, easy-to-use interface.
- **Live Media Sync:** Provides seamless, low-latency audio/visual synchronization across multiple screens (Projector, Return, Playing Now).

## Key Non-Functional Requirements
- **High-Performance:** Instantaneous responses across the application, especially for full-text search (FTS) of hymns and Bibles.
- **Zero-Downtime Projection:** The live projector output must never be interrupted, even during background updates or navigation.
- **Offline Portability:** Remains fully functional without an internet connection, relying on local SQLite databases and `.slja` archives.

## Future Expansion Goals
- **Mobile Companion Apps:** Remote control of presentations and services via smartphones.
- **Cloud Sync:** Synchronizing schedules, themes, and media seamlessly across devices.
- **Advanced Broadcasting:** Deeper integrations with streaming software like OBS or NDI for live broadcasting environments.