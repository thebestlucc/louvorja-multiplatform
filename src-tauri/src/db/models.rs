use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hymn {
    pub id: i64,
    pub number: Option<i64>,
    pub title: String,
    pub author: Option<String>,
    pub album: Option<String>,
    pub lyrics: Option<String>,
    pub chords: Option<String>,
    pub audio_path: Option<String>,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub name: String,
    pub hymn_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleVersion {
    pub id: i64,
    pub name: String,
    pub abbreviation: String,
    pub language: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub name: String,
    pub chapter_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Verse {
    pub id: i64,
    pub version_id: i64,
    pub book: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleSearchResult {
    pub verse: Verse,
    pub book_name: String,
    pub snippet: String,
}

pub const BOOK_NAMES_PT: [&str; 66] = [
    "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio",
    "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel",
    "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras",
    "Neemias", "Ester", "Jó", "Salmos", "Provérbios",
    "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações",
    "Ezequiel", "Daniel", "Oséias", "Joel", "Amós",
    "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque",
    "Sofonias", "Ageu", "Zacarias", "Malaquias",
    "Mateus", "Marcos", "Lucas", "João", "Atos",
    "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios",
    "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo",
    "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago",
    "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João",
    "Judas", "Apocalipse",
];

pub const BOOK_NAMES_EN: [&str; 66] = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
    "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
    "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Presentation {
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub aspect_ratio: String,
    pub file_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Slide {
    pub id: i64,
    pub presentation_id: i64,
    pub slide_index: i64,
    pub slide_type: String,
    pub content: String,
    pub notes: Option<String>,
    pub transition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub id: i64,
    pub title: String,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceItem {
    pub id: i64,
    pub service_id: i64,
    pub item_type: String,
    pub item_id: Option<i64>,
    pub title: String,
    pub item_order: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    pub id: i64,
    pub item_type: String,
    pub item_id: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    pub id: i64,
    pub monitor_id: String,
    pub role: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideContent {
    pub slide_type: String,
    pub text: Option<String>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub label: Option<String>,
}
