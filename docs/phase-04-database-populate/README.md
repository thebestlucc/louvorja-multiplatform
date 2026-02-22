# Phase 4: Database Populate Feature

**Status:** 📋 Planning Phase  
**Target Launch:** ~4 weeks after Phase 11 completion  
**Owner:** TBD  

---

## 📚 Documentation

### Quick Start (5 min read)
→ **[SUMMARY.md](./SUMMARY.md)** — Executive overview, use cases, timeline

### Full Specification (30 min read)
→ **[DATABASE_POPULATE_PLAN.md](../DATABASE_POPULATE_PLAN.md)** — Complete design, architecture, formats, risks

### Implementation Tasks (For Dev Team)
→ **[TASKS.md](./TASKS.md)** — Week-by-week breakdown, 45+ actionable tasks, sign-off template

---

## 🎯 What This Feature Does

Bulk import hymns, Bible verses, and settings from SQL/CSV/JSON files into the LouvorJA database.

**Current:** Only legacy database import + manual UI entry  
**After:** Upload any file, auto-validate, real-time progress, detailed reports

---

## 🚀 Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| [SUMMARY.md](./SUMMARY.md) | 5-min overview | Stakeholders, PMs |
| [DATABASE_POPULATE_PLAN.md](../DATABASE_POPULATE_PLAN.md) | Full design spec | Architects, leads |
| [TASKS.md](./TASKS.md) | Implementation checklist | Developers |

---

## 📊 Key Stats

- **Effort:** 4 weeks (21 days)
- **Components:** 6 (core, handlers, validators, commands, UI, CLI)
- **Formats:** 3 (SQL, CSV, JSON)
- **Tests:** 50+
- **Breaking Changes:** 0

---

## ✅ Implementation Checklist

### Phase 4A: Core Infrastructure (Week 1)
- [ ] Core module types
- [ ] SQL handler
- [ ] Validation layer
- [ ] Test fixtures

### Phase 4B: Format Handlers (Week 2)
- [ ] CSV handler + streaming
- [ ] JSON handler
- [ ] Compression support (gzip/bzip2)
- [ ] Format auto-detection

### Phase 4C: Tauri + Frontend (Week 3)
- [ ] Tauri command registration
- [ ] React UI components
- [ ] Admin route
- [ ] i18n (EN/PT/ES)

### Phase 4D: CLI + Docs (Week 4)
- [ ] CLI subcommand
- [ ] Documentation
- [ ] Example seed files
- [ ] Smoke tests (all platforms)

---

## 🔗 Related Phases

- **Phase 11** (Hymn CRUD) — Populate complements manual entry
- **Phase 10** (Onboarding) — Optional integration for "Stock Library" step
- **Legacy Import** — Separate flow, still works

---

## 📖 Sample Usage

```bash
# As Developer
louvorja-db seed-defaults          # Pre-populate standard hymns + Bible

# As Admin (via UI)
# 1. Go to /admin/populate
# 2. Upload hymns.csv
# 3. See progress + results

# As Integrator (Rust)
let report = populate_from_sql(sql, "hymns", false)?;
println!("Inserted: {}", report.total_inserted);
```

---

## 🏗️ Architecture

```
Populate Feature
├── Handlers (SQL, CSV, JSON parsers)
├── Validators (domain-specific rules)
├── Commands (Tauri IPC)
├── UI (React components + route)
├── CLI (Developer tool)
└── Tests (50+ unit + integration)
```

**No database schema changes required.**

---

## 📋 File Structure

```
docs/
├── DATABASE_POPULATE_PLAN.md      ← Full specification
├── phase-04-database-populate/
│   ├── SUMMARY.md                 ← Quick overview (THIS FILE)
│   ├── TASKS.md                   ← Implementation checklist
│   └── README.md                  ← This file

src-tauri/src/
├── db/
│   └── populate/                  ← NEW MODULE
│       ├── handlers/              ← SQL, CSV, JSON
│       └── validators.rs          ← Validation rules
├── commands/
│   └── populate.rs                ← NEW: Tauri handlers
└── cli.rs                         ← Updated: Add populate commands

src/
├── components/populate/           ← NEW: UI components
├── routes/admin/                  ← NEW: Admin route
└── lib/queries.ts                 ← Updated: usePopulate hook

tests/
└── populate/                      ← NEW: Test suite
    ├── fixtures/                  ← Sample data
    └── populate.rs                ← Integration tests

sql/
├── seed-defaults.sql             ← NEW: Full seed
└── seed-minimal.sql              ← NEW: Quick setup
```

---

## 🎓 Design Principles

1. **Zero Breaking Changes** — Existing schemas, migrations, UI unchanged
2. **Multi-Format** — SQL, CSV, JSON (covers 95% of use cases)
3. **Validation-First** — Pre-write validation catches errors early
4. **Idempotent** — Safe to re-run (uses `INSERT OR IGNORE`)
5. **Transactional** — All-or-nothing per batch
6. **Documented** — User guide + API docs + examples

---

## ⚠️ Known Constraints

- **No breaking changes** to existing migrations or commands
- **No blob storage** for cover images (out of scope)
- **No merge strategies** (duplicate resolution is simple)
- **No GraphQL** export/import in this phase

---

## 🤝 Getting Started

1. **Review** → Read [SUMMARY.md](./SUMMARY.md) (5 min)
2. **Understand** → Skim [DATABASE_POPULATE_PLAN.md](../DATABASE_POPULATE_PLAN.md) sections 1-3
3. **Plan** → Assign tasks from [TASKS.md](./TASKS.md)
4. **Implement** → Follow week-by-week breakdown
5. **Review** → Weekly sign-off at end of each week

---

## 📞 Questions?

| Question | Answer |
|----------|--------|
| What is this? | Bulk data import feature for hymns, Bible, settings |
| Why needed? | Current setup requires legacy import or manual entry |
| How long? | 4 weeks |
| Does it change the DB? | No — reuses existing 46 tables |
| Multi-language support? | Yes — EN/PT/ES i18n included |
| CLI available? | Yes — `louvorja-db populate ...` |

---

## 📝 Document Versions

| File | Version | Last Updated |
|------|---------|--------------|
| SUMMARY.md | 1.0 | 2026-02-21 |
| DATABASE_POPULATE_PLAN.md | 1.0 | 2026-02-21 |
| TASKS.md | 1.0 | 2026-02-21 |

---

**Status:** ✅ Ready for Implementation  
**Next Step:** Approve plan and assign tasks for Week 1

