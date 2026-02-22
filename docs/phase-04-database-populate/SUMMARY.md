# Database Populate Feature - Executive Summary

**Date:** February 21, 2026
**Phase:** Post-Phase 11 (Phase 4)  
**Duration:** 4 weeks
**Status:** Ready for Implementation

---

## What Is Database Population?

A feature to **bulk import data** (hymns, Bible verses, settings) from external files into the LouvorJA application database. Currently, the app requires:
1. Manual importing from legacy Delphi database (one-time setup)
2. Or manual data entry via UI

This feature enables:
- **SQL files**: Pre-written INSERT scripts for developers
- **CSV files**: Spreadsheets for bulk hymn imports
- **JSON files**: API-friendly format for automation
- **CLI tool**: Quick setup for testing and deployment

---

## Problem Being Solved

### Current State
- ✅ Legacy database import works (Delphi → Modern app)
- ✅ Manual SQL scripts can be executed directly via SQLite CLI
- ✅ UI allows creating hymns one-at-a-time
- ❌ **No bulk population from arbitrary files**
- ❌ **No validation before insertion**
- ❌ **No progress tracking or error reporting**
- ❌ **No CLI tool for developers**

### After Implementation
- ✅ Upload SQL/CSV/JSON files via admin UI
- ✅ Pre-validate data before writing
- ✅ See real-time progress and detailed error reports
- ✅ CLI tool for developers: `louvorja-db populate sql/hymns.sql`
- ✅ Auto-detect file format and populate intelligently
- ✅ Safe to re-run (idempotent via `INSERT OR IGNORE`)

---

## Scope & Architecture

### What Gets Built

| Component | What | Where |
|-----------|------|-------|
| **Core Module** | Types, traits, orchestration | `src-tauri/src/db/populate.rs` |
| **Handlers** | SQL, CSV, JSON parsers | `src-tauri/src/db/populate/handlers/` |
| **Validators** | Domain-specific validation | `src-tauri/src/db/populate/validators.rs` |
| **Commands** | Tauri IPC handlers | `src-tauri/src/commands/populate.rs` |
| **UI** | File upload + progress | `/src/routes/admin/populate.tsx` |
| **CLI** | Developer tool | `src-tauri/src/cli.rs` |
| **Docs** | User guide | `docs/POPULATE_GUIDE.md` |

### What Does NOT Change

- Database schema (48 tables, no new ones)
- Migration system (stays as-is)
- Legacy import flow (still works)
- Existing UI/commands (unaffected)

---

## How It Works (High-Level)

```
User Action: Upload File
         ↓
Auto-Detect Format (SQL/CSV/JSON)
         ↓
Parse File → DataRows
         ↓
Validate Each Row (type, length, foreign keys)
         ↓
On Error: Show Report, Stop
On Success: Continue
         ↓
Begin Transaction
         ↓
INSERT OR IGNORE (avoid duplicates)
Insert Rows 1-1000 → Commit
Insert Rows 1001-2000 → Commit
...
         ↓
Rebuild FTS Indexes
         ↓
Return Report (X inserted, Y skipped, Z errors)
```

---

## Example Usage

### Option 1: Admin UI (Easiest)

```
1. Go to /admin/populate
2. Upload hymns.csv
3. Select domain: "Hymns"
4. Click "Auto-Populate"
5. See progress and results
```

### Option 2: CLI (Developer)

```bash
# Quick setup with defaults
louvorja-db seed-defaults

# Bulk import hymns
louvorja-db populate \
  --input sql/hymns.sql \
  --domain hymns \
  --replace

# Validate without writing
louvorja-db populate \
  --input hymns.csv \
  --validate-only
```

### Option 3: Programmatic (Rust/Integration)

```rust
let report = populate_from_sql(
    "INSERT INTO hymns (...) VALUES (...)",
    "hymns",
    false,
)?;
println!("Inserted: {}", report.total_inserted);
```

---

## Data Formats Supported

### SQL Format (Most Compatible)

```sql
INSERT INTO hymns (number, title, author, album, lyrics, category)
VALUES 
  (1, 'Amazing Grace', 'John Newton', 'Classics', 'Verse 1\n...', 'worship'),
  (2, 'How Great Thou Art', 'Carl Boberg', 'Classics', 'Verse 1\n...', 'worship');
```

### CSV Format (Spreadsheet-Friendly)

```
number,title,author,album,category
1,Amazing Grace,John Newton,Classics,worship
2,How Great Thou Art,Carl Boberg,Classics,worship
```

### JSON Format (API-Friendly)

```json
{
  "domain": "hymns",
  "data": [
    {
      "number": 1,
      "title": "Amazing Grace",
      "author": "John Newton",
      ...
    }
  ]
}
```

---

## Timeline & Phases

| Week | Component | Deliverable |
|------|-----------|-------------|
| **W1** | Core + SQL Handler | Rust library, testable |
| **W2** | CSV + JSON Handlers | Multi-format support |
| **W3** | Tauri + React UI | End-to-end flow working |
| **W4** | CLI + Docs | Production-ready |

**Total:** 4 weeks, ~21 days effort

---

## Success Criteria

✅ **Must Have**
- Parse SQL, CSV, JSON files
- Validate data before insertion (10+ validation rules)
- Bulk insert 10,000 rows in <10 seconds
- Support UTF-8 + accented chars (ç, ñ, ü)
- Idempotent (safe to re-run)

✅ **Should Have**
- Progress UI with real-time updates
- Detailed error reporting (line numbers, reasons)
- i18n for EN/PT/ES
- CLI tool for developers
- Sample seed files provided

❌ **Won't Do** (Out of Scope)
- Blob storage for covers
- Merge strategies (duplicate resolution)
- GraphQL export/import
- Cloud sync

---

## Key Design Decisions

1. **Formats:** SQL + CSV + JSON (covers 95% of use cases)
2. **Validation:** Pre-write (fail fast)
3. **Idempotence:** `INSERT OR IGNORE` prevents duplicates
4. **Transactions:** Per batch (1000 rows) for rollback safety
5. **No breaking changes:** Existing schema/migrations unchanged

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Corrupted DB from bad data | Pre-validation + transaction rollback |
| Large files = memory issues | Streaming CSV parser (chunk-based) |
| User confusion (populate vs. import) | Separate docs, distinct UI sections |
| Encoding issues (UTF-8) | Auto-detection + fallback tests |
| Performance degradation | Batch inserts, FTS index rebuild post-insert |

---

## Integration Points

### With Existing Code

- **Migrations:** Shares `migrations.rs` pattern (see `migrate_v3`)
- **Commands:** Reuses Tauri command pattern (see `music.rs`)
- **Queries:** May reuse `db::queries::music::insert_hymn()`
- **i18n:** Follows existing 3-locale pattern (EN/PT/ES)

### With Future Phases

- **Phase 5+:** Populate can auto-feed demo data
- **Onboarding:** Optional "Stock Library" step
- **Admin Dashboard:** Future monitoring/audit logs

---

## Dependencies

**Rust Crates:** All already in project
- `rusqlite` — database access
- `csv` — CSV parsing
- `serde_json` — JSON parsing
- `flate2`, `bzip2` — compression

**Languages:** Rust + TypeScript + SQL

**External:** None

---

## Effort & Budget

**Total:** 21 days (4 weeks, 5 days/week)

| Component | Days |
|-----------|------|
| Core module + SQL handler | 5 |
| CSV/JSON handlers | 4 |
| Tauri commands + React UI | 5 |
| CLI + docs + testing | 5 |
| Buffer & fixes | 2 |

---

## Next Steps

1. **Approve Plan** → Fork into implementation branch
2. **Week 1:** Start with core module (T4A-001 to T4A-010)
3. **Weekly Reviews:** Sign-off at end of each week
4. **Phase 4 Launch:** 4 weeks from start

---

## Reference Documents

- **Full Plan:** `docs/DATABASE_POPULATE_PLAN.md` (18 sections, 600+ lines)
- **Tasks:** `docs/phase-04-database-populate/TASKS.md` (detailed checklist)
- **Existing:** `docs/MIGRATION_GUIDE.md`, `scripts/seed-hymns.sql`

---

**Status:** ✅ Ready to Implement  
**Questions?** See `docs/DATABASE_POPULATE_PLAN.md` for full details.

