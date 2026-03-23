use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BibleVersion {
    #[specta(type = i32)]
    pub id: i64,
    pub name: String,
    pub abbreviation: String,
    pub language: String,
    pub is_builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub name: String,
    pub chapter_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Verse {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub version_id: i64,
    pub book: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BibleSearchResult {
    pub verse: Verse,
    pub book_name: String,
    pub snippet: String,
    pub version_abbreviation: String,
}
