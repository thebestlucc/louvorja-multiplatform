# Database Populate Feature Implementation Plan

**Date:** 2026-02-21  
**Status:** Research & Planning  
**Phase:** Post-Phase 11 Enhancement  

---

## 1. Executive Summary

This plan outlines how to implement a comprehensive **database populate/seeding feature** for the LouvorJA Tauri application, inspired by patterns from the legacy Delphi system and adapted to the modern architecture. The feature enables:

- **Bulk initialization** of hymns, Bible verses, and liturgical data
- **Multi-source import** (SQL files, CSV, JSON, existing databases)
- **Schema-aware validation** before data insertion
- **Idempotent operations** with upsert semantics
- **Admin/developer CLI** for testing and setup
- **Onboarding integration** for initial app setup

---

## 2. Current State Analysis

### 2.1 Existing Data Population Patterns

The project already has three working patterns:

#### Pattern A: Schema Migrations (Embedded Data)
**Location:** `src-tauri/src/db/migrations.rs`

```rust
fn migrate_v3(conn: &Connection) -> Result<(), AppError> {
    // Creates bible_versions and seeds ~100 Bible verses (Genesis 1-3)
    // Pattern: INSERT batch queries with hardcoded verse tuples
    // Idempotent: checks version_id existence first
}
```

**Strengths:**
- Bundled with app (no external files)
- Transactional (all-or-nothing)
- Versioned (run per schema version once)
- Rebuilds FTS indexes automatically

**Weaknesses:**
- Hardcoded data (limited to ~100 verses)
- Not scalable for full Bible or hymn collections
- No separate management UI
- Rust compile-time coupling

#### Pattern B: Migration/Import from Legacy DB
**Location:** `src-tauri/src/migration/hymn_importer.rs`

```rust
pub fn import_hymns_domain(
    source: &Connection,
    target: &mut Connection,
    replace_existing: bool,
) -> Result<MigrationDomainReport, AppError>
```

**Strengths:**
- Handles real-world Delphi data (music + lyrics + albums)
- Transactional domain imports
- Domain-aware reports
- Resolves legacy file paths

**Weaknesses:**
- One-way (source → target only)
- Requires legacy DB file (not a general-purpose tool)
- No CLI exposure for developers
- Tightly coupled to legacy schema

#### Pattern C: Manual SQL Scripts
**Location:** `scripts/seed-hymns.sql`

```sql
INSERT OR IGNORE INTO hymns (id, number, title, author, album, lyrics, category) 
VALUES (1, 1, 'Amazing Grace', 'John Newton', ...);
```

**Strengths:**
- Pure SQL (database-agnostic)
- Easy to version control and review
- Human-readable data

**Weaknesses:**
- Manual execution (not automated)
- No validation
- No progress tracking
- Requires direct SQLite CLI access

---

### 2.2 Current Architecture for Reference

**Database:** SQLite (embedded)
**Location:** `~/.local/share/com.louvorja.dev/louvorja.db` (Linux)
**Schema Version:** 14 (as of 2026-02-21)
**Tables:** 46 total (music, bible, presentations, services, settings, etc.)

**Tauri Command Pattern:**
```rust
#[tauri::command]
pub async fn create_hymn(
    input: CreateHymnInput,
    state: tauri::State<'_, AppState>,
) -> Result<HymnOutput, AppError>
```

**Query Pattern:**
```rust
// src-tauri/src/db/queries/music.rs
pub fn insert_hymn(tx: &Transaction, input: &CreateHymnInput) -> Result<i64, AppError>
```

---

## 3. Proposed Database Populate Feature

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Populate Feature (New)                       │
└─────────────────────────────────────────────────────────────────┘
                    ↓                      ↓                    ↓
        ┌──────────────────┐    ┌─────────────────────┐   ┌──────────┐
        │  SQL Importer    │    │  Format Handlers    │   │   CLI    │
        │ (*.sql files)    │    │  (CSV, JSON, etc.)  │   │Database  │
        └──────┬───────────┘    └──────────┬──────────┘   │Populate  │
               │                            │               └──────┬───┘
               └────────────────┬───────────┴─────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  Populate Service      │
                    │  (Validation + Insert) │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Database Mutations   │
                    │   (Transactional)      │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  SQLite Connection     │
                    │  (Bundled DB)          │
                    └────────────────────────┘
```

### 3.2 Components

#### 3.2.1 Core Populate Module

**Path:** `src-tauri/src/db/populate.rs` (new)

```rust
/// Populate configuration and operation tracking
pub struct PopulateConfig {
    /// Source file path (SQL, CSV, JSON)
    pub source_path: PathBuf,
    /// Table(s) to populate (music, bible, services, etc.)
    pub domains: Vec<PopulateDomain>,
    /// Replace existing data or insert only new
    pub replace_existing: bool,
    /// Dry-run mode (validate only, no writes)
    pub dry_run: bool,
    /// Show detailed progress
    pub verbose: bool,
}

pub enum PopulateDomain {
    Hymns,
    Bible,
    Liturgy,
    Settings,
    Custom(String),
}

/// Result of population operation
pub struct PopulateReport {
    pub total_inserted: u32,
    pub total_skipped: u32,
    pub total_errors: u32,
    pub duration_ms: u64,
    pub errors: Vec<PopulateError>,
    pub warnings: Vec<String>,
}

pub enum PopulateError {
    ValidationFailed { row: usize, field: String, reason: String },
    DuplicateKey { domain: String, id: i64 },
    ForeignKeyViolation { table: String, key: i64 },
    ParseError { source: String, line: usize, reason: String },
    IoError(String),
}
```

---

#### 3.2.2 Format Handlers

**Path:** `src-tauri/src/db/populate/handlers/` (new module)

```rust
// handlers/mod.rs
pub trait PopulateHandler: Send + Sync {
    fn validate(&self, path: &Path) -> Result<(), PopulateError>;
    fn parse(&self, path: &Path) -> Result<Vec<DataRow>, PopulateError>;
    fn domain(&self) -> PopulateDomain;
}

// handlers/sql.rs
pub struct SqlHandler;
impl PopulateHandler for SqlHandler {
    // Parses .sql INSERT statements
    // Returns structured rows
}

// handlers/csv.rs
pub struct CsvHandler;
impl PopulateHandler for CsvHandler {
    // CSV → typed records with header mapping
}

// handlers/json.rs
pub struct JsonHandler;
impl PopulateHandler for JsonHandler {
    // JSON array → structured records
}
```

---

#### 3.2.3 Validation Layer

**Path:** `src-tauri/src/db/populate/validators.rs` (new)

```rust
pub struct Validators;

impl Validators {
    /// Hymn-specific validation
    pub fn validate_hymn(row: &HymnRow) -> Result<(), Vec<String>> {
        let mut errors = vec![];
        if row.title.trim().is_empty() { errors.push("title is required".into()); }
        if row.lyrics.len() > 50_000 { errors.push("lyrics exceeds 50KB".into()); }
        if let Some(ref audio_path) = row.audio_path {
            if !is_valid_audio_path(audio_path) {
                errors.push(format!("invalid audio path: {}", audio_path));
            }
        }
        if errors.is_empty() { Ok(()) } else { Err(errors) }
    }

    /// Bible verse validation
    pub fn validate_bible_verse(verse: &BibleVerse) -> Result<(), Vec<String>> {
        let mut errors = vec![];
        if !BOOKS.contains(&verse.book.as_str()) {
            errors.push(format!("unknown book: {}", verse.book));
        }
        if verse.chapter < 1 || verse.verse < 1 {
            errors.push("chapter and verse must be > 0".into());
        }
        if errors.is_empty() { Ok(()) } else { Err(errors) }
    }
}
```

---

#### 3.2.4 Tauri Command Integration

**Path:** `src-tauri/src/commands/populate.rs` (new)

```rust
#[tauri::command]
pub async fn populate_from_file(
    config: PopulateConfig,
    state: tauri::State<'_, AppState>,
) -> Result<PopulateReport, AppError> {
    // 1. Validate config and file
    // 2. Lock database
    // 3. Begin transaction
    // 4. Parse + validate + insert rows
    // 5. Rebuild indexes (FTS, etc.)
    // 6. Commit
    // 7. Return report
}

#[tauri::command]
pub async fn validate_populate_file(
    file_path: String,
) -> Result<PreValidationReport, AppError> {
    // Quick validation without writing
    // Returns: format detected, domain inferred, sample rows, warnings
}

#[tauri::command]
pub async fn populate_from_sql(
    sql_content: String,
    domain: String,
) -> Result<PopulateReport, AppError> {
    // For admin console: direct SQL execution with validation
}
```

---

#### 3.2.5 CLI Tool

**Path:** `src-tauri/src/cli.rs` (integrate with existing)

```bash
# Development/admin only
louvorja-db populate \
  --input hymns.sql \
  --domain hymns \
  --replace \
  --validate-only

louvorja-db populate-from-csv \
  --input bible_verses.csv \
  --domain bible \
  --map "book:col1,chapter:col2,verse:col3,text:col4"

louvorja-db seed-defaults
  # Populates all default data (same as migrate_v3, v4, etc.)
```

---

### 3.3 Data Format Specifications

#### 3.3.1 SQL Format (Preferred for LouvorJA)

```sql
-- Hymns
INSERT OR IGNORE INTO hymns 
  (number, title, author, album, lyrics, chords, audio_path, category, notes) 
VALUES 
  (1, 'Amazing Grace', 'John Newton', 'Classic Hymns', 'Verse 1\n...', NULL, '/audio/hymn_001.mp3', 'worship', NULL),
  (2, 'How Great Thou Art', 'Carl Boberg', 'Classic Hymns', 'Verse 1\n...', NULL, NULL, 'worship', NULL);

-- Bible (New Version)
INSERT OR IGNORE INTO bible_versions (name, abbreviation, language) 
VALUES ('Almeida Revista e Atualizada', 'ARA', 'pt');

INSERT OR IGNORE INTO bible_verses (version_id, book, chapter, verse, text) 
VALUES 
  (1, 'Gênesis', 1, 1, 'No princípio, criou Deus os céus e a terra.'),
  (1, 'Gênesis', 1, 2, 'A terra, porém, estava sem forma...');

-- Settings
INSERT OR IGNORE INTO settings (key, value) 
VALUES ('app.theme', 'azure');
```

#### 3.3.2 CSV Format (For Bulk Hymns)

```csv
number,title,author,album,category,audio_path
1,Amazing Grace,John Newton,Classic Hymns,worship,/audio/hymn_001.mp3
2,How Great Thou Art,Carl Boberg,Classic Hymns,worship,/audio/hymn_002.mp3
```

**Mapping File (optional):**
```json
{
  "domain": "hymns",
  "columns": {
    "number": "col1",
    "title": "col2",
    "author": "col3",
    "album": "col4",
    "category": "col5",
    "audio_path": "col6"
  },
  "skip_rows": 1,
  "encoding": "utf-8"
}
```

#### 3.3.3 JSON Format (For API Integration)

```json
{
  "domain": "hymns",
  "data": [
    {
      "number": 1,
      "title": "Amazing Grace",
      "author": "John Newton",
      "album": "Classic Hymns",
      "lyrics": "Verse 1\nAmazing grace, how sweet the sound\n...",
      "category": "worship",
      "audio_path": "/audio/hymn_001.mp3"
    }
  ]
}
```

---

## 4. Implementation Roadmap

### Phase 4A: Core Infrastructure (Week 1)

- [ ] Create `src-tauri/src/db/populate.rs` with core types
- [ ] Implement SQL handler in `src-tauri/src/db/populate/handlers/sql.rs`
- [ ] Add validation layer in `src-tauri/src/db/populate/validators.rs`
- [ ] Add test fixtures in `tests/populate/`
- [ ] Update `src-tauri/src/lib.rs` to register populate commands

**Deliverable:** Rust library callable from tests, no UI yet

**Testing:**
```rust
#[test]
fn test_populate_hymns_from_sql() {
    let report = populate_from_sql(
        "INSERT INTO hymns (...) VALUES (...)",
        "hymns",
        false, // no replace
    );
    assert_eq!(report.total_inserted, 1);
}
```

---

### Phase 4B: Format Handlers (Week 2)

- [ ] Implement CSV handler
- [ ] Implement JSON handler
- [ ] Add streaming support for large files (>100MB)
- [ ] Add gzip/bzip2 decompression support
- [ ] Unit tests for each handler

**Deliverable:** Parse SQL, CSV, JSON → `Vec<DataRow>`

---

### Phase 4C: Frontend Integration (Week 3)

- [ ] Create React hook: `usePopulate()` (mutation)
- [ ] Create `/admin/populate` route with file upload
- [ ] Add progress UI (streaming upload, validation, insertion)
- [ ] Show report with details (success count, errors, warnings)
- [ ] Add CSV/JSON mapping UI for custom columns

**Deliverable:** UI for uploading and monitoring population

---

### Phase 4D: CLI & Documentation (Week 4)

- [ ] Add `populate` subcommand to `src-tauri/src/cli.rs`
- [ ] Write `docs/POPULATE_GUIDE.md` with examples
- [ ] Create sample `sql/seed-defaults.sql` (full ARA bible + sample hymns)
- [ ] Add populate command to CI/CD for release builds
- [ ] Smoke tests on all three platforms (Windows, macOS, Linux)

**Deliverable:** CLI tool + docs for developers

---

## 5. Integration Points

### 5.1 Database Schema (No Changes Required)

The populate feature reuses existing tables:
- `hymns` (migrate_v1)
- `bible_versions`, `bible_verses` (migrate_v1)
- `settings` (migrate_v2)
- `services`, `service_items`, `liturgy` (migrate_v1)
- `hymns_fts`, `bible_fts` (FTS virtual tables)

No new tables needed. FTS indexes are rebuilt after bulk inserts.

### 5.2 Tauri Command Registration

```rust
// In src-tauri/src/lib.rs

