## EXPLORATION SUMMARY

- Scope requested: `/lib/ui/components`.
- Actual component path in this repository: `src/components` (55 files).
- Stack: React 19 + Vite 7 + TanStack Router + Tailwind v4 + Radix primitives.
- UI library mode: `fallback-only` (no `@lerianstudio/sindarian-ui` in `package.json`).
- Standards source loaded: Ring `CLAUDE.md` and `dev-team/docs/standards/frontend.md`.
- Workflow note: `docs/PROJECT_RULES.md` is missing, so strict skill execution is blocked; analysis proceeded in adapted analyze-only mode.

## KEY FINDINGS

1. Accessibility risk from icon-only controls without accessible names.
2. Security risk from `dangerouslySetInnerHTML` usage without local sanitization guard.
3. Design-system drift from heavy raw `<button>` usage and no default `type` in shared Button primitive.
4. Testing coverage gap for component-level behavior, accessibility, visual states, and E2E flows.
5. Oversized multi-responsibility components exceeding Ring frontend component-size guidance.

## ARCHITECTURE INSIGHTS

- UI primitives are centralized under `src/components/ui` and use Radix wrappers (`select`, `dialog`, `tabs`, `tooltip`, etc.).
- Feature components are grouped by domain (`bible`, `slides`, `services`, `music`, etc.), which is good for discoverability.
- State/data fetching patterns are mostly hook-based (`useMonitorsControl`, `useSlides`, query hooks), but some large components mix orchestration + rendering + side effects.
- Manual chunking in `vite.config.ts` shows attention to bundle boundaries, but component-level quality gates (a11y/visual/e2e) are missing.

## RELEVANT FILES

- `package.json:15` (dependency set; no Sindarian UI, no accessibility/E2E test tooling)
- `src/components/ui/button.tsx:36` (shared Button primitive lacks explicit default `type`)
- `src/components/display/slide-nav-bar.tsx:33` (icon-only controls with no `aria-label`)
- `src/components/display/projector-controls.tsx:22` (icon-only controls with `title`, no explicit accessible name)
- `src/components/music/audio-controls.tsx:115` (icon-only `Button` actions without accessible labels)
- `src/components/bible/bible-search.tsx:239` (`dangerouslySetInnerHTML` for search snippet)
- `src/components/slides/slide-renderer.tsx:68` (multiple raw `<img>` in presentation surface)
- `src/components/slides/projector-view.tsx:183` (raw `<img>` for projector logo)
- `src/components/ui/command-palette.tsx:59` (large multi-responsibility component, 532 LOC)
- `src/components/services/add-item-modal.tsx:38` (large multi-form modal, 402 LOC)

## RECOMMENDATIONS

1. Add a hard a11y pass on all icon-only controls (`aria-label`, keyboard and SR verification).
2. Replace/guard `dangerouslySetInnerHTML` with sanitized rendering pipeline for Bible snippets.
3. Standardize interaction components by defaulting `Button` to `type="button"` and reducing raw `<button>` usage.
4. Add component test stack (`@testing-library/react`, `vitest` or equivalent), automated a11y checks (`axe-core`), and Playwright flows for core worship operations.
5. Split oversized components into feature hooks + presentational subcomponents (target <= 300 LOC per component).
6. Create `docs/PROJECT_RULES.md` to unblock strict Ring skill compliance.
