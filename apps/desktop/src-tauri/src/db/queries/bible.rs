use crate::db::models::{BibleSearchResult, BibleVersion, Book, Verse};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};

fn map_version_row(row: &Row) -> Result<BibleVersion, rusqlite::Error> {
    Ok(BibleVersion {
        id: row.get("id")?,
        name: row.get("name")?,
        abbreviation: row.get("abbreviation")?,
        language: row.get("language")?,
        is_builtin: row.get::<_, i64>("is_builtin").map(|v| v != 0).unwrap_or(true),
    })
}

fn map_verse_row(row: &Row) -> Result<Verse, rusqlite::Error> {
    Ok(Verse {
        id: row.get("id")?,
        version_id: row.get("version_id")?,
        book: row.get("book")?,
        chapter: row.get("chapter")?,
        verse: row.get("verse")?,
        text: row.get("text")?,
    })
}

fn sanitize_words(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

/// Build an FTS5 MATCH expression from raw user input.
/// - Substrings wrapped in `"..."` become exact phrase queries.
/// - Bare words become prefix queries (`word*`).
/// - Tokens are joined with implicit AND.
/// - Unclosed trailing `"` is treated as a phrase (forgiving).
/// - Diacritics and case are normalized by FTS5's unicode61 tokenizer
///   at both index and query time, so accented input still matches.
fn build_fts_query(query: &str) -> String {
    if !query.contains('"') {
        let sanitized = sanitize_words(query);
        if sanitized.is_empty() {
            return String::new();
        }
        return format!("{}*", sanitized);
    }

    let mut parts: Vec<String> = Vec::new();
    let mut buf = String::new();
    let mut in_quote = false;

    for c in query.chars() {
        if c == '"' {
            if in_quote {
                let phrase = sanitize_words(&buf);
                if !phrase.is_empty() {
                    parts.push(format!("\"{}\"", phrase));
                }
                buf.clear();
                in_quote = false;
            } else {
                let words = sanitize_words(&buf);
                for w in words.split_whitespace() {
                    parts.push(format!("{}*", w));
                }
                buf.clear();
                in_quote = true;
            }
        } else {
            buf.push(c);
        }
    }

    let trailing = sanitize_words(&buf);
    if in_quote {
        if !trailing.is_empty() {
            parts.push(format!("\"{}\"", trailing));
        }
    } else {
        for w in trailing.split_whitespace() {
            parts.push(format!("{}*", w));
        }
    }

    parts.join(" ")
}

pub fn get_versions(conn: &Connection) -> Result<Vec<BibleVersion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, abbreviation, language, is_builtin FROM bible_versions ORDER BY name",
    )?;
    let versions = stmt
        .query_map([], map_version_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(versions)
}

pub fn get_books(conn: &Connection, version_id: i64) -> Result<Vec<Book>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT book, MAX(chapter) as chapter_count
         FROM bible_verses
         WHERE version_id = ?1
         GROUP BY book
         ORDER BY MIN(rowid)",
    )?;
    let books = stmt
        .query_map(params![version_id], |row| {
            Ok(Book {
                name: row.get("book")?,
                chapter_count: row.get("chapter_count")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(books)
}

pub fn get_verses(
    conn: &Connection,
    version_id: i64,
    book: &str,
    chapter: i64,
) -> Result<Vec<Verse>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, version_id, book, chapter, verse, text
         FROM bible_verses
         WHERE version_id = ?1 AND book = ?2 AND chapter = ?3
         ORDER BY verse",
    )?;
    let verses = stmt
        .query_map(params![version_id, book, chapter], map_verse_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(verses)
}

pub fn get_chapters(conn: &Connection, version_id: i64, book: &str) -> Result<Vec<i32>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT chapter FROM bible_verses WHERE version_id = ?1 AND book = ?2 ORDER BY chapter",
    )?;
    let chapters = stmt
        .query_map(params![version_id, book], |row| row.get::<_, i32>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(chapters)
}

pub fn get_verse_range(
    conn: &Connection,
    version_id: i64,
    book: &str,
    chapter: i64,
    start: i64,
    end: i64,
) -> Result<Vec<Verse>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, version_id, book, chapter, verse, text
         FROM bible_verses
         WHERE version_id = ?1 AND book = ?2 AND chapter = ?3 AND verse >= ?4 AND verse <= ?5
         ORDER BY verse",
    )?;
    let verses = stmt
        .query_map(
            params![version_id, book, chapter, start, end],
            map_verse_row,
        )?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(verses)
}

pub fn search_bible_text(
    conn: &Connection,
    query: &str,
    version_id: Option<i64>,
) -> Result<Vec<BibleSearchResult>, AppError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    // 1. Try FTS5 text search
    let fts_query = build_fts_query(trimmed);
    if !fts_query.is_empty() {

        let map_fts = |row: &Row| -> Result<BibleSearchResult, rusqlite::Error> {
            let verse = map_verse_row(row)?;
            Ok(BibleSearchResult {
                book_name: row.get::<_, String>("book")?,
                snippet: row.get("snippet")?,
                version_abbreviation: row.get::<_, String>("version_abbreviation").unwrap_or_default(),
                verse,
            })
        };

        let fts_results = if let Some(vid) = version_id {
            let mut stmt = conn.prepare(
                "SELECT v.id, v.version_id, v.book, v.chapter, v.verse, v.text,
                        bv.abbreviation as version_abbreviation,
                        snippet(bible_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
                 FROM bible_verses v
                 JOIN bible_fts ON bible_fts.rowid = v.id
                 JOIN bible_versions bv ON bv.id = v.version_id
                 WHERE bible_fts MATCH ?1 AND v.version_id = ?2
                 ORDER BY rank
                 LIMIT 100",
            )?;
            let results = stmt
                .query_map(params![fts_query, vid], |row| map_fts(row))?
                .collect::<Result<Vec<_>, _>>()?;
            results
        } else {
            let mut stmt = conn.prepare(
                "SELECT v.id, v.version_id, v.book, v.chapter, v.verse, v.text,
                        bv.abbreviation as version_abbreviation,
                        snippet(bible_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
                 FROM bible_verses v
                 JOIN bible_fts ON bible_fts.rowid = v.id
                 JOIN bible_versions bv ON bv.id = v.version_id
                 WHERE bible_fts MATCH ?1
                 ORDER BY rank
                 LIMIT 100",
            )?;
            let results = stmt
                .query_map(params![fts_query], |row| map_fts(row))?
                .collect::<Result<Vec<_>, _>>()?;
            results
        };

        if !fts_results.is_empty() {
            return Ok(fts_results);
        }
    }

    // 2. Fallback: LIKE search (handles accents, partial words FTS5 may miss)
    let like_pattern = format!("%{}%", trimmed);

    let map_like = |row: &Row| -> Result<BibleSearchResult, rusqlite::Error> {
        let verse = map_verse_row(row)?;
        let snippet = verse.text.clone();
        let book_name = verse.book.clone();
        Ok(BibleSearchResult {
            verse,
            book_name,
            snippet,
            version_abbreviation: row.get::<_, String>("version_abbreviation").unwrap_or_default(),
        })
    };

    if let Some(vid) = version_id {
        let mut stmt = conn.prepare(
            "SELECT v.id, v.version_id, v.book, v.chapter, v.verse, v.text,
                    bv.abbreviation as version_abbreviation
             FROM bible_verses v
             JOIN bible_versions bv ON bv.id = v.version_id
             WHERE v.text LIKE ?1 AND v.version_id = ?2
             ORDER BY v.book, v.chapter, v.verse
             LIMIT 50",
        )?;
        let results = stmt
            .query_map(params![like_pattern, vid], |row| map_like(row))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(results)
    } else {
        let mut stmt = conn.prepare(
            "SELECT v.id, v.version_id, v.book, v.chapter, v.verse, v.text,
                    bv.abbreviation as version_abbreviation
             FROM bible_verses v
             JOIN bible_versions bv ON bv.id = v.version_id
             WHERE v.text LIKE ?1
             ORDER BY v.book, v.chapter, v.verse
             LIMIT 50",
        )?;
        let results = stmt
            .query_map(params![like_pattern], |row| map_like(row))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(results)
    }
}

pub fn import_bible_version(
    conn: &Connection,
    name: &str,
    abbreviation: &str,
    language: &str,
    verses: &[(String, i64, i64, String)], // (book, chapter, verse, text)
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO bible_versions (name, abbreviation, language, is_builtin) VALUES (?1, ?2, ?3, 0)",
        params![name, abbreviation, language],
    )?;
    let version_id = conn.last_insert_rowid();

    let mut stmt = conn.prepare(
        "INSERT INTO bible_verses (version_id, book, chapter, verse, text) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;
    for (book, chapter, verse, text) in verses {
        stmt.execute(params![version_id, book, chapter, verse, text])?;
    }

    // Rebuild FTS index for the new verses.
    // Use the delete-all command (not DELETE FROM) — bible_fts is a content-backed FTS5
    // table and DELETE FROM would cascade-delete rows from bible_verses via the content trigger.
    conn.execute_batch(
        "INSERT INTO bible_fts(bible_fts) VALUES('delete-all');
         INSERT INTO bible_fts(rowid, text, book) SELECT id, text, book FROM bible_verses;",
    )?;

    Ok(version_id)
}

pub fn search_bible_global(
    conn: &Connection,
    query: &str,
) -> Result<Vec<BibleSearchResult>, AppError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let fts_query = build_fts_query(trimmed);
    if fts_query.is_empty() {
        return Ok(vec![]);
    }

    let mut stmt = conn.prepare(
        "SELECT v.id, v.version_id, v.book, v.chapter, v.verse, v.text,
                bv.abbreviation as version_abbreviation,
                snippet(bible_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
         FROM bible_verses v
         JOIN bible_fts ON bible_fts.rowid = v.id
         JOIN bible_versions bv ON bv.id = v.version_id
         WHERE bible_fts MATCH ?1
         ORDER BY rank",
    )?;

    let results = stmt
        .query_map(params![fts_query], |row| {
            let verse = map_verse_row(row)?;
            Ok(BibleSearchResult {
                book_name: row.get::<_, String>("book")?,
                snippet: row.get("snippet")?,
                version_abbreviation: row.get("version_abbreviation")?,
                verse,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(results)
}