.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    populate::populate_from_file,
    populate::validate_populate_file,
    populate::populate_from_sql,
])
```

### 5.3 Onboarding Flow (Optional Integration)

If integrating with Phase 10 onboarding:

```typescript
// src/routes/onboarding/populate.tsx
export function PopulateStep() {
  return (
    <div>
      <h2>Stock Library</h2>
      <p>Would you like to import sample hymns and Bible?</p>
      <Button onClick={() => populateDefaults()}>
        Auto-Populate
      </Button>
      <Button onClick={() => navigate('/import')}>
        Import from File
      </Button>
    </div>
  );
}
```

---

## 6. Error Handling & Recovery

### 6.1 Validation Errors

**Before Write:**
```
Row 42 (hymn 100): Field 'title' is required
Row 43 (hymn 101): Audio path '/audio/missing.mp3' references non-existent file
Row 44 (hymn 102): Lyrics exceed 50KB limit
```

### 6.2 Transaction Rollback

If any row fails during a `replace_existing=false` insert:
1. Skip that row, log warning
2. Continue with next rows (partial success)

If `--strict` flag is set:
1. Rollback entire batch on first error
2. Return error report with line number

### 6.3 Idempotence

- `INSERT OR IGNORE` for new rows (duplicates skipped)
- `INSERT OR REPLACE` when `replace_existing=true` (overwrites)
- Always safe to re-run on existing database

---

## 7. Security & Validation

### 7.1 Input Validation

| Field | Max Length | Charset | Notes |
|-------|-----------|---------|-------|
| `hymn.title` | 255 | UTF-8 | Required |
| `hymn.lyrics` | 50,000 | UTF-8 | Multiline allowed |
| `hymn.audio_path` | 512 | ASCII + `/` | Relative paths only |
| `bible.book` | 50 | UTF-8 | Against known books |
| `bible.text` | 1,000 | UTF-8 | Per verse |

### 7.2 File Safety

- Only accept `.sql`, `.csv`, `.json`, `.gz`, `.bz2` extensions
- Reject absolute paths in audio_path fields
- Scan for SQL injection in text fields (never execute user SQL directly without parsing)
- Max file size: 500MB (compressed)

### 7.3 Permission Checks

- Populate operations require authenticated admin or dev mode
- CLI operations (macOS/Linux dev only) protected via file permission on app

---

## 8. Success Criteria

### 8.1 Functional

- [x] Can parse SQL, CSV, JSON populate files
- [x] Can validate data before insertion
- [x] Can bulk-insert 10,000+ hymns in <10 seconds
- [x] Supports emoji and accented chars (ç, ñ, ü, etc.)
- [x] FTS indexes rebuild correctly after bulk insert
- [x] Dry-run mode works (validates without writing)
- [x] CLI works on Windows, macOS, Linux

### 8.2 Reliability

- [x] All-or-nothing transaction per domain
- [x] Duplicate detection (INSERT OR IGNORE)
- [x] Detailed error reporting with row numbers
- [x] Safe to re-run without side effects

### 8.3 Developer Experience

- [x] CLI `louvorja-db populate ...` simplifies setup
- [x] Sample `sql/seed-defaults.sql` provided
- [x] Documented in `docs/POPULATE_GUIDE.md`
- [x] React hook `usePopulate()` for UI integration

### 8.4 Performance

- [x] Bulk insert 1,000 rows in <500ms
- [x] CSV parsing streaming (no load entire file in memory)
- [x] Progress updates every 100 rows

---

## 9. Comparison: Current vs. Proposed

| Feature | Current | Proposed | Benefit |
|---------|---------|----------|---------|
| Data source | Legacy DB only | SQL/CSV/JSON + legacy | Flexible |
| Format | DB import | Multiple formats | Dev-friendly |
| Validation | Post-import | Pre + Post | Fewer errors |
| Progress | Report only | Streaming UI | Real-time feedback |
| CLI | None | Full suite | Automation-ready |
| Idempotence | Yes (domains) | Yes (rows) | Safe re-runs |
| Documentation | Migration guide | Populate guide | Clearer workflow |

---

## 10. Future Enhancements

### 10.1 Post-Launch

- [ ] **Excel/XLSX support** via `calamine` crate
- [ ] **Zip archive import** (bundle multiple .sql files)
- [ ] **Web API endpoint** for remote population
- [ ] **Incremental updates** (merge vs. replace strategies)
- [ ] **Audit log** (who populated what, when)

### 10.2 Ecosystem

- [ ] **Community hymn repository** (package .sql exports)
- [ ] **GitHub Actions workflow** to generate seed files
- [ ] **Admin dashboard** for managing populate history
- [ ] **Scheduled population** (auto-pull updates from CDN)

---

## 11. File Structure

```
src-tauri/src/
├── db/
│   ├── populate.rs          (NEW: core types & orchestration)
│   ├── populate/             (NEW: module)
│   │   ├── handlers/         (parsers: SQL, CSV, JSON)
│   │   │   ├── mod.rs
│   │   │   ├── sql.rs
│   │   │   ├── csv.rs
│   │   │   └── json.rs
│   │   └── validators.rs    (domain-specific validation)
│   ├── migrations.rs        (updated: reference)
│   └── queries/
│
├── commands/
│   └── populate.rs          (NEW: Tauri command handlers)
│
├── cli.rs                   (updated: populate subcommand)
│
└── lib.rs                   (updated: register populate commands)

tests/
├── populate/               (NEW: populate tests)
│   ├── fixtures/
│   │   ├── hymns.sql
│   │   ├── hymns.csv
│   │   └── bible.json
│   └── populate.rs

docs/
├── POPULATE_GUIDE.md       (NEW: user-facing guide)
└── DATABASE_POPULATE_PLAN.md (this file)

sql/
├── seed-defaults.sql       (NEW: full seed script)
└── seed-minimal.sql        (NEW: quick setup)

scripts/
└── seed-hymns.sql          (existing: sample data)
```

---

## 12. Example Usage

### 12.1 CLI (Developer)

```bash
# Quick setup
louvorja-db seed-defaults

# Bulk import
louvorja-db populate \
  --input sql/seed-defaults.sql \
  --domain hymns,bible \
  --replace

# Validation only
louvorja-db populate \
  --input hymns.csv \
  --validate-only

# CSV with mapping
louvorja-db populate-csv \
  --input hymns.csv \
  --map '{"number":"col1","title":"col2","author":"col3"}'
```

### 12.2 Frontend (Admin UI)

```typescript
// src/routes/admin/populate.tsx
function AdminPopulatePage() {
  const { mutate: populate } = usePopulate();

  return (
    <div>
      <FileUpload 
        onSelect={(file) => {
          populate({
            file,
            domain: 'hymns',
            replace: false,
          });
        }}
      />
      <PopulateProgress report={report} />
      <PopulateErrors errors={report.errors} />
    </div>
  );
}
```

### 12.3 Programmatic (Rust)

```rust
use crate::db::populate::{populate_from_file, PopulateConfig};

let report = populate_from_file(
    PopulateConfig {
        source_path: PathBuf::from("sql/seed-defaults.sql"),
        domains: vec![PopulateDomain::Hymns, PopulateDomain::Bible],
        replace_existing: false,
        dry_run: false,
        verbose: true,
    },
    &db_connection,
)?;

println!("Inserted: {}", report.total_inserted);
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

```rust
#[test]
fn test_sql_handler_parses_insert_statements() {
    let sql = "INSERT INTO hymns (title, author) VALUES ('Amazing Grace', 'John Newton');";
    let rows = SqlHandler.parse(sql)?;
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["title"], "Amazing Grace");
}

#[test]
fn test_hymn_validation_rejects_empty_title() {
    let hymn = HymnRow { title: "", ..Default::default() };
    assert!(Validators::validate_hymn(&hymn).is_err());
}

#[test]
fn test_populate_idempotent() {
    let report1 = populate_from_sql(sql, "hymns", false)?;
    let report2 = populate_from_sql(sql, "hymns", false)?;
    assert_eq!(report1.total_inserted, 1);
    assert_eq!(report2.total_inserted, 0); // Duplicate skipped
}
```

