# SPEC 11 — Migration Tools & Deployment

**Phase:** 10
**Goal:** Smooth transition for existing users and production-ready builds.

---

## Files to CREATE

### Frontend — Onboarding

#### `src/routes/onboarding/route.tsx`
- Create first-run onboarding flow layout
- Multi-step wizard interface
- Progress indicator (step 1 of 4, step 2 of 4, etc.)
- Back/Next navigation buttons
- Wraps children with `<Outlet />`

#### `src/routes/onboarding/welcome.tsx`
- Create welcome screen (step 1)
- App logo and welcome message
- Brief description of LouvorJA
- Language selector (Portuguese, Spanish, English)
- "Get Started" button → next step

#### `src/routes/onboarding/import.tsx`
- Create data import screen (step 2)
- Options:
  - "Import from LouvorJA Desktop (Delphi version)" — file picker for old SQLite database
  - "Start Fresh" — skip import
- Import options checklist:
  - ☑ Hymn library
  - ☑ Bible data
  - ☑ Favorites
  - ☑ Worship service history
  - ☑ Settings
- Progress bar during import
- Summary of imported items after completion

#### `src/routes/onboarding/monitors.tsx`
- Create monitor setup screen (step 3)
- Embedded `MonitorConfig` component (from Phase 6)
- Detect monitors and assign roles (operator, projector, return)
- "Skip for Now" option
- "Test Configuration" button

#### `src/routes/onboarding/complete.tsx`
- Create completion screen (step 4)
- Success message
- Quick tips / getting started guide
- Link to documentation
- "Start Using LouvorJA" button → navigates to main app

### Frontend — Migration Components

#### `src/components/migration/import-wizard.tsx`
- Create data migration wizard component
- File picker for the old Delphi SQLite database
- Connects to backend migration commands
- Shows progress for each data category (hymns, Bible, services, etc.)
- Error handling: displays warnings for data that couldn't be migrated
- Summary report at the end

#### `src/components/migration/import-progress.tsx`
- Create import progress display component
- Shows: "Importing hymns... 456/1000"
- Progress bar for each category
- Overall progress percentage
- Estimated time remaining
- "Cancel" button (cancels import and rolls back)

### Frontend — Help System

#### `src/routes/help/route.tsx`
- Create help/documentation page
- Sidebar with help topics organized by category
- Main content area with documentation
- Search functionality
- Breadcrumb navigation
- Links to external documentation, GitHub issues, community forum

#### `src/components/help/guided-tour.tsx`
- Create interactive guided tour component
- Overlay tooltips highlighting UI elements
- Step-by-step walkthrough of key features:
  - Searching for hymns
  - Creating a presentation
  - Projecting content
  - Building a worship service
- "Skip Tour" and "Next" buttons

### Frontend — Update Notification

#### `src/components/update-notification.tsx`
- Create update available notification component
- Uses `tauri-plugin-updater` to check for updates
- Shows notification banner when update is available
- Displays: version number, release notes, download size
- "Update Now" button (downloads and installs)
- "Remind Me Later" button
- "Skip This Version" button

---

## Files to UPDATE

### Backend — Migration Module

#### `src-tauri/src/migration/mod.rs` (CREATE)
- Create data migration module
- `migrate_from_delphi(old_db_path: &Path, new_db_conn: &Connection) -> Result<MigrationReport, AppError>`
  - Opens the old Delphi SQLite database
  - Reads hymns table → inserts into new hymns table
  - Reads Bible data → inserts into new Bible tables
  - Reads favorites → inserts into new favorites table
  - Reads service XML files (if available) → parses and inserts into new services/service_items tables
  - Reads settings/parameters → inserts into new settings table
  - Reads monitor configs → inserts into new monitor_configs table
  - Returns a report: `{ hymns_imported: usize, bible_verses_imported: usize, services_imported: usize, errors: Vec<String> }`

#### `src-tauri/src/migration/hymn_importer.rs` (CREATE)
- Create hymn data migration logic
- `import_hymns(old_conn: &Connection, new_conn: &Connection) -> Result<usize, AppError>`
- Maps old schema to new schema
- Handles missing fields gracefully

#### `src-tauri/src/migration/service_importer.rs` (CREATE)
- Create worship service migration logic
- `import_services(service_xml_dir: &Path, new_conn: &Connection) -> Result<usize, AppError>`
- Parses XML service files from the old app
- Converts to new SQLite format

### Backend — Migration Commands

#### `src-tauri/src/commands/migration.rs` (CREATE)
- Implement migration commands:
  - `start_migration(old_db_path: String) -> Result<MigrationReport, AppError>`
    - Starts the migration process
    - Runs asynchronously and emits progress events
  - `get_migration_progress() -> Result<MigrationProgress, AppError>`
    - Returns current progress (if migration is running)
  - `cancel_migration() -> Result<(), AppError>`
    - Cancels in-progress migration and rolls back
- `MigrationReport` struct: `{ hymns_imported: usize, bible_verses_imported: usize, favorites_imported: usize, services_imported: usize, errors: Vec<String> }`
- `MigrationProgress` struct: `{ current_step: String, current_count: usize, total_count: usize, percent: f32 }`

### Backend — Database

#### `src-tauri/src/db/migrations.rs` (UPDATE)
- Add migration version tracking
- Store current schema version in `settings` table (key: `schema_version`)
- Check schema version on startup and run migrations if needed

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Add `mod migration;`
- Register migration commands: `start_migration`, `get_migration_progress`, `cancel_migration`
- Add first-run detection in `setup()` hook:
  - Check if database is empty or if `settings.first_run` is true
  - If first run, redirect to onboarding route
- Register `tauri-plugin-updater` plugin

### Backend — Cargo

#### `src-tauri/Cargo.toml`
- Add `tauri-plugin-updater = "2"` dependency

### Backend — Tauri Config

#### `src-tauri/tauri.conf.json`
- Add updater configuration:
  ```json
  "updater": {
    "active": true,
    "endpoints": [
      "https://github.com/louvorja/desktop-multiplatform/releases/latest/download/latest.json"
    ],
    "pubkey": "YOUR_PUBLIC_KEY_HERE"
  }
  ```
- Add bundle configuration:
  - Windows: MSI + NSIS installer
  - macOS: DMG with code signing (requires Apple Developer account)
  - Linux: AppImage + deb package

### Frontend — Main Entry

#### `src/main.tsx` (UPDATE)
- Check for first run on app load
- If first run, navigate to `/onboarding/welcome`
- Otherwise, navigate to `/` (dashboard)

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `startMigration(oldDbPath: string): Promise<MigrationReport>`
  - `getMigrationProgress(): Promise<MigrationProgress>`
  - `cancelMigration(): Promise<void>`
  - `checkForUpdates(): Promise<UpdateInfo | null>`
  - `installUpdate(): Promise<void>`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query keys and hooks:
  - `useMigrationProgress()` — polls progress during migration
  - `useStartMigration()` — mutation
  - `useCheckForUpdates()` — runs on app startup
  - `useInstallUpdate()` — mutation

### Frontend — Types

#### `src/types/migration.ts` (CREATE)
- Create migration types:
  - `MigrationReport`: `{ hymnsImported: number; bibleVersesImported: number; favoritesImported: number; servicesImported: number; errors: string[] }`
  - `MigrationProgress`: `{ currentStep: string; currentCount: number; totalCount: number; percent: number }`
  - `UpdateInfo`: `{ version: string; releaseNotes: string; downloadSize: number; downloadUrl: string }`

### Frontend — Internationalization

#### `src/locales/pt.json` (UPDATE)
- Add all translation keys for:
  - Onboarding flow
  - Migration wizard
  - Settings sections
  - Help topics
  - Error messages
  - Success messages
  - Keyboard shortcuts

#### `src/locales/en.json` (UPDATE)
- Add English translations for all new keys

#### `src/locales/es.json` (UPDATE)
- Add Spanish translations for all new keys

### Build & Deployment

#### `.github/workflows/release.yml` (CREATE)
- Create GitHub Actions workflow for automated releases:
  - Trigger on git tag push (e.g., `v1.0.0`)
  - Build for all platforms: Windows (x64), macOS (Intel + Apple Silicon), Linux (x64)
  - Run tests before building
  - Sign macOS app (requires secrets: APPLE_CERTIFICATE, APPLE_ID, APPLE_PASSWORD)
  - Sign Windows installer (optional)
  - Upload artifacts to GitHub Releases
  - Generate `latest.json` for auto-updater

#### `CHANGELOG.md` (CREATE)
- Create changelog file
- Document all releases with version number, date, and changes
- Format: Keep a Changelog standard

#### `CONTRIBUTING.md` (CREATE)
- Create contribution guidelines
- How to set up the development environment
- How to run tests
- How to submit pull requests
- Code style guide

#### `docs/MIGRATION_GUIDE.md` (CREATE)
- Create migration guide for existing LouvorJA Desktop users
- Step-by-step instructions for migrating data
- Screenshots of the migration process
- Troubleshooting common issues
- FAQ

#### `docs/USER_GUIDE.md` (CREATE)
- Create user guide
- Getting started
- Key features overview
- How to perform common tasks
- Keyboard shortcuts reference
- Tips and tricks

---

## Testing

### Unit Tests

#### `src-tauri/src/db/queries/music.rs` (UPDATE)
- Add Rust unit tests for all music query functions
- Use in-memory SQLite database for tests

#### `src-tauri/src/audio/player.rs` (UPDATE)
- Add unit tests for audio player state machine

#### `src-tauri/src/migration/hymn_importer.rs` (UPDATE)
- Add unit tests for data migration logic

### Integration Tests

#### `src-tauri/tests/integration_test.rs` (CREATE)
- Create integration tests for Tauri commands
- Test database operations end-to-end
- Test audio playback commands
- Test migration commands

### End-to-End Tests

#### `tests-e2e/hymn-search.spec.ts` (CREATE using tauri-driver)
- Test hymn search flow:
  1. Open app
  2. Navigate to hymnal
  3. Search for a hymn
  4. Open hymn detail
  5. Project to screen
  6. Verify projector window content

#### `tests-e2e/service-creation.spec.ts` (CREATE)
- Test service creation flow:
  1. Create new service
  2. Add hymn
  3. Add Bible reading
  4. Reorder items
  5. Save service
  6. Reload and verify

---

## Final Polish

### Performance Optimization

- Optimize large hymn database queries (add indexes if needed)
- Lazy load routes for faster initial load
- Image optimization for album covers and backgrounds
- Database query caching via TanStack Query

### Accessibility

- Ensure all interactive elements are keyboard-accessible
- Add ARIA labels to all components
- Test with screen readers
- Ensure sufficient color contrast ratios
- Add focus indicators

### Error Handling

- Graceful error messages for all error scenarios
- Toast notifications for transient errors
- Modal dialogs for critical errors
- Error boundaries in React for catching rendering errors
- Detailed error logging (sent to log files)

### Documentation

- JSDoc comments for all exported functions
- Rust doc comments for all public APIs
- README with installation instructions
- Architecture documentation
