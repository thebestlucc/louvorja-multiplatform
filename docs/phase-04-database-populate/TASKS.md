# Database Populate Feature - Implementation Tasks

**Phase:** 4 (Post-Phase 11)  
**Duration:** 4 weeks (21 days, 5 days/week)  
**Status:** Planning  
**Target Launch:** ~4 weeks after Phase 11 completion  

---

## Phase 4A: Core Infrastructure (Week 1)

### Day 1-2: Core Module Setup

- [ ] **T4A-001** Create `src-tauri/src/db/populate.rs` with base types
  - [ ] `PopulateConfig` struct
  - [ ] `PopulateDomain` enum
  - [ ] `PopulateReport` struct
  - [ ] `PopulateError` enum
  - Duration: 2h
  - Priority: **P0 (Critical)**
  - Owner: (assign)

- [ ] **T4A-002** Create `src-tauri/src/db/populate/mod.rs`
  - [ ] Module layout
  - [ ] Public API structure
  - Duration: 1h
  - Priority: **P0 (Critical)**
  - Owner: (assign)

- [ ] **T4A-003** Create `src-tauri/src/db/populate/handlers/mod.rs`
  - [ ] `PopulateHandler` trait definition
  - [ ] Handler registry
  - Duration: 1.5h
  - Priority: **P0 (Critical)**
  - Owner: (assign)

### Day 2-3: SQL Handler

- [ ] **T4A-004** Implement SQL handler in `src-tauri/src/db/populate/handlers/sql.rs`
  - [ ] Parse `INSERT INTO` statements
  - [ ] Extract column names and values
  - [ ] Handle multiline strings (with `''` escaping)
  - Duration: 4h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4A-003

- [ ] **T4A-005** Add unit tests for SQL handler
  - [ ] Test basic INSERT parsing
  - [ ] Test escaped quotes
  - [ ] Test multiline values
  - [ ] Test multiple rows
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4A-004

### Day 3-4: Validation Layer

- [ ] **T4A-006** Create `src-tauri/src/db/populate/validators.rs`
  - [ ] `Validators` impl with `validate_hymn()`
  - [ ] `validate_bible_verse()`
  - [ ] `validate_setting()`
  - Duration: 3h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4A-007** Add validation tests
  - [ ] Valid hymn acceptance
  - [ ] Invalid hymn rejection (missing title, oversized lyrics)
  - [ ] Bible book name validation
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4A-006

### Day 4-5: Test Infrastructure

- [ ] **T4A-008** Create test fixtures in `tests/populate/`
  - [ ] `tests/populate/fixtures/hymns.sql`
  - [ ] `tests/populate/fixtures/bible.sql`
  - [ ] `tests/populate/fixtures/settings.sql`
  - Duration: 1.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4A-009** Add integration tests in `tests/populate/populate.rs`
  - [ ] Test populate from SQL (idempotent)
  - [ ] Test dry-run mode
  - [ ] Test error reporting
  - Duration: 3h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4A-008, T4A-004, T4A-006

- [ ] **T4A-010** Update `src-tauri/src/lib.rs` for command registration (placeholder)
  - [ ] Add comment about populate commands
  - Duration: 0.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

**End of Week 1 Deliverable:**
- ✅ Core populate module with types and traits
- ✅ SQL handler parsing INSERT statements
- ✅ Validation layer for hymns, bible, settings
- ✅ ~50 unit and integration tests passing
- ✅ Callable from Rust code, no UI yet

**Acceptance Criteria:**
- [ ] `cargo test` for populate module passes 100%
- [ ] `cargo clippy` has no warnings
- [ ] SQL handler parses 10+ test cases correctly
- [ ] Validation rejects invalid data with clear messages

---

## Phase 4B: Format Handlers (Week 2)

### Day 1-2: CSV Handler

- [ ] **T4B-001** Implement CSV handler in `src-tauri/src/db/populate/handlers/csv.rs`
  - [ ] Use `csv` crate for parsing
  - [ ] Support custom column mapping
  - [ ] Handle UTF-8 encoding detection
  - Duration: 3h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4B-002** Add CSV validation tests
  - [ ] Basic CSV parsing
  - [ ] Header detection
  - [ ] Column mapping
  - [ ] Missing required columns
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4B-001

- [ ] **T4B-003** Create `tests/populate/fixtures/hymns.csv`
  - Duration: 0.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

### Day 2-3: JSON Handler

- [ ] **T4B-004** Implement JSON handler in `src-tauri/src/db/populate/handlers/json.rs`
  - [ ] Parse JSON array of objects
  - [ ] Support nested `data` field
  - [ ] Validate against schema
  - Duration: 2.5h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4B-005** Add JSON validation tests
  - [ ] Valid JSON parsing
  - [ ] Schema validation
  - [ ] Missing fields detection
  - Duration: 1.5h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4B-004

- [ ] **T4B-006** Create `tests/populate/fixtures/hymns.json`
  - Duration: 0.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

### Day 3-4: Streaming & Compression

- [ ] **T4B-007** Add streaming CSV support for large files
  - [ ] Chunk-based parsing
  - [ ] Iterator interface
  - [ ] Memory efficiency tests
  - Duration: 2h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4B-008** Add gzip/bzip2 decompression support
  - [ ] Auto-detect compression from extension
  - [ ] Use `flate2` and `bzip2` crates
  - Duration: 1.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

### Day 4-5: Handler Registration

- [ ] **T4B-009** Implement format auto-detection
  - [ ] Detect SQL vs. CSV vs. JSON from file extension
  - [ ] Fallback to content parsing
  - Duration: 1h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4B-010** Create handler registry and factory
  - [ ] `get_handler_for_path()` function
  - [ ] `parse_any_format()` utility
  - Duration: 1h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4B-011** Integration test all handlers
  - [ ] SQL → Hymns
  - [ ] CSV → Bible verses
  - [ ] JSON → Settings
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4B-002, T4B-005, T4B-009

**End of Week 2 Deliverable:**
- ✅ CSV handler with column mapping
- ✅ JSON handler with schema validation
- ✅ Streaming support for large files
- ✅ Compression support (gzip, bzip2)
- ✅ Format auto-detection

**Acceptance Criteria:**
- [ ] `cargo test populate` passes 100%
- [ ] All 3 handlers tested with fixtures
- [ ] Large file test (10,000 rows) completes in <5s
- [ ] CSV with custom column mapping works

---

## Phase 4C: Tauri Commands & Frontend Integration (Week 3)

### Day 1-2: Command Handlers

- [ ] **T4C-001** Create `src-tauri/src/commands/populate.rs`
  - [ ] `populate_from_file()` command
  - [ ] `validate_populate_file()` command
  - [ ] `populate_from_sql()` command (for admin)
  - Duration: 3h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4C-002** Register populate commands in `src-tauri/src/lib.rs`
  - [ ] Add to `generate_handler![]` macro
  - Duration: 0.5h
  - Priority: **P0 (Critical)**
  - Owner: (assign)
  - Dependencies: T4C-001

- [ ] **T4C-003** Add command tests (Tauri integration)
  - [ ] Call from test `invoke()`
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4C-002

### Day 2-3: React Hook & TanStack Query

- [ ] **T4C-004** Create `src/lib/queries.ts` hook for populate
  - [ ] `usePopulate()` mutation
  - [ ] `useValidatePopulateFile()` query
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4C-005** Create `/src/components/populate/` directory
  - [ ] `PopulateUpload.tsx` — File uploader
  - [ ] `PopulateProgress.tsx` — Progress bar
  - [ ] `PopulateReport.tsx` — Results display
  - Duration: 3h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4C-004

### Day 3-4: Admin UI

- [ ] **T4C-006** Create `/src/routes/admin/populate.tsx`
  - [ ] File upload form
  - [ ] Domain selector (Hymns, Bible, Settings, etc.)
  - [ ] Replace vs. Append toggle
  - [ ] Dry-run checkbox
  - Duration: 3h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4C-005

- [ ] **T4C-007** Add error display with details
  - [ ] Error count badge
  - [ ] Expandable error list
  - [ ] Copy errors to clipboard
  - Duration: 1.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)
  - Dependencies: T4C-006

### Day 4-5: i18n & Polish

- [ ] **T4C-008** Add i18n keys for populate UI
  - [ ] `src/locales/en.json` — English
  - [ ] `src/locales/pt.json` — Portuguese
  - [ ] `src/locales/es.json` — Spanish
  - Duration: 1h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4C-009** Add CSV mapping UI (optional)
  - [ ] Column picker UI
  - [ ] Mapping preview
  - Duration: 2h
  - Priority: **P3 (Low)**
  - Owner: (assign)
  - Dependencies: T4C-006

- [ ] **T4C-010** Smoke test populate flow on all platforms
  - [ ] Windows: upload .sql file
  - [ ] macOS: upload .csv file
  - [ ] Linux: upload .json file
  - Duration: 1.5h
  - Priority: **P1 (High)**
  - Owner: (assign)

**End of Week 3 Deliverable:**
- ✅ Working Tauri commands for populate
- ✅ React UI for file upload + progress
- ✅ Error display and report
- ✅ i18n support for all 3 languages
- ✅ Smoke tests passing on all platforms

**Acceptance Criteria:**
- [ ] Frontend to backend flow works (upload → populate → report)
- [ ] Progress updates visible in real-time
- [ ] Errors displayed with line numbers and suggestions
- [ ] All i18n keys present in EN/PT/ES
- [ ] No TypeScript errors (`npx tsc --noEmit`)

---

## Phase 4D: CLI & Documentation (Week 4)

### Day 1: CLI Implementation

- [ ] **T4D-001** Add populate subcommand to `src-tauri/src/cli.rs`
  - [ ] `populate --input FILE --domain DOMAIN [--replace]`
  - [ ] `populate-csv --input FILE --map '{"col1": "title"}'`
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4D-002** Test CLI on all platforms
  - [ ] Build release binary
  - [ ] Test on Windows, macOS, Linux
  - Duration: 1.5h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4D-001

### Day 2-3: Documentation

- [ ] **T4D-003** Write `docs/POPULATE_GUIDE.md`
  - [ ] Overview & use cases
  - [ ] SQL format specification
  - [ ] CSV format specification
  - [ ] JSON format specification
  - [ ] Validation rules per domain
  - [ ] Error handling & recovery
  - [ ] Security considerations
  - Duration: 3h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4D-004** Write CLI examples in guide
  - [ ] `louvorja-db seed-defaults`
  - [ ] `louvorja-db populate sql/hymns.sql --domain hymns`
  - [ ] `louvorja-db populate hymns.csv --map '....'`
  - Duration: 1h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4D-005** Create example seed files
  - [ ] `sql/seed-defaults.sql` — Full default seed
  - [ ] `sql/seed-minimal.sql` — Quick onboarding
  - [ ] `examples/hymns-sample.csv` — CSV example
  - [ ] `examples/hymns-sample.json` — JSON example
  - Duration: 2h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4D-006** Update `README.md` with populate section
  - [ ] Quick setup with `seed-defaults`
  - [ ] Link to full guide
  - Duration: 0.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

### Day 3-4: Integration & Testing

- [ ] **T4D-007** Add populate to release build script
  - [ ] Pre-populate during installer setup (opt-in)
  - [ ] README for distributors
  - Duration: 1.5h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4D-008** Create end-to-end smoke test suite
  - [ ] `tests/smoke/populate.rs` (Rust test)
  - [ ] Platform-specific shell scripts
  - [ ] Test matrix: Windows, macOS, Linux × 3 formats (SQL, CSV, JSON)
  - Duration: 2h
  - Priority: **P1 (High)**
  - Owner: (assign)

- [ ] **T4D-009** Run final CI/CD validation
  - [ ] `cargo test --all-features` ✅
  - [ ] `cargo clippy` ✅
  - [ ] `npx tsc --noEmit` ✅
  - [ ] `pnpm vite build` ✅
  - Duration: 1h
  - Priority: **P1 (High)**
  - Owner: (assign)
  - Dependencies: T4D-008

### Day 5: Final Review & Documentation

- [ ] **T4D-010** Create HANDOFF.md for next phase
  - [ ] Feature summary
  - [ ] Known limitations
  - [ ] Future enhancement ideas
  - [ ] Technical debt (if any)
  - Duration: 1h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4D-011** Update `CLAUDE.md` project guidelines
  - [ ] Add populate patterns to "Common Patterns"
  - [ ] Reference new populate handlers
  - [ ] Update command checklist for populate commands
  - Duration: 1h
  - Priority: **P2 (Medium)**
  - Owner: (assign)

- [ ] **T4D-012** Record session learnings in memory file
  - [ ] What worked well
  - [ ] What was tricky
  - [ ] Patterns established
  - Duration: 0.5h
  - Priority: **P3 (Low)**
  - Owner: (assign)

**End of Week 4 Deliverable:**
- ✅ Full CLI tool with all subcommands
- ✅ Complete user guide (`POPULATE_GUIDE.md`)
- ✅ Example seed files for distributions
- ✅ Smoke tests passing on all platforms
- ✅ Feature ready for Phase 5+ integration

**Acceptance Criteria:**
- [ ] CLI tool documented with examples
- [ ] All tests passing on CI/CD
- [ ] No merge conflicts in CLAUDE.md
- [ ] Handoff document complete
- [ ] Feature can be demoed end-to-end

---

## Cross-Cutting Concerns

### Quality Gates (All Weeks)

- [ ] **QG-001** Code Review
  - [ ] Each PR reviewed by team lead before merge
  - [ ] Focus on error handling and validation
  - Duration: 30min per PR (Async)
  - Owner: (assign as reviewer)

- [ ] **QG-002** Documentation Updates
  - [ ] CLAUDE.md kept in sync with new patterns
  - [ ] No broken links in docs
  - Owner: (self-service, update on completion)

- [ ] **QG-003** Backwards Compatibility
  - [ ] Ensure no breaking changes to migrations.rs
  - [ ] Existing databases still work after populate
  - Test: `cargo test migrations` passes
  - Owner: (assign)

### Performance Benchmarks

- [ ] **PB-001** Bulk insert performance
  - [ ] 10,000 hymns in <10 seconds
  - [ ] 100,000 Bible verses in <30 seconds
  - Test: See `benches/populate.rs` (future)
  - Owner: (assign)

- [ ] **PB-002** Memory footprint
  - [ ] CSV parsing uses <50MB for 100,000 rows
  - [ ] No memory leaks in long-running operations
  - Owner: (assign)

### Platform Testing

- [ ] **PT-001** Windows (10/11)
  - [ ] CLI works
  - [ ] UI responsive
  - [ ] File paths with spaces work
  - Owner: (assign or test team)

- [ ] **PT-002** macOS (12+)
  - [ ] CLI works
  - [ ] File permissions respected
  - Owner: (assign or test team)

- [ ] **PT-003** Linux (Ubuntu 22.04+)
  - [ ] CLI works
  - [ ] AppImage distribution works
  - Owner: (assign or test team)

---

## Success Metrics (End of Phase 4)

### Functional

- [x] Can parse SQL, CSV, JSON files
- [x] Bulk insert 10,000 hymns in <10s
- [x] Supports all 3 languages (UTF-8 + accents)
- [x] FTS indexes rebuild correctly
- [x] Dry-run mode works without side effects
- [x] Idempotent (re-running is safe)

### Code Quality

- [x] All tests passing (`cargo test`, `npm test`)
- [x] No clippy warnings
- [x] No TypeScript errors
- [x] Code coverage >80% for populate module
- [x] Documentation 100% complete

### User Experience

- [x] Clear error messages with line numbers
- [x] Progress UI shows real-time updates
- [x] Distinct from "Legacy Import" in docs
- [x] i18n keys complete for EN/PT/ES
- [x] Example data provided

### Developer Experience

- [x] CLI tool for quick testing
- [x] Documented API for SDK users
- [x] Example seed files included
- [x] Contributing guide updated

---

## Dependencies & Blockers

### External Dependencies

- `csv` crate (for CSV parsing)
- `serde_json` (for JSON parsing)
- `flate2` (for gzip support)
- `bzip2` (for bzip2 support)

**Status:** All crates already in use in the project ✅

### Internal Dependencies

- Phase 4A → 4B (handlers depend on core types)
- Phase 4B → 4C (commands depend on handlers)
- Phase 4C → 4D (docs depend on feature completion)

**No blockers identified.**

---

## Sign-Off Template

### Week 1 Sign-Off

**Completed by:** `[Name]`  
**Date:** `[YYYY-MM-DD]`  
**Status:** ☐ On Track / ☐ At Risk / ☐ Blocked

- [ ] All T4A tasks completed
- [ ] `cargo test populate` 100% pass rate
- [ ] No clippy warnings
- [ ] SQL handler parses 10+ test cases

### Week 2 Sign-Off

**Completed by:** `[Name]`  
**Date:** `[YYYY-MM-DD]`  
**Status:** ☐ On Track / ☐ At Risk / ☐ Blocked

- [ ] All T4B tasks completed
- [ ] CSV and JSON handlers work
- [ ] Streaming test passes (10,000 rows)
- [ ] Format auto-detection works

### Week 3 Sign-Off

**Completed by:** `[Name]`  
**Date:** `[YYYY-MM-DD]`  
**Status:** ☐ On Track / ☐ At Risk / ☐ Blocked

- [ ] All T4C tasks completed
- [ ] React UI responsive on desktop
- [ ] All i18n keys present
- [ ] No TypeScript errors

### Week 4 Sign-Off

**Completed by:** `[Name]`  
**Date:** `[YYYY-MM-DD]`  
**Status:** ☐ On Track / ☐ At Risk / ☐ Complete

- [ ] All T4D tasks completed
- [ ] CLI tool working
- [ ] Documentation 100% complete
- [ ] All smoke tests passing

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-21  
**Next Review:** End of Week 1

