# Sidebar/App Shell Refactor + Bug Fixes + Font Size Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the sidebar/app shell UI inspired by modern navigation references, fix three bugs (Bible image tab, active service visibility, mediaIntegrity removal), and add a global presentation font-size setting.

**Architecture:** Each task is self-contained. Bug fixes are surgical 1-3 line changes. The sidebar refactor is CSS-only (no logic changes). The font-size setting follows the existing plugin-store pattern. Sub-agents handle one task each.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, TanStack Router, Zustand, i18next, Tauri plugin-store (`getPreference`/`setPreference`).

---

## File Map

| File | Change |
|------|--------|
| `src/components/bible/projection-settings.tsx` | Fix `bgType` null-check (Task 1) |
| `src/components/layout/sidebar.tsx` | Fix active service visibility + visual refactor (Tasks 2, 5) |
| `src/routes/utilities/index.tsx` | Remove integrity card entry (Task 3) |
| `src/routes/utilities/integrity.tsx` | Delete entire file (Task 3) |
| `src/lib/queries/display.ts` | Remove `useMediaIntegrity`/`useDeleteExcessMedia` hooks (Task 3) |
| `src/lib/tauri/utilities.ts` | Remove `scanMediaIntegrity`/`deleteExcessMedia` wrappers (Task 3) |
| `src/lib/queries/keys.ts` | Remove `mediaIntegrity` key (Task 3) |
| `src/locales/en.json` | Remove `mediaIntegrity` block (Task 3) |
| `src/locales/pt.json` | Remove `mediaIntegrity` block (Task 3) |
| `src/locales/es.json` | Remove `mediaIntegrity` block (Task 3) |
| `src/lib/use-presentation-font-size.ts` | New shared hook for global font size (Task 4) |
| `src/components/settings/general-section.tsx` | Add presentation font-size slider (Task 4) |
| `src/components/slides/slide-renderer.tsx` | Thread global font-size into `renderSlide` for lyrics (Task 4) |
| `src/components/layout/status-bar.tsx` | Visual polish for bottom bar (Task 6) |

---

## Task 1: Fix Bible Image Background Tab Bug

**Files:**
- Modify: `src/components/bible/projection-settings.tsx:152-156`

**Root cause:** `settings.backgroundImage || ""` stores empty string `""` when user clicks "image" tab. But `bgType` uses a truthy check: `settings.backgroundImage ? "image" : "solid"`. Empty string is falsy → falls back to "solid" tab instantly.

- [ ] **Step 1: Read the file to confirm the bug location**

  Read `src/components/bible/projection-settings.tsx`, lines 152-156 and 175-180.

  Expected: `settings.backgroundImage ? "image" : "solid"` on line 154.
  And: `backgroundImage: settings.backgroundImage || "",` on line ~179.

- [ ] **Step 2: Fix the null-check in `bgType` computation**

  In `src/components/bible/projection-settings.tsx`, change:
  ```typescript
  // BEFORE (line ~154)
  const bgType: "solid" | "gradient" | "image" = settings.backgroundGradient
    ? "gradient"
    : settings.backgroundImage
      ? "image"
      : "solid";
  ```
  To:
  ```typescript
  // AFTER
  const bgType: "solid" | "gradient" | "image" = settings.backgroundGradient
    ? "gradient"
    : settings.backgroundImage !== null
      ? "image"
      : "solid";
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: No errors related to this file.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/bible/projection-settings.tsx
  git commit -m "fix(bible): fix image background tab reverting to solid on empty path"
  ```

---

## Task 2: Fix Active Service Visibility in Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx:90-105, 329-347`

