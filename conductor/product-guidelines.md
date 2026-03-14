# Product Guidelines

## UI/UX Design Language
- **Minimalist & High-Contrast:** Focus on readability, utilizing Radix UI primitives to ensure a clean, uncluttered interface.
- **Dark Mode First:** Optimized for low-light environments typical of AV booths and projection setups.
- **Rich & Animated:** Employ polished visual feedback, smooth transitions, and high-quality animations to make the application feel modern and responsive.

## Prose & Tone
- **Clear & Professional:** UI text and documentation should offer direct, unambiguous instructions. The tone must be accessible to users of all technical skill levels, from volunteers to advanced operators.

## Accessibility (a11y)
- **Keyboard Navigability:** First-class support for keyboard-only workflows, including a comprehensive Command Palette (Cmd+K) and global shortcuts.
- **Screen Reader Support:** Strict adherence to semantic HTML and proper ARIA labeling for assistive technologies.
- **High Contrast & Scaling:** Ensure UI elements and text remain legible at a distance and on sub-optimal monitor setups.

## Internationalization (i18n)
- **Primary Language:** Development and primary content (e.g., music, hymnals) are centralized around **pt-BR** (Brazilian Portuguese).
- **Strict Multi-Locale:** All new features must support `en`, `pt`, and `es` simultaneously.
- **Community-Driven Translation:** The platform must provide necessary tooling or processes for the community to submit and manage their own translations.