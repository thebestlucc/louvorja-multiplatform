use crate::db::models::{BibleSearchResult, BibleVersion, Book, Verse};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};

fn map_version_row(row: &Row) -> Result<BibleVersion, rusqlite::Error> {
    Ok(BibleVersion {
        id: row.get("id")?,
        name: row.get("name")?,
        abbreviation: row.get("abbreviation")?,
        language: row.get("language")?,
        file_path: row.get("file_path")?,
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

fn sanitize_fts_query(query: &str) -> String {
    query
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

pub fn get_versions(conn: &Connection) -> Result<Vec<BibleVersion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, abbreviation, language, file_path FROM bible_versions ORDER BY name",
    )?;
    let versions = stmt
        .query_map([], |row| map_version_row(row))?
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
        .query_map(params![version_id, book, chapter], |row| {
            map_verse_row(row)
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(verses)
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
        .query_map(params![version_id, book, chapter, start, end], |row| {
            map_verse_row(row)
        })?
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
    let sanitized = sanitize_fts_query(trimmed);
    if !sanitized.is_empty() {
        let fts_query = format!("{}*", sanitized);

        let map_fts = |row: &Row| -> Result<BibleSearchResult, rusqlite::Error> {
            let verse = map_verse_row(row)?;
            Ok(BibleSearchResult {
                book_name: row.get::<_, String>("book")?,
                snippet: row.get("snippet")?,
                verse,
            })
        };

        let fts_results = if let Some(vid) = version_id {
            let mut stmt = conn.prepare(
                "SELECT v.id, v.version_id, v.book, v.chapter, v.verse, v.text,
                        snippet(bible_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
                 FROM bible_verses v
                 JOIN bible_fts ON bible_fts.rowid = v.id
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
                        snippet(bible_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
                 FROM bible_verses v
                 JOIN bible_fts ON bible_fts.rowid = v.id
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
        })
    };

    if let Some(vid) = version_id {
        let mut stmt = conn.prepare(
            "SELECT id, version_id, book, chapter, verse, text
             FROM bible_verses
             WHERE text LIKE ?1 AND version_id = ?2
             ORDER BY book, chapter, verse
             LIMIT 50",
        )?;
        let results = stmt
            .query_map(params![like_pattern, vid], |row| map_like(row))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(results)
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, version_id, book, chapter, verse, text
             FROM bible_verses
             WHERE text LIKE ?1
             ORDER BY book, chapter, verse
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
        "INSERT INTO bible_versions (name, abbreviation, language) VALUES (?1, ?2, ?3)",
        params![name, abbreviation, language],
    )?;
    let version_id = conn.last_insert_rowid();

    let mut stmt = conn.prepare(
        "INSERT INTO bible_verses (version_id, book, chapter, verse, text) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;
    for (book, chapter, verse, text) in verses {
        stmt.execute(params![version_id, book, chapter, verse, text])?;
    }

    // Rebuild FTS index for the new verses
    conn.execute_batch(
        "DELETE FROM bible_fts;
         INSERT INTO bible_fts(rowid, text, book) SELECT id, text, book FROM bible_verses;",
    )?;

    Ok(version_id)
}
