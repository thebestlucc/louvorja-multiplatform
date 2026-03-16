# Product Guidelines

## UI/UX Design Language
- **Minimalist & High-Contrast:** Focus on readability, utilizing Radix UI primitives to ensure a clean, uncluttered interface.
- **Dark Mode First:** Optimized for low-light environments typical of AV booths and projection setups.
- **Rich & Animated:** Employ polished visual feedback, smooth transitions, and high-quality animations to make the application feel modern and responsive.
- **Thumbnail Layout Guardrails:** Apply `min-w-0` on flex wrappers and use `break-all` for long identifiers to prevent layout overflow.

## Prose & Tone
- **Clear & Professional:** UI text and documentation should offer direct, unambiguous instructions. The tone must be accessible to users of all technical skill levels, from volunteers to advanced operators.
- **Pastoral Error Messaging:** Use the `classifyUpdateError` pattern to provide reassuring, actionable error messages with clear "why" and "action" sections.

## Accessibility (a11y)
- **Keyboard Navigability:** First-class support for keyboard-only workflows, including a comprehensive Command Palette (Cmd+K) and global shortcuts (e.g., B for Black, L for Logo).
- **Screen Reader Support:** Strict adherence to semantic HTML and proper ARIA labeling for assistive technologies.
- **High Contrast & Scaling:** Ensure UI elements and text remain legible at a distance and on sub-optimal monitor setups.

## Internationalization (i18n)
- **Primary Language:** Development and primary content are centralized around **pt-BR** (Brazilian Portuguese).
- **Strict Multi-Locale:** All new features must support `en`, `pt`, and `es` simultaneously. Missing keys render as raw strings, which must be avoided.
- **Community-Driven Translation:** The platform must provide necessary tooling for the community to submit and manage their own translations.

## Architectural Guidelines
- **Standardized Error Handling:** **ALWAYS use `catcher`** utilities (TS/Rust) instead of manual `try-catch` or `match` destructuring. This ensures consistent error reporting, auto-notifications, and aligns with the project's pastoral error messaging philosophy.
- **Realtime Sync Rule:** Use pub/sub events (Tauri emitters) for live projection state. Never rely on periodic polling as the primary synchronization path.
- **Managed Media Paths:** Persist only relative paths (`media/videos/...`) in slide content; resolve to absolute paths/asset URLs only at runtime.
- **Service-Aware Updates:** Suppress update banners during live projection (`isProjectorOpen || isPlayingService`).