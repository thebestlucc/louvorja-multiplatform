# Database Populate Feature - Visual Architecture

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    LouvorJA Application                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
         ┌──────▼──────┐  ┌──▼────────┐  ┌─▼────────────┐
         │  Admin UI   │  │  CLI Tool │  │ Legacy Import│
         │  (Frontend) │  │(Rust Bin) │  │  (Existing) │
         └──────┬──────┘  └──┬────────┘  └─────────────┘
                │            │
         ┌──────▼───────────┬▼────────────────────────┐
         │                  │                         │
    ┌────▼─────┐     ┌──────▼──────┐           (unchanged)
    │  Tauri   │     │  CLI Module │
    │ Commands │     │ Handler     │
    └────┬─────┘     └──────┬──────┘
         │                  │
         └──────────┬───────┘
                    │
         ┌──────────▼──────────────┐
         │  POPULATE SERVICE       │
         │  (Core Logic)           │
         ├──────────────────────────┤
         │ • Format Detection       │
         │ • Parsing               │
         │ • Validation            │
         │ • Transaction Mgmt      │
         │ • Error Reporting       │
         └──────────┬───────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼──────┐  ┌─────▼──────┐  ┌────▼───────┐
│SQL       │  │CSV         │  │JSON        │
│Handler   │  │Handler     │  │Handler     │
└───┬──────┘  └─────┬──────┘  └────┬───────┘
    │               │              │
    │         (Compression)        │
    │      (Streaming)             │
    │               │              │
    └───────────────┼──────────────┘
                    │
         ┌──────────▼──────────┐
         │  VALIDATORS         │
         ├──────────────────────┤
         │ • Hymn validation    │
         │ • Bible validation   │
         │ • Settings validation│
         │ • FK validation      │
         │ • Type validation    │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │ DATABASE MUTATIONS  │
         ├──────────────────────┤
         │ • Transaction mgmt   │
         │ • INSERT OR IGNORE   │
         │ • FTS rebuild        │
         │ • Index management   │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  SQLite Database    │
         ├──────────────────────┤
         │ 46 Tables (Existing) │
         │ • hymns             │
         │ • bible_verses      │
         │ • settings          │
         │ • ... (and 42 more) │
         └──────────────────────┘
```

---

## Data Flow: File Upload → Database

```
User Action: Upload File (UI)
     │
     ▼
┌─────────────────────────────────┐
│ 1. Format Detection             │
│    - Read file extension        │
│    - Auto-detect content type   │
│    Return: Handler type (SQL/   │
│    CSV/JSON)                    │
└─────────────┬───────────────────┘
              │
     ┌────────▼────────┐
     │ 2. Parsing      │
     │ Handler.parse() │
     └────────┬────────┘
              │
              ▼
    ┌─────────────────────┐
    │ DataRow Stream      │
    │ [                   │
    │  { id: 1,          │
    │    title: "...",   │
    │    ... }           │
    │ ]                  │
    └─────────┬───────────┘
              │
   ┌──────────▼───────────────┐
   │ 3. Validation (Pre-Write) │
   │  For each row:            │
   │  - Check required fields  │
   │  - Validate types         │
   │  - Check foreign keys     │
   │  - Verify constraints     │
   └──────────┬────────────────┘
              │
       ┌──────▼──────┐
       │ Any Errors? │
       └──┬───────┬──┘
          │       │
         YES     NO
          │       │
     ┌────▼──┐   ┌▼──────────────────┐
     │Report │   │4. Begin Transaction│
     │(Fail) │   └────────┬───────────┘
     └───────┘            │
                ┌─────────▼──────────┐
                │5. Batch Processing │
                │ INSERT 1-1000 rows │
                │ INSERT rows 1001+  │
                └────────┬──────────┘
                         │
                ┌────────▼────────────┐
                │6. Commit            │
                │   Rebuild FTS       │
                │   Return Report     │
                └──────────┬──────────┘
                           │
                    ┌──────▼──────┐
                    │Return Report│
                    │ {           │
                    │  inserted,  │
                    │  skipped,   │
                    │  errors,    │
                    │  warnings   │
                    │ }           │
                    └─────────────┘
```

---

## Handler Comparison

```
┌──────────────────────────────────────────────────────────────┐
│                   FORMAT HANDLERS                            │
├──────────────────────────────────────────────────────────────┤
│
│  SQL Handler
│  ┌──────────────────────────────────────────────────────┐
│  │ Input:  INSERT INTO hymns (...) VALUES (...)        │
│  │ Parsing: Regex-based statement extraction            │
│  │ Output:  Vec<DataRow>                               │
│  │ Best for: Developers, version control, reproducible│
│  │ Speed: Fast, simple regex parsing                   │
│  │ Size: Compact, human-readable                       │
│  └──────────────────────────────────────────────────────┘
│
│  CSV Handler
│  ┌──────────────────────────────────────────────────────┐
│  │ Input:  number,title,author,album,...               │
│  │         1,Amazing Grace,John Newton,...             │
│  │ Parsing: csv crate with streaming support           │
│  │ Output:  Vec<DataRow> (with column mapping)         │
│  │ Best for: Spreadsheets, bulk imports, non-technical│
│  │ Speed: Medium, streaming support for large files    │
│  │ Size: Efficient, compresses well                    │
│  └──────────────────────────────────────────────────────┘
│
│  JSON Handler
│  ┌──────────────────────────────────────────────────────┐
│  │ Input:  {"domain": "hymns", "data": [...]}          │
│  │ Parsing: serde_json deserialization                 │
│  │ Output:  Vec<DataRow>                               │
│  │ Best for: APIs, integrations, structured data       │
│  │ Speed: Medium, full load required                   │
│  │ Size: Verbose but schema-validated                  │
│  └──────────────────────────────────────────────────────┘
│
│  Compression (Optional)
│  ┌──────────────────────────────────────────────────────┐
│  │ .sql.gz     → SQL + gzip compression                │
│  │ .csv.bz2    → CSV + bzip2 compression               │
│  │ .json.gz    → JSON + gzip compression               │
│  │ Auto-detection via file extension                   │
│  │ Transparent decompression before parsing            │
│  └──────────────────────────────────────────────────────┘
│
└──────────────────────────────────────────────────────────────┘
```

---

## Validation Pipeline

```
Input Row
   │
   ▼
┌─────────────────────────────────────┐
│ Hymn Validation                     │
├─────────────────────────────────────┤
│ ✓ Title: Required, max 255 chars    │
│ ✓ Author: Optional, max 255 chars   │
│ ✓ Album: Optional, max 255 chars    │
│ ✓ Lyrics: Optional, max 50KB        │
│ ✓ Audio Path: Valid relative path   │
│ ✓ Category: Valid enum              │
│ ✓ Number: Unique (if provided)      │
│ ✓ Chords: Valid format, max 20KB    │
└────────────┬────────────────────────┘
             │
       ┌─────▼──────┐
       │All Valid?  │
       └─┬───────┬──┘
         │       │
        YES     NO
         │       │
    ┌────▼──┐   ┌▼──────────────┐
    │Insert │   │Log Error with │
    │into   │   │Line #, Field, │
    │DB     │   │Reason, Value  │
    └───────┘   └───────────────┘
