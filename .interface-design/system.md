# LouvorJA Design System

## Intent

**Who:** Worship leaders, musicians, and tech volunteers at Brazilian churches. Operating under time pressure during live services — the pastor changes the reading, the next hymn needs queuing. Previous tool was a Delphi desktop app; users know church projection software deeply.

**Task:** Project worship content (lyrics, Bible passages, slides, videos) to a congregation in real time. Zero tolerance for visible mistakes — wrong verse or frozen slide is seen by everyone.

**Feel:** Like a well-worn hymnal. Warm, quiet, reverent but functional. The tool recedes; the content (lyrics, scripture) leads. Not flashy, not corporate. Warm enough for a sacred space, structured enough for reliability under pressure.

---

## Domain

**Concepts:** Liturgy, hymnal, congregation, sanctuary, pulpit, worship order (ordem de culto), projection screen, choir loft, verse/chorus structure, Bible chapter-and-verse, candlelight, stained glass, wooden pews, communion table, sheet music stands.

**Color world:** Warm wood tones (honey, walnut, mahogany), candlelight amber, cream/off-white hymnal pages, deep blue stained glass, muted gold communion ware, forest green altar cloth.

**Signature — The Verse Marker:** A subtle left-edge accent echoing how printed hymnals mark verse numbers with a typographic indent. Manifests as a `2px solid primary` left border on active/selected items throughout the app:
- Sidebar: active route
- Service item list: currently projected item
- Hymn lyrics: current verse
- Bible: current verse
- Any list where "you are here" matters

Width: `2px`. Color: `var(--theme-primary)`. No glow, no animation — just a quiet mark.

**Rejected defaults:**
- ~~Generic SaaS sidebar~~ → Hymnal table of contents feel
- ~~Card grid dashboard~~ → Liturgy is sequential; timeline/list is primary
- ~~Cold corporate blue identity~~ → Domain is warm wood and candlelight

---

## Color Architecture

### Token Layer
CSS variables in `@theme` block reference `var(--theme-*)` properties that change per theme.

| Tailwind Token | CSS Variable | Maps to |
|---------------|-------------|---------|
| `bg-primary` | `--color-primary` | `var(--theme-primary)` |
| `bg-primary-hover` | `--color-primary-hover` | `var(--theme-primary-hover)` |
| `text-primary-foreground` | `--color-primary-foreground` | `var(--theme-primary-foreground)` |
| `bg-background` | `--color-background` | `var(--theme-bg)` |
| `text-foreground` | `--color-foreground` | `var(--theme-fg)` |
| `bg-surface` | `--color-surface` | `var(--theme-surface)` |
| `bg-surface-hover` | `--color-surface-hover` | `var(--theme-surface-hover)` |
| `border-border` | `--color-border` | `var(--theme-border)` |
| `bg-muted` | `--color-muted` | `var(--theme-muted)` |
| `text-muted-foreground` | `--color-muted-foreground` | `var(--theme-muted-fg)` |
| `bg-destructive` | `--color-destructive` | `#dc2626` (fixed) |
| `bg-accent` | `--color-accent` | `var(--theme-accent)` |
| `text-accent-foreground` | `--color-accent-foreground` | `var(--theme-accent-fg)` |

### Theme Palettes

#### Azure (Default) — Chapel Blue
Stained glass blue with hymnal-page warmth. The default experience.
```
primary: #2563a8    primary-hover: #1d5590    primary-fg: #ffffff
bg: #f9f8f6         fg: #1a1a1a
surface: #fefefe    surface-hover: #f0efed
border: #ddd9d4     muted: #f5f4f2    muted-fg: #595959
accent: #e8eef6     accent-fg: #1d5590
```

#### White — Parchment
Warm paper tone. Monochrome with cream undertones.
```
primary: #1a1a1a    primary-hover: #333333    primary-fg: #ffffff
bg: #fdfcfa         fg: #1a1a1a
surface: #faf9f7    surface-hover: #f0efed
border: #e2dfd9     muted: #f5f3f0    muted-fg: #595959
accent: #f0eeeb     accent-fg: #1a1a1a
```

#### Gray — Wood-Paneled Study
Dark theme with warm charcoal undertones. Evening study, not IDE.
```
primary: #4a90d9    primary-hover: #3a7bc8    primary-fg: #ffffff
bg: #2c2a28         fg: #e0e0e0
surface: #363432    surface-hover: #403e3b
border: #4a4744     muted: #322f2d    muted-fg: #b0b0b0
accent: #3a3836     accent-fg: #6eb0f5
```

#### Orange — Candlelight Amber
Dark honey, not bright tangerine. Deepened from #e67e22 to #b05a0f for AA compliance in both directions (text-on-bg AND white-on-button).
```
primary: #b05a0f    primary-hover: #8f4c0d    primary-fg: #ffffff
bg: #fdf6ee         fg: #2c2c2c
surface: #ffffff    surface-hover: #fef0e0
border: #f0d9b5     muted: #fdf2e9    muted-fg: #6b5535
accent: #fdebd0     accent-fg: #9a4c00
```

#### Black — Sanctuary at Night
Deep dark with warm shadows. One lamp in a quiet sanctuary.
```
primary: #0078d4    primary-hover: #1a8ae6    primary-fg: #ffffff
bg: #0c0b0a         fg: #e5e5e5
surface: #151413    surface-hover: #1f1e1c
border: #2a2826     muted: #1b1a18    muted-fg: #888888
accent: #1a1a2e     accent-fg: #4a9eed
```