**Root cause:** The active service link at sidebar bottom shows on ALL routes (including the active service's own detail page). It should be hidden when already viewing that specific service's detail page (redundant there), and shown on all other routes.

- [ ] **Step 1: Read the sidebar component**

  Read `src/components/layout/sidebar.tsx`, lines 90-105 and 325-350.

- [ ] **Step 2: Add route check to hide service link on its own detail page**

  In `src/components/layout/sidebar.tsx`, the `Sidebar` function already has access to `pathname` (line 100). Add a check:

  ```typescript
  // Add after line 101 (after searchParams definition)
  const isOnActiveServiceRoute =
    activeServiceId !== null &&
    (pathname === `/services/${activeServiceId}` ||
      pathname.startsWith(`/services/${activeServiceId}/`));
  ```

  Then change the render condition at line 329:
  ```typescript
  // BEFORE
  {activeServiceId && activeServiceData && (

  // AFTER
  {activeServiceId && activeServiceData && !isOnActiveServiceRoute && (
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/layout/sidebar.tsx
  git commit -m "fix(sidebar): hide active service link when viewing that service's detail page"
  ```

---

## Task 3: Remove mediaIntegrity Feature

**Files:**
- Modify: `src/routes/utilities/index.tsx` (remove integrity card entry)
- Delete: `src/routes/utilities/integrity.tsx`
- Modify: `src/lib/queries/display.ts` (remove hooks)
- Modify: `src/lib/queries/keys.ts` (remove key)
- Modify: `src/locales/en.json`, `pt.json`, `es.json` (remove i18n block)

**Note:** Also remove the `FileSearch` icon import from utilities/index.tsx if it's only used for the integrity card.

- [ ] **Step 1: Read utilities index and confirm FileSearch import usage**

  Read `src/routes/utilities/index.tsx` fully.

- [ ] **Step 2: Remove the integrity card from utilities index**

  In `src/routes/utilities/index.tsx`:
  - Remove the `FileSearch` import from `lucide-react` if only used for integrity
  - Remove this entry from the `tools` array:
    ```typescript
    {
      to: "/utilities/integrity",
      icon: FileSearch,
      title: t("mediaIntegrity.title"),
      description: t("mediaIntegrity.description"),
    },
    ```

- [ ] **Step 3: Delete the integrity route file**

  Delete: `src/routes/utilities/integrity.tsx`

  ```bash
  rm src/routes/utilities/integrity.tsx
  ```

- [ ] **Step 4: Remove mediaIntegrity query key**

  Read `src/lib/queries/keys.ts`, find line 59: `mediaIntegrity: ["mediaIntegrity"] as const,`
  Delete that line.

- [ ] **Step 5: Remove query hooks from display.ts**

  Read `src/lib/queries/display.ts`, lines 108-130.
  Remove `useMediaIntegrity` and `useDeleteExcessMedia` function exports entirely.
  Also remove any imports they depend on that are no longer needed (e.g., `scanMediaIntegrity`, `deleteExcessMedia` imports from `../tauri/utilities`).

- [ ] **Step 5b: Remove Tauri wrappers from utilities.ts**

  Read `src/lib/tauri/utilities.ts`, find `scanMediaIntegrity` (~line 92) and `deleteExcessMedia` (~line 96).
  Remove both exported functions.
  Also remove `MediaIntegrityReport` from the import on line 3 (it's auto-generated in `bindings.ts` — do NOT edit `bindings.ts`).

  ```bash
  # Verify no remaining callers
  grep -rn "scanMediaIntegrity\|deleteExcessMedia\|useMediaIntegrity\|useDeleteExcessMedia" src/ --include="*.ts" --include="*.tsx"
  # Expected: 0 results
  ```

- [ ] **Step 6: Remove i18n keys from all three locales**

  In each of `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`:
  Find and remove the entire `"mediaIntegrity": { ... }` block (approximately 13 lines each).

  ```bash
  # Check the line numbers before editing
  grep -n '"mediaIntegrity"' src/locales/en.json src/locales/pt.json src/locales/es.json
  ```

- [ ] **Step 7: Verify TypeScript compiles and no stale imports remain**

  Run: `npx tsc --noEmit`
  Expected: No errors. If any file still imports from integrity.tsx or the removed hooks, fix them.

- [ ] **Step 8: Rebuild routes (route tree regeneration)**

  Run: `pnpm vite build`
  Expected: Build succeeds, `routeTree.gen.ts` regenerated without the integrity route.

- [ ] **Step 9: Commit**

  ```bash
  git add -u
  git commit -m "chore: remove mediaIntegrity feature and related code"
  ```

---

## Task 4: Add Global Presentation Font-Size Setting

**Goal:** Add a General settings section with a font-size slider (24–72px) that sets the default text size for projected hymnal lyrics, collection music, and Bible (as its default value).

**Files:**
- Create: `src/lib/use-presentation-font-size.ts` (shared hook + constants)
- Modify: `src/components/settings/general-section.tsx` (add slider UI)
- Modify: `src/components/slides/slide-renderer.tsx` (thread global font-size into `renderSlide`)

**Storage:** Plugin-store key `"presentation.defaultFontSize"` (number, default 48).

**Key architecture note:** `renderSlide` is a plain function (not a React component) inside `slide-renderer.tsx`. The hook result must be captured in the `SlideRenderer` component and passed as a new parameter to `renderSlide`. Line 99 (`textStyle(slide, 36, renderMode, "lyrics")`) is the exact target — `36` is the `fallbackSize` parameter to `textStyle`.

- [ ] **Step 1: Read the files**

  Read `src/components/settings/general-section.tsx` fully.
  Read `src/components/slides/slide-renderer.tsx` lines 1-60 and 415-455 (to understand `textStyle` signature).

- [ ] **Step 2: Create shared hook file**

  Create `src/lib/use-presentation-font-size.ts`:

  ```typescript
  import { useEffect, useState } from "react";
  import { catcher } from "./catcher";
  import { getPreference, setPreference } from "./store";

  export const PRESENTATION_FONT_SIZE_KEY = "presentation.defaultFontSize";
  export const DEFAULT_PRESENTATION_FONT_SIZE = 48;

  /** Read-only hook: returns the global presentation font size (async loaded from plugin-store). */
  export function usePresentationFontSize(): number {
    const [size, setSize] = useState(DEFAULT_PRESENTATION_FONT_SIZE);
    useEffect(() => {
      void catcher(
        getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE),
      ).then(([saved]) => {
        if (saved != null) setSize(saved);
      });
    }, []);
    return size;
  }

  /** Read-write hook for the settings UI. */
  export function usePresentationFontSizeSetting() {
    const [fontSize, setFontSize] = useState(DEFAULT_PRESENTATION_FONT_SIZE);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      const load = async () => {
        const [saved] = await catcher(
          getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE),
        );
        if (saved != null) setFontSize(saved);
        setLoaded(true);
      };
      void load();
    }, []);

    const updateFontSize = (val: number) => {
      setFontSize(val);
      void catcher(setPreference(PRESENTATION_FONT_SIZE_KEY, val));
    };

    return { fontSize, updateFontSize, loaded };
  }
  ```

- [ ] **Step 3: Add font-size slider to GeneralSection UI**

  In `src/components/settings/general-section.tsx`:
  - Add import: `import { usePresentationFontSizeSetting } from "../../lib/use-presentation-font-size";`
  - Add import: `import { Slider } from "../ui/slider";` (if not already present)
  - Call `usePresentationFontSizeSetting()` inside `GeneralSection`
  - Add a new "Projection" section in the JSX:

  ```tsx
  const { fontSize, updateFontSize } = usePresentationFontSizeSetting();

  // Add in JSX (e.g., after existing sections):
  <section>
    <h3 className="mb-3 text-sm font-medium">{t("settings.presentationTitle")}</h3>
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground shrink-0 w-32">
        {t("settings.presentationFontSize")}
      </span>
      <Slider
        value={[fontSize]}
        onValueChange={([val]) => updateFontSize(val)}
        min={24}
        max={72}
        step={2}
        className="flex-1"
        aria-label={t("settings.presentationFontSize")}
      />
      <span className="text-sm tabular-nums text-muted-foreground w-10 text-right">
        {fontSize}px
      </span>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">
      {t("settings.presentationFontSizeHint")}
    </p>
  </section>
  ```

- [ ] **Step 4: Add i18n keys to all three locales**

  In `src/locales/en.json` (inside the `"settings": { ... }` block):
  ```json
  "presentationTitle": "Projection",
  "presentationFontSize": "Default font size",
  "presentationFontSizeHint": "Applies to hymnal lyrics, collection music, and Bible projections."
  ```

  In `src/locales/pt.json` (inside the `"settings": { ... }` block):
  ```json
  "presentationTitle": "Projeção",
  "presentationFontSize": "Tamanho de fonte padrão",
  "presentationFontSizeHint": "Aplicado a letras de hinos, músicas de coleção e projeções bíblicas."
  ```

  In `src/locales/es.json` (inside the `"settings": { ... }` block):
  ```json
  "presentationTitle": "Proyección",
  "presentationFontSize": "Tamaño de fuente predeterminado",
  "presentationFontSizeHint": "Aplicado a letras de himnos, músicas de colección y proyecciones bíblicas."
  ```

- [ ] **Step 5: Thread globalFontSize into slide-renderer**

  In `src/components/slides/slide-renderer.tsx`:

  1. Add import at top:
     ```typescript
     import { usePresentationFontSize } from "../../lib/use-presentation-font-size";
     ```

  2. In `SlideRenderer` component (around line 17), add hook call and pass to `renderSlide`:
     ```typescript
     // Inside SlideRenderer component body, before the return:
     const globalFontSize = usePresentationFontSize();

     // Update the renderSlide call on line 44:
     // BEFORE:
     {renderSlide(slide, renderMode, t, resolvedBackgroundPath, resolvedImagePath)}
     // AFTER:
     {renderSlide(slide, renderMode, t, resolvedBackgroundPath, resolvedImagePath, globalFontSize)}
     ```

  3. Update `renderSlide` function signature (around line 49):
     ```typescript
     // BEFORE:
     function renderSlide(
       slide: SlideContent | null,
       renderMode: SlideRenderMode,
       t: (key: string) => string,
       resolvedBackgroundPath: string | null,
       resolvedImagePath: string | null,
     )

     // AFTER:
     function renderSlide(
       slide: SlideContent | null,
       renderMode: SlideRenderMode,
       t: (key: string) => string,
       resolvedBackgroundPath: string | null,
       resolvedImagePath: string | null,
       globalFontSize: number = 48,
     )
     ```

  4. Update the lyrics slide fallback on line 99:
     ```typescript
     // BEFORE:
     const textLineStyle = textStyle(slide, 36, renderMode, "lyrics");

     // AFTER:
     const textLineStyle = textStyle(slide, globalFontSize, renderMode, "lyrics");
     ```

- [ ] **Step 6: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: No errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/lib/use-presentation-font-size.ts \
          src/components/settings/general-section.tsx \
          src/components/slides/slide-renderer.tsx \
          src/locales/en.json src/locales/pt.json src/locales/es.json
  git commit -m "feat(settings): add global presentation font-size setting"
  ```

---

## Task 5: Sidebar Visual Refactor

**Goal:** Refresh the sidebar UI inspired by modern reference designs. Add left-border accent for active items, improve sub-item visual hierarchy with connecting lines, refine collapsed mode. Preserve ALL existing logic (children, hover popover, tooltip, active detection).

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (visual classes only)

**Design principles (from references):**
1. **Active items**: Left accent border (2px primary) + subtle background — stronger visual indicator than background alone
2. **Sub-items**: Left connecting border line from parent, smaller text, accent color when active
3. **Icon-only mode**: Clean, no labels, icons centered, tooltips on right
4. **Sidebar header**: Clean toggle button, app name in primary color
5. **Transitions**: 150ms for color changes, 200ms for width

- [ ] **Step 1: Read the full sidebar component**

  Read `src/components/layout/sidebar.tsx` fully.

- [ ] **Step 2: Refactor active item styles for items WITHOUT children**

  Find the `link` variable definition (around line 287-314). Change active styling from:
  ```typescript
  // BEFORE
  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
  ```
  To:
  ```typescript
  // AFTER
  isActive
    ? "border-l-2 border-primary bg-accent/60 text-foreground font-medium pl-[10px]"
    : "border-l-2 border-transparent text-muted-foreground pl-[10px]",
  ```

  Also adjust base classes to remove `px-3` (since we're handling left padding manually):
  ```typescript
  "flex items-center gap-3 rounded-r-md py-2 text-sm transition-colors",
  "hover:bg-surface-hover hover:text-foreground",
  isActive
    ? "border-l-2 border-primary bg-accent/60 text-foreground font-medium pl-[10px] pr-3"
    : "border-l-2 border-transparent text-muted-foreground pl-[10px] pr-3",
  !sidebarOpen && "justify-center pl-0 pr-0 border-l-0 rounded-md",
  ```

- [ ] **Step 3: Refactor active item styles for items WITH children (parent row)**

  Find the parent row div (around line 229-257). Change the outer wrapper div's classes:
  ```typescript
  // BEFORE (outer div)
  "flex items-center rounded-md text-sm font-medium transition-colors",
  "hover:bg-surface-hover",
  anyChildIsActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",

  // AFTER (outer div)
  "flex items-center rounded-r-md text-sm transition-colors hover:bg-surface-hover hover:text-foreground",
  anyChildIsActive
    ? "border-l-2 border-primary bg-accent/60 text-foreground font-medium"
    : "border-l-2 border-transparent text-muted-foreground",
  ```

  Also update the inner `<Link>` inside this parent row (line ~237) from `px-3` to `pl-[10px] pr-3` to keep consistent left spacing with the border:
  ```typescript
  // BEFORE (inner Link):
  className="flex flex-1 items-center gap-3 px-3 py-2"
  // AFTER:
  className="flex flex-1 items-center gap-3 pl-[10px] pr-3 py-2"
  ```

- [ ] **Step 4: Refactor sub-item visual hierarchy (expand/collapse children)**

  Find the sub-items container div (around line 259-280). Replace:
  ```typescript
  // BEFORE
  <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
  ```
  With:
  ```typescript
  // AFTER — left border line connecting sub-items to parent
  <div className="mt-0.5 flex flex-col gap-0.5 ml-[13px] border-l border-border pl-3">
  ```

  And update sub-item Link styles:
  ```typescript
  // BEFORE
  "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
  "hover:bg-surface-hover",
  childActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
  ```
  To:
  ```typescript
  // AFTER
  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
  "hover:bg-surface-hover hover:text-foreground",
  childActive ? "text-primary font-medium bg-accent/40" : "text-muted-foreground",
  ```

- [ ] **Step 5: Improve sidebar header**

  Find the header div (lines 138-156). Update to:
  ```tsx
  <div className="flex h-12 items-center justify-between border-b border-border px-3">
    {sidebarOpen && (
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {t("app.name")}
        </span>
      </div>
    )}
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      className={cn("h-8 w-8 shrink-0", !sidebarOpen && "mx-auto")}
    >
      {sidebarOpen ? (
        <PanelLeftClose className="h-4 w-4" />
      ) : (
        <PanelLeft className="h-4 w-4" />
      )}
    </Button>
  </div>
  ```

- [ ] **Step 6: Refine the active service indicator at sidebar bottom**

  Find lines 329-347 (active service section). Update the styling:
  ```tsx
  {activeServiceId && activeServiceData && !isOnActiveServiceRoute && (
    <div className="border-t border-border px-2 py-2">
      <Link
        to="/services/$serviceId"
        params={{ serviceId: String(activeServiceId) }}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          "bg-primary/10 text-primary hover:bg-primary/20",
          !sidebarOpen && "justify-center px-0",
        )}
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0" />
        {sidebarOpen && (
          <span className="truncate">{activeServiceData.service.title}</span>
        )}
      </Link>
    </div>
  )}
  ```

- [ ] **Step 7: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: No errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/components/layout/sidebar.tsx
  git commit -m "feat(ui): refactor sidebar visual design with accent border and sub-item lines"
  ```

