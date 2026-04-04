# Migration Guide

## Supported source
- Legacy SQLite database file (`.db`, `.sqlite`, `.sqlite3`)

## Safety model
- Source DB is opened read-only.
- Import runs by domain transaction (all-or-nothing per domain).
- No overwrite happens unless user enables `Replace existing`.
- A migration report is generated for each run.

## Onboarding flow
1. Open app on first run.
2. Go to onboarding import step.
3. Select source SQLite file.
4. Select domains to import.
5. Start migration and wait for report.
6. Continue to monitor setup and finish onboarding.

## Failure handling
- If migration fails, inspect report errors and retry.
- If migration is cancelled, rerun with same or updated options.
- Existing data remains consistent due transactional boundaries.

## Stored metadata keys
- `migration.lastSourcePath`
- `migration.lastRunStatus`
- `migration.lastRunAt`
- `migration.lastReport`
