# Presentation Editor Error/Not-Found Handling Proposal

## Context

Finding addressed:

- `[P2] Missing error/not-found handling in presentation editor`
- File: `src/routes/presentations/$presentationId.tsx:107`

Current behavior: when `usePresentation` fails (invalid ID, not found, backend error), the editor shows `hymnal.loading` forever because it only checks `if (!presentation)`.

## Goal

Make the presentation editor recoverable and explicit by distinguishing:

1. Invalid route param
2. Loading
3. Not found
4. Backend/network error
5. Success

## Proposed Changes

## 1) Expose query status from `usePresentation2`

File: `src/hooks/use-presentation.ts`

### Why

`usePresentation2` currently returns only data/actions. The route component has no visibility into query lifecycle (`isLoading`, `isError`, `error`, `refetch`), so it cannot render accurate UI states.

### Suggested update

- Keep existing API surface.
- Add status metadata from both queries:
  - `presentationQuery`
  - `slidesQuery`
  - `isInitialLoading`
  - `isPresentationError`
  - `presentationError`
  - `refetchPresentation`

### Example shape

```ts
const presentationQuery = usePresentation(presentationId);
const slidesQuery = useSlides(presentationId);

const isInitialLoading = presentationQuery.isLoading;
const isPresentationError = presentationQuery.isError;
const presentationError = presentationQuery.error;
```

Return these fields from the hook so the route can render the correct state.

## 2) Add state-aware rendering in the route

File: `src/routes/presentations/$presentationId.tsx`

### Why

The route currently falls through to loading whenever `presentation` is falsy. This conflates loading and failure and blocks user recovery.

### Suggested update

1. Validate route param:
   - `const id = Number(presentationId);`
   - `const isInvalidId = !Number.isInteger(id) || id <= 0;`

2. Early-return UI states in this order:
   - Invalid ID
   - Loading
   - Not found
   - Generic error
   - Success

3. Add a retry action:
   - `refetchPresentation()` from hook metadata.

4. Keep existing editor UI unchanged for success path.

### Not-found detection

Prefer structured detection if available; fallback to message matching:

```ts
const errorMessage = String(presentationError ?? "");
const isNotFound = /not found/i.test(errorMessage);
```

If backend error typing is later standardized, replace string matching with explicit error code.

## 3) Add translation keys for editor-state messages

Files:

- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`

### Why

Current route uses `hymnal.loading`, which is semantically incorrect for presentations and leaves no localized copy for not-found/error recovery states.

### Suggested keys

Under `presentations`:

- `editorLoading`
- `editorNotFoundTitle`
- `editorNotFoundDescription`
- `editorLoadErrorTitle`
- `editorLoadErrorDescription`
- `editorRetry`
- `editorBackToList`

## 4) Keep toolbar actions guarded by success state

File: `src/routes/presentations/$presentationId.tsx`

### Why

Export and editor actions should only render when presentation data is valid and loaded.

### Suggested update

- Do not render toolbar/editor panes in error/not-found states.
- Keep `handleExport` guard (`if (!presentation) return;`) as a secondary safety check.

## Suggested UI Behavior Matrix

| State | Condition | UI |
|---|---|---|
| Invalid ID | `!Number.isInteger(id) \|\| id <= 0` | Title + invalid-link message + back button |
| Loading | `isInitialLoading` | Presentation-specific loading text/skeleton |
| Not found | query error maps to not-found | Not-found card + back button + retry |
| Error | any other query error | Error card + retry + back |
| Success | data exists | Current editor layout |

## Example Route Flow (Pseudo-code)

```tsx
if (isInvalidId) return <EditorState kind="invalid-id" />;
if (isInitialLoading) return <EditorState kind="loading" />;
if (isPresentationError && isNotFound) return <EditorState kind="not-found" onRetry={refetchPresentation} />;
if (isPresentationError) return <EditorState kind="error" onRetry={refetchPresentation} />;
if (!presentation) return <EditorState kind="not-found" onRetry={refetchPresentation} />;
return <PresentationEditorLayout />;
```

## Verification Plan

## Automated

Add tests for `src/routes/presentations/$presentationId.tsx` covering:

1. Invalid ID (`/presentations/abc`) renders invalid/not-found state.
2. Loading state renders while query pending.
3. Not-found error renders dedicated message.
4. Generic error renders retry state.
5. Success state renders editor panels.

## Manual

1. Navigate to existing presentation ID -> editor works as today.
2. Navigate to non-existing numeric ID -> not-found state appears.
3. Navigate to invalid ID string -> invalid/not-found state appears.
4. Simulate backend offline/error -> generic error with retry appears.
5. Retry after backend recovery -> editor loads.

## Acceptance Criteria

1. Presentation editor no longer shows infinite loading for failed fetches.
2. Not-found and error states are user-visible and localized.
3. Retry and back-to-list paths are available in failure states.
4. Success path behavior remains unchanged.
5. No regression in export/edit flows when data is valid.

## Risk and Mitigation

- Risk: false positives in message-based not-found detection.
  - Mitigation: centralize parser helper and migrate to structured error codes when available.
- Risk: UI duplication for state cards.
  - Mitigation: extract a small local `EditorState` component if the route grows.

