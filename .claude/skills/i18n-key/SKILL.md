---
name: i18n-key
description: Add i18n translation keys to all three locale files (en.json, pt.json, es.json) atomically
---

# i18n Key Manager

Adds, updates, or audits i18n translation keys across all three locale files simultaneously.

## Arguments

- `key`: Dot-notation key path (e.g., `hymnal.actions.addToService`)
- `en`: English translation
- `pt`: Portuguese translation
- `es`: Spanish translation

## Workflow

### Adding a Key

1. Read all three locale files:
  - `src/locales/en.json`
  - `src/locales/pt.json`
  - `src/locales/es.json`

2. Parse the dot-notation key into nested object path. For example, `hymnal.actions.addToService` maps to:

```json
{
  "hymnal": {
    "actions": {
      "addToService": "value"
    }
  }
}
```
3. Add the key with the appropriate translation to ALL THREE files in a single pass.

4. Ensure JSON files remain sorted alphabetically at each nesting level for consistency.

5. Verify no existing key is accidentally overwritten (warn if key already exists with a different value).

## Auditing Keys

When invoked with just audit (no key argument):

1. Parse all three locale files.
2. Collect all keys from each file.
3. Report:
    - Keys present in one file but missing in others.
    - Keys with empty string values (likely untranslated placeholders).
4. Scan src/**/*.{ts,tsx} for t('key') and i18next.t('key') patterns.
5. Report keys used in code but missing from ALL locale files.

## Rules

- NEVER leave a key in only 1 or 2 files — all three must be updated.
- If the user provides only English, add the English value to en.json and add "TODO" as placeholder to pt.json and es.json.
- Preserve existing file formatting (2-space indent, trailing newline).
- Keys should use camelCase for the leaf segment and dot-notation for nesting.