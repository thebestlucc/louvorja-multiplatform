use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Favorite {
    #[specta(type = i32)]
    pub id: i64,
    pub item_type: String,
    #[specta(type = i32)]
    pub item_id: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibraryCategory {
    #[specta(type = i32)]
    pub id: i64,
    pub name: String,
    pub sort_order: i32,
    pub id_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibraryCategoryInput {
    pub id: Option<i64>,
    pub name: String,
    pub sort_order: i32,
    pub id_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibraryItem {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub category_id: i64,
    pub name: String,
    pub file_path: String,
    pub file_type: String,
    pub thumbnail_path: Option<String>,
    pub scheduled_date: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibraryItemInput {
    pub id: Option<i64>,
    #[specta(type = i32)]
    pub category_id: i64,
    pub name: String,
    pub file_path: String,
    pub file_type: String,
    pub thumbnail_path: Option<String>,
    pub scheduled_date: Option<String>,
    pub sort_order: i32,
}