### Destructive Color
Fixed across all themes: `#dc2626` (red). Does not vary by theme. Used for delete actions, error states, and critical warnings only.

---

## Typography

**Typeface:** Inter — clean, neutral, professional. Loaded via `@font-face` in `src/styles/fonts.css`. Other fonts (Montserrat, Open Sans, Lato, Roboto, Playfair Display) are for slide/projection rendering only.

### Scale (Desktop App Density)
| Token | Size | Tailwind | Usage |
|-------|------|----------|-------|
| `--text-display` | 24px / 1.5rem | `text-2xl` | Page titles, hero metrics |
| `--text-heading` | 18px / 1.125rem | `text-lg` | Section headers |
| `--text-body` | 14px / 0.875rem | `text-sm` | Default body (desktop base) |
| `--text-caption` | 12px / 0.75rem | `text-xs` | Metadata, timestamps, labels |
| `--text-micro` | 11px / 0.6875rem | `text-[11px]` | Status bar, badges |

### Weights
| Token | Value | Usage |
|-------|-------|-------|
| `--weight-normal` | 400 | Body text, descriptions |
| `--weight-medium` | 500 | Labels, nav items, table headers |
| `--weight-semibold` | 600 | Headings, emphasis, buttons |
| `--weight-bold` | 700 | Display text, hero numbers |

### Letter Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | -0.01em | Headings, display text |
| `--tracking-normal` | 0 | Body text |
| `--tracking-wide` | 0.025em | Uppercase labels, micro text |

---

## Depth Strategy

**Approach:** Borders-only with whisper-quiet surface shifts. No shadows.

Hymnals don't have drop shadows. Structure comes from lines and paper weight, not dimensional lift. This keeps the interface feeling printed/physical rather than digital.

### Elevation Scale
| Level | Usage | Treatment |
|-------|-------|-----------|
| 0 — Canvas | Page background | `bg-background` |
| 1 — Surface | Cards, panels, sidebar | `bg-surface` + `border border-border` |
| 2 — Raised | Dropdowns, popovers | `bg-surface` + `border border-border` (or `border-emphasis`) |
| 3 — Overlay | Modals, command palette | `bg-surface` + stronger border + `backdrop-blur-sm` |

### Border Hierarchy
| Token | Light Themes | Dark Themes | Usage |
|-------|-------------|-------------|-------|
| `--border-subtle` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)` | Internal card divisions |
| `--border-default` | `var(--theme-border)` | `var(--theme-border)` | Standard separation |
| `--border-emphasis` | `rgba(0,0,0,0.15)` | `rgba(255,255,255,0.15)` | Focus rings, active states |

---

## Spacing

**Base unit:** 4px. All spacing is multiples of 4.

| Context | Tailwind | Pixels | Usage |
|---------|----------|--------|-------|
| Micro | `gap-1` | 4px | Icon-to-text, inline elements |
| Tight | `gap-1.5` | 6px | Within compact components |
| Standard | `gap-2` / `p-2` | 8px | Component internal padding |
| Comfortable | `gap-3` / `p-3` | 12px | Card content padding |
| Section | `gap-4` / `p-4` | 16px | Between related groups |
| Region | `gap-6` / `p-6` | 24px | Between major sections |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Inputs, buttons, badges |
| `rounded-md` | 6px | Cards, panels |
| `rounded-lg` | 8px | Modals, large containers |

The scale is intentionally tight/small — feels more like paper edges than bubbly app UI.

---

## Icons

**Library:** `lucide-react` (v0.563.0). Named imports only. No additional icon packages.

| Size | Tailwind | Usage |
|------|----------|-------|
| Small | `h-3 w-3` (12px) | Inline, badges |
| Default | `h-4 w-4` (16px) | Standard controls |
| Medium | `h-3.5 w-3.5` (14px) | Compact contexts |
| Large | `h-5 w-5` (20px) | Headers, empty states |

Decorative icons: `aria-hidden="true"`. Interactive icons: wrapped in button with `aria-label`.

---

## Component Patterns

### Active State (Verse Marker)
```
border-l-2 border-primary bg-accent/50
```
Used on: sidebar nav items, service item list, verse highlights.

### Interactive Hover
```
hover:bg-surface-hover transition-colors
```

### Focus Ring
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
```

### Card
```
bg-surface border border-border rounded-md
```
No shadow. Internal divisions use `border-subtle`.

### Input
```
bg-muted/50 border border-border rounded-sm text-sm
focus:border-primary focus:ring-2 focus:ring-primary/20
```
Inputs are slightly darker than surroundings (inset feel).

### Button (Primary)
```
bg-primary text-primary-foreground hover:bg-primary-hover rounded-sm font-medium text-sm
```

### Button (Ghost)
```
hover:bg-surface-hover text-foreground rounded-sm
```

---

## Checklist for New UI Work

Before building any new component or screen:

1. [ ] Does it use only design token colors? No hardcoded hex (except destructive `#dc2626`).
2. [ ] Does it follow the elevation scale? (Canvas → Surface → Raised → Overlay)
3. [ ] Does it use the border hierarchy? (`subtle` for internals, `default` for edges, `emphasis` for focus)
4. [ ] Does active/selected state use the verse marker pattern? (left border, not full background highlight)
5. [ ] Does typography follow the scale? (display → heading → body → caption → micro)
6. [ ] Are interactive elements accessible? (aria-label on icon buttons, focus-visible ring, keyboard nav)
7. [ ] Does spacing follow the 4px grid?
8. [ ] Does it work across all 5 themes? (Check warm/cool, light/dark)
9. [ ] Would another AI produce something that looks different? If not, you've defaulted.
