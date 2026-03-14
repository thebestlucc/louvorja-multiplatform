# Specification: Architectural Refactoring and Security Hardening

## 1. Overview
This track focuses on improving the backend maintainability and security posture of the LouvorJA Multiplatform application by adopting Tauri 2.0 best practices.

## 2. Goals
- **Decompose `display.rs`**: Split the monolithic module into domain-specific sub-modules for monitor detection, window management, and projection synchronization.
- **Harden Capabilities**: Replace generic `:default` permissions with granular, command-level access control.
- **Secure Path Utility**: Implement a robust utility for canonicalizing and validating media paths to prevent traversal attacks.
- **State Optimization**: Evaluate and potentially transition high-frequency state updates to `RwLock`.

## 3. Technical Requirements
- Modular Rust architecture using `mod.rs` and sub-files.
- Tauri 2.0 Capability JSON schema compliance.
- Comprehensive unit tests for the new path utility.
- Zero functional regression in multi-monitor projection.