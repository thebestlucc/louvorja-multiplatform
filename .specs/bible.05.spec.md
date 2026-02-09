# SPEC 05 — Bible Module

**Phase:** 4
**Goal:** Bible text display with multi-version support and search.

---

## Files to CREATE

### Frontend — Routes

#### `src/routes/bible/route.tsx`
- Create the Bible layout route
- Sub-layout with navigation panel on left and verse display on right
- Wraps children with `<Outlet />`

#### `src/routes/bible/index.tsx`
- Create the Bible navigation page
- Three-level breadcrumb navigation: Version → Book → Chapter
- Version selector dropdown (shows installed Bible versions)
- Book grid organized by Old Testament / New Testament sections
- Chapter number grid (after selecting a book)
- Verse display panel showing the selected chapter's verses
- Full-text search input with results below
- "Project Verse" button next to each verse (sends to projector)
- "Add to Service" button next to each verse
- Version comparison toggle: shows same verse in multiple installed versions side-by-side

### Frontend — Components

#### `src/components/bible/book-selector.tsx`
- Create the book/chapter/verse navigation component
- Two sections: Old Testament (39 books), New Testament (27 books)
- Book buttons arranged in a grid
- After selecting a book, chapter numbers appear in a grid
- After selecting a chapter, verses load in the main content area
- Back navigation at each level
- Keyboard-accessible

#### `src/components/bible/verse-display.tsx`
- Create the verse display component
- Renders verses with:
  - Verse numbers as superscript
  - Configurable font size
  - Configurable text color
  - Reference header (e.g., "Genesis 1:1-5 - ARA")
- Supports displaying a range of verses (e.g., verse 1-5)
- Selectable verses: click to select one or multiple verses for projection
- Selected verse highlighting (background color)
- Formatted for projector display (different styling when `mode='projector'`)

#### `src/components/bible/bible-search.tsx`
- Create the Bible full-text search component
- Search input with debounce (300ms)
- Results grouped by book/chapter
- Each result shows: book name, chapter:verse, matching text with highlighted search term
- Click on a result navigates to that book/chapter and highlights the verse
- Pagination for large result sets
- Filter by: Bible version, Old/New Testament

#### `src/components/bible/version-comparison.tsx`
- Create side-by-side verse comparison component
- Shows the selected verse(s) in all installed Bible versions
- Horizontal scrollable panels if more than 3 versions
- Each panel labeled with version code (ARA, NVI, KJV, etc.)
- Differences highlighted (optional, stretch goal)

### Frontend — Hooks

#### `src/hooks/use-bible.ts`
- Create Bible navigation state hook
- State: `currentVersionId`, `currentBook`, `currentChapter`, `selectedVerses: number[]`
- Actions: `setVersion(id)`, `setBook(book)`, `setChapter(chapter)`, `selectVerse(verse)`, `selectVerseRange(from, to)`, `clearSelection()`
- `projectSelectedVerses()` — formats selected verses and sends to projector via Tauri command

### Frontend — Types

#### `src/types/bible.ts` (UPDATE)
- Finalize types:
  - `BibleVersion`: `{ id: number; code: string; name: string; language: string }`
  - `Book`: `{ number: number; name: string; chapters: number }` (chapter count)
  - `Verse`: `{ id: number; versionId: number; book: number; chapter: number; verse: number; text: string }`
  - `BibleSearchResult`: `{ verse: Verse; bookName: string; highlight: string }`

---

## Files to UPDATE

### Backend — Bible Commands

#### `src-tauri/src/commands/bible.rs`
- Implement all Bible commands:
  - `get_bible_versions() -> Result<Vec<BibleVersion>, AppError>` — list all installed Bible versions
  - `get_books(version_id: i64) -> Result<Vec<Book>, AppError>` — list all books for a version with chapter counts
  - `get_verses(version_id: i64, book: i32, chapter: i32) -> Result<Vec<Verse>, AppError>` — get all verses for a chapter
  - `get_verse_range(version_id: i64, book: i32, chapter: i32, verse_start: i32, verse_end: i32) -> Result<Vec<Verse>, AppError>` — get a specific verse range
  - `search_bible(query: String, version_id: i64) -> Result<Vec<BibleSearchResult>, AppError>` — full-text search via FTS5
  - `project_bible_verse(version_id: i64, book: i32, chapter: i32, verse_start: i32, verse_end: i32) -> Result<(), AppError>` — format and send verse to projector via Tauri event

### Backend — Database Queries

#### `src-tauri/src/db/queries/bible.rs`
- Implement all Bible query functions:
  - `get_versions(conn) -> Result<Vec<BibleVersion>>`
  - `get_books(conn, version_id) -> Result<Vec<Book>>` — SELECT DISTINCT book, with book name mapping
  - `get_verses(conn, version_id, book, chapter) -> Result<Vec<Verse>>` — SELECT * FROM bible_verses WHERE version_id=? AND book=? AND chapter=? ORDER BY verse
  - `get_verse_range(conn, version_id, book, chapter, start, end) -> Result<Vec<Verse>>`
  - `search_bible_text(conn, query, version_id) -> Result<Vec<BibleSearchResult>>` — FTS5 search on `bible_fts`
  - `get_chapter_count(conn, version_id, book) -> Result<i32>` — SELECT MAX(chapter) FROM bible_verses WHERE ...
  - `get_verse_count(conn, version_id, book, chapter) -> Result<i32>` — SELECT MAX(verse) FROM bible_verses WHERE ...

### Backend — Models

#### `src-tauri/src/db/models.rs`
- Add `Book` struct: `{ number: i32, name: String, chapters: i32 }`
- Add `BibleSearchResult` struct: `{ verse: Verse, book_name: String, snippet: String }`
- Add `BOOK_NAMES` constant array mapping book numbers to Portuguese names (with English fallback for i18n)

### Backend — Database

#### `src-tauri/src/db/migrations.rs`
- Ensure the `bible_versions` and `bible_verses` tables are created (from Phase 0)
- Add initial Bible data import command:
  - `import_bible_version(conn, path) -> Result<()>` — imports a Bible version from a data file (JSON or SQL dump)
- Seed the default ARA (Almeida Revista e Atualizada) version on first run

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register all Bible commands: `get_bible_versions`, `get_books`, `get_verses`, `get_verse_range`, `search_bible`, `project_bible_verse`

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `getBibleVersions(): Promise<BibleVersion[]>`
  - `getBooks(versionId: number): Promise<Book[]>`
  - `getVerses(versionId: number, book: number, chapter: number): Promise<Verse[]>`
  - `getVerseRange(versionId: number, book: number, chapter: number, start: number, end: number): Promise<Verse[]>`
  - `searchBible(query: string, versionId: number): Promise<BibleSearchResult[]>`
  - `projectBibleVerse(versionId: number, book: number, chapter: number, start: number, end: number): Promise<void>`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query keys and hooks for Bible:
  - `queryKeys.bible.versions`
  - `queryKeys.bible.books(versionId)`
  - `queryKeys.bible.verses(versionId, book, chapter)`
  - `queryKeys.bible.search(query, versionId)`
  - `useBibleVersions()` — fetch installed versions
  - `useBooks(versionId)` — fetch book list
  - `useVerses(versionId, book, chapter)` — fetch verses
  - `useBibleSearch(query, versionId)` — search with debounce

### Frontend — Slide Renderer

#### `src/components/slides/slide-renderer.tsx` (UPDATE)
- Add support for `type: 'bible'` slide content
- Bible slides display:
  - Reference header: "Book Chapter:VerseStart-VerseEnd"
  - Verse text with verse numbers
  - Bible version code in the corner
  - Different default styling (serif font, centered text)