```

---

## Module Dependencies

```
                  ┌──────────────┐
                  │   lib.rs     │
                  │ (Command Reg)│
                  └──────┬───────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼───────┐  ┌─────▼──────┐  ┌────▼──────┐
    │ commands/ │  │ cli.rs     │  │ db/      │
    │populate.rs│  │ (new code) │  │populate/ │
    └───┬───────┘  └─────┬──────┘  └────┬─────┘
        │                │              │
        │         ┌──────▼──────────────▼──┐
        │         │  populate.rs (Core)    │
        │         │  PopulateConfig        │
        │         │  PopulateReport        │
        │         │  PopulateError         │
        │         └──┬──────────────────┬──┘
        │            │                  │
        │    ┌───────▼──────┐  ┌────────▼─────┐
        │    │handlers/     │  │validators.rs │
        │    │(SQL,CSV,JSON)│  │ (Hymn, Bible)│
        │    └──────────────┘  └──────────────┘
        │
        └─────────────────────────────────────┐
                                              │
                                    ┌─────────▼────────┐
                                    │ React Components │
                                    │ (UI/routes)      │
                                    └──────────────────┘
```

---

## Transaction & Batch Strategy

```
Large File (100,000 rows)
      │
      ▼
┌─────────────────────────────────────┐
│ Chunk 1 (rows 1-1,000)              │
├─────────────────────────────────────┤
│ BEGIN TRANSACTION                   │
│ INSERT OR IGNORE × 1,000 rows       │
│ COMMIT                              │
│ ✓ Progress callback (1% done)       │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│ Chunk 2 (rows 1,001-2,000)          │
├─────────────────────────────────────┤
│ BEGIN TRANSACTION                   │
│ INSERT OR IGNORE × 1,000 rows       │
│ COMMIT                              │
│ ✓ Progress callback (2% done)       │
└─────────────────────────────────────┘
      │
      ▼
    ... (continue for all chunks)
      │
      ▼
┌─────────────────────────────────────┐
│ Final: Rebuild FTS Indexes          │
├─────────────────────────────────────┤
│ DELETE FROM hymns_fts               │
│ INSERT INTO hymns_fts SELECT ...    │
│ ✓ Progress callback (100% done)     │
└─────────────────────────────────────┘
      │
      ▼
Return Report
{
  total_inserted: 95_000,
  total_skipped: 5_000,  (duplicates)
  total_errors: 0,
  duration_ms: 8_500,
  errors: [],
  warnings: []
}
```

---

## UI Component Tree

```
┌─ /admin/populate (Route)
│
├─ PopulateSection
│  │
│  ├─ PopulateUpload
│  │  ├─ FileInput
│  │  ├─ DomainSelector
│  │  ├─ OptionsPanel
│  │  │  ├─ ReplaceToggle
│  │  │  ├─ DryRunCheckbox
│  │  │  └─ VerboseToggle
│  │  └─ SubmitButton
│  │
│  ├─ PopulateProgress (conditionally shown)
│  │  ├─ ProgressBar
│  │  ├─ StatsDisplay (inserted/skipped/errors)
│  │  └─ CancelButton
│  │
│  └─ PopulateReport (after completion)
│     ├─ SummaryCard
│     │  ├─ InsertedCount (green)
│     │  ├─ SkippedCount (yellow)
│     │  └─ ErrorCount (red)
│     │
│     ├─ ErrorsList (expandable)
│     │  ├─ ErrorItem × N
│     │  │  ├─ RowNumber
│     │  │  ├─ Field
│     │  │  ├─ Reason
│     │  │  └─ Value (sanitized)
│     │  └─ CopyToClipboard
│     │
│     └─ WarningsList (if any)
│        └─ WarningItem × N
```

---

## Error Handling Flow

```
Validation Error (Pre-Write)
  │
  ├─ Row 42: title is required
  ├─ Row 43: audio_path contains invalid characters
  ├─ Row 44: lyrics exceed 50KB limit
  │
  ▼
Report (No DB changes)
{
  "status": "failure",
  "total_inserted": 0,
  "total_skipped": 0,
  "total_errors": 3,
  "errors": [
    {
      "row": 42,
      "field": "title",
      "reason": "Required field is empty",
      "value": null
    },
    ...
  ]
}
  │
  ▼
UI: Show red banner with error count
    Allow user to download error report
    Suggest fix (e.g., "Add title to row 42")


Insert Error (During Write)
  │
  ├─ Foreign key constraint violation
  ├─ Rollback transaction
  ├─ Log details
  │
  ▼
Report (Partial success)
{
  "status": "partial_success",
  "total_inserted": 950,
  "total_skipped": 45,
  "total_errors": 5,
  "errors": [...]
}
  │
  ▼
UI: Show warning banner
    Allow retry with corrected file
```

---

## Idempotency Example

```
File: hymns.sql
───────────────────────────────────────────

Run 1: INSERT OR IGNORE
┌───────────────────────────────────┐
│ Inserted: 100 (new records)       │
│ Skipped:  0                       │
│ Report: Success                   │
└───────────────────────────────────┘

Run 2: Same file, same INSERT OR IGNORE
┌───────────────────────────────────┐
│ Inserted: 0 (all duplicates now)  │
│ Skipped:  100 (matching existing) │
│ Report: Success (idempotent)      │
└───────────────────────────────────┘

Run 3: With --replace flag
┌───────────────────────────────────┐
│ Deleted:  100 (old records)       │
│ Inserted: 100 (new versions)      │
│ Skipped:  0                       │
│ Report: Success (replaced)        │
└───────────────────────────────────┘
```

---

## CLI Usage Flowchart

```
User: louvorja-db populate hymns.sql --domain hymns

    ▼

Parse Arguments
├─ file: hymns.sql
├─ domain: hymns
└─ flags: (none)

    ▼

Load File
├─ Read SQL
├─ Parse INSERT statements
└─ Extract rows

    ▼

Validate
├─ Check required fields
├─ Verify data types
└─ Check constraints

    ▼

Validation OK?
├─ No: Print errors, exit(1)
└─ Yes: Continue

    ▼

Connect Database
├─ Open ~/.local/share/.../louvorja.db
└─ Acquire lock

    ▼

Insert Data
├─ BEGIN TRANSACTION
├─ INSERT OR IGNORE × N rows
├─ REBUILD FTS
└─ COMMIT

    ▼

Report
├─ Inserted: 100
├─ Skipped: 0
├─ Errors: 0
├─ Duration: 1.23s
└─ Exit(0) = Success
```

---

## Timeline Gantt Chart

```
Week 1: Core Infrastructure
├─ Day 1-2: Module setup ████████
├─ Day 3-4: SQL handler ████████████
└─ Day 5: Validation ████████░░░░░░ (partial)

Week 2: Format Handlers
├─ Day 1-2: CSV handler ████████████
├─ Day 3-4: JSON handler ████████████
└─ Day 5: Compression ████████░

Week 3: Frontend Integration
├─ Day 1-2: Commands ████████
├─ Day 3-4: React UI ████████████████
└─ Day 5: i18n █████░

Week 4: CLI & Docs
├─ Day 1-2: CLI tool ████████
├─ Day 3-4: Documentation ████████████
└─ Day 5: Testing/Sign-off ████████

Legend: ████ = On track, ░ = Buffer/At risk
```

---

## Deployment Phases

```
User Installs LouvorJA (Future)
      │
      ▼
┌─────────────────────────────────────┐
│ Installer                           │
├─────────────────────────────────────┤
│ ☐ Basic install (empty database)    │
│ ☐ + Stock Library (hymns + Bible)   │
│ ☐ + Sample Presentations            │
└─────────────────────────────────────┘
      │
      ├─ Choice 1: Basic
      │  └─ Empty hymns table
      │
      ├─ Choice 2: Stock Library (NEW)
      │  └─ populate_from_sql(
      │     "sql/seed-defaults.sql"
      │  )
      │
      └─ Choice 3: Full Setup
         ├─ Stock Library
         ├─ Sample service plans
         └─ Tutorial presentations
```

---

**End of Visual Architecture Document**