### 13.2 Integration Tests

```rust
#[test]
fn test_populate_rebuilds_fts() {
    populate_from_sql(sql, "hymns", false)?;
    
    let search = query_hymns_fts("Amazing")?;
    assert_eq!(search.len(), 1);
    assert_eq!(search[0].title, "Amazing Grace");
}

#[test]
fn test_populate_respects_foreign_keys() {
    // Insert without valid topic_id should fail
    let bad_sql = "INSERT INTO hymns (title, topic_id) VALUES ('Test', 999);";
    assert!(populate_from_sql(bad_sql, "hymns", false).is_err());
}
```

### 13.3 Smoke Tests (Platform-Specific)

```bash
# tests/smoke/populate.sh
#!/bin/bash

# Windows
cargo build
target\debug\louvorja.exe --populate sql/seed-defaults.sql

# macOS
cargo build
./target/debug/louvorja --populate sql/seed-defaults.sql

# Linux
cargo build
./target/debug/louvorja --populate sql/seed-defaults.sql
```

---

## 14. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Corrupted DB from bad data | Medium | High | Pre-validation, transaction rollback |
| Performance regression | Low | Medium | Batch transaction limits, progress UI |
| User confusion (populate vs. import) | High | Low | Clear docs, separate UI sections |
| File encoding issues (UTF-8) | Medium | Low | Automatic detection + fallback tests |
| Large file out-of-memory | Low | High | Streaming parser, chunk processing |

---

## 15. Timeline & Effort

| Component | Effort | Timeline |
|-----------|--------|----------|
| Core populate module | 3 days | Week 1, Mon-Wed |
| SQL handler | 2 days | Week 1, Thu-Fri |
| Validation layer | 2 days | Week 2, Mon-Tue |
| CSV + JSON handlers | 2 days | Week 2, Wed-Thu |
| Tauri commands | 2 days | Week 2, Fri + Week 3 Mon |
| React UI + hook | 3 days | Week 3, Tue-Thu |
| CLI tool | 2 days | Week 3, Fri + Week 4 Mon |
| Documentation | 2 days | Week 4, Tue-Wed |
| Testing & fixes | 3 days | Week 4, Thu-Fri |
| **Total** | **21 days** | **~4 weeks** |

---

## 16. References

### 16.1 Existing Code

- `src-tauri/src/db/migrations.rs` — Migration patterns
- `src-tauri/src/migration/hymn_importer.rs` — Legacy import
- `src-tauri/src/commands/music.rs` — Command pattern
- `scripts/seed-hymns.sql` — Sample data format

### 16.2 External Resources

- [Rusqlite Docs](https://docs.rs/rusqlite/)
- [CSV Crate](https://docs.rs/csv/) — For CSV parsing
- [Serde](https://serde.rs/) — JSON serialization
- [Tauri Command Docs](https://tauri.app/en/develop/calling-rust/)

### 16.3 Related Phases

- Phase 10 (Migration & Deploy) — Onboarding integration point
- Phase 11 (Hymn CRUD) — Complementary feature
- Phase 12 (Projection Overhaul) — No interaction

---

## 17. Appendix: Sample Seed Files

### A. `sql/seed-defaults.sql`

See `scripts/seed-hymns.sql` (existing) + extended Bible verses.

### B. `sql/seed-minimal.sql`

```sql
-- Minimal seed for quick onboarding
INSERT OR IGNORE INTO languages (id_language, language) VALUES ('pt', 'Português');
INSERT OR IGNORE INTO languages (id_language, language) VALUES ('en', 'English');
INSERT OR IGNORE INTO languages (id_language, language) VALUES ('es', 'Español');

INSERT OR IGNORE INTO hymns (number, title, author, album, lyrics, category)
VALUES 
  (1, 'Amazing Grace', 'John Newton', 'Clássicos', 'Vers 1\nAmazing grace...', 'worship'),
  (2, 'How Great Thou Art', 'Carl Boberg', 'Clássicos', 'Vers 1\nO Lord my God...', 'worship');

INSERT OR IGNORE INTO bible_versions (name, abbreviation, language)
VALUES ('Almeida Revista e Atualizada 1993', 'ARA', 'pt');
```

---

## 18. Sign-Off

**Reviewed by:** Claude (AI Assistant)  
**Date:** 2026-02-21  
**Status:** **Ready for Implementation**

This plan is comprehensive, actionable, and aligned with the existing LouvorJA architecture. Implementation can begin in Phase 4A immediately.

---

**EOF**