---

## Task 6: Status Bar Visual Polish

**Goal:** Polish the existing bottom status bar to look more cohesive as the "bottom dock" — slightly more refined spacing, consistent icon sizing, cleaner separators.

**Files:**
- Modify: `src/components/layout/status-bar.tsx`

- [ ] **Step 1: Read the status bar component**

  Read `src/components/layout/status-bar.tsx` fully.

- [ ] **Step 2: Improve separator and button styles**

  Current separators: `<div className="mx-1 h-4 w-px bg-border" />`
  Current button base: `"flex min-h-[28px] items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10"`

  The `hover:bg-white/10` doesn't respect the theme. Replace with `hover:bg-surface-hover`.

  Also update the footer height from `h-10` to `h-9` and add `shrink-0` to ensure it never collapses:
  ```tsx
  // BEFORE
  <footer className="flex h-10 items-center justify-between border-t border-border bg-surface px-4 text-xs text-muted-foreground">

  // AFTER
  <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-xs text-muted-foreground">
  ```

  Update all `hover:bg-white/10` in button classNames to `hover:bg-surface-hover`.

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/layout/status-bar.tsx
  git commit -m "feat(ui): polish status bar spacing and theme-aware hover states"
  ```

---

## Validation

After all tasks complete:

- [ ] Run `pnpm vite build` — must succeed
- [ ] Run `npx tsc --noEmit` — must have zero errors
- [ ] Manually verify:
  - [ ] Bible: click "Image" background tab → stays on Image tab (not reverting to Solid)
  - [ ] Navigate to an active service's detail page → active service link disappears from sidebar bottom
  - [ ] Navigate away from service detail → active service link reappears in sidebar bottom
  - [ ] Utilities page → no "Library Integrity" card
  - [ ] Settings > General → font size slider present, changing it affects hymnal projection
  - [ ] Sidebar visual: active items show left accent border, sub-items show connecting line
  - [ ] Collapsed sidebar: icons centered, no broken layout
