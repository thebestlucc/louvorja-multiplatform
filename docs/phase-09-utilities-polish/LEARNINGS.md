# Phase 09 Learnings - Sidebar Thumbnail Overflow

Date: 2026-02-17
Scope: Presentation editor sidebar thumbnails (video slide type)

## Incident Summary

When slide type was set to `video` and a file was selected, the thumbnail card could overflow horizontally in the sidebar.

## Root Cause

1. The video thumbnail label rendered long filenames with single-line behavior (`whitespace-nowrap` + `truncate`), which can keep a large min-content width in constrained flex layouts.
2. Not all layout levels in the thumbnail list had explicit `min-w-0`, so children could refuse to shrink when combined with scrollbar/action overlays.
3. Thumbnail mode and return-next mode shared formatting assumptions even though thumbnail space is significantly tighter.

## Fix Applied

1. Enforced shrink constraints through the thumbnail list chain:
- `min-w-0` on sortable item wrapper.
- `min-w-0` on thumbnail button root.
- Right padding on list container to avoid scrollbar overlap pressure.
2. Introduced thumbnail-specific video label rendering:
- Wrapped/broken text (`break-all`) in thumbnail mode.
- Clipped overflow within the thumbnail card.
3. Kept return-next formatting separate, preserving existing behavior where width constraints are less aggressive.

## Preventive Guardrails

1. In any constrained flex layout, apply `min-w-0` at each parent boundary that wraps potentially long text.
2. Avoid single-line truncation for untrusted/variable-length identifiers (filenames, UUID-like strings) in compact cards.
3. Use render-mode-specific UI constraints (`thumbnail`, `return-next`, `editor`) rather than one-size-fits-all text classes.
4. Treat overlay scrollbars and hover action buttons as width consumers during layout design.

## Regression Checklist (UI)

Run before considering similar UI changes complete:

1. Test at zoom 100%, 125%, and 150%.
2. Test with long unbroken filenames (for example, long hash-like names).
3. Confirm active ring/border effects do not escape the card bounds.
4. Confirm drag handle and duplicate/delete controls remain usable.
5. Run:
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`
