use serde::Serialize;
use specta::datatype::reference::Reference;
use specta::Type;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Connection pool error: {0}")]
    Pool(#[from] r2d2::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    SerdeJson(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Tauri error: {0}")]
    Tauri(String),

    #[error("Updater error: {0}")]
    Updater(#[from] tauri_plugin_updater::Error),
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::Tauri(err.to_string())
    }
}

impl<T> From<std::sync::PoisonError<T>> for AppError {
    fn from(err: std::sync::PoisonError<T>) -> Self {
        AppError::Internal(format!("Lock poisoned: {}", err))
    }
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl specta::Type for AppError {
    fn inline(
        type_map: &mut specta::TypeCollection,
        generics: specta::Generics,
    ) -> specta::DataType {
        AppErrorResponse::inline(type_map, generics)
    }

    fn reference(
        type_map: &mut specta::TypeCollection,
        _generics: &[specta::DataType],
    ) -> Reference {
        AppErrorResponse::reference(type_map, &[])
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let response = match self {
            Self::Database(err) => AppErrorResponse {
                code: "DATABASE_ERROR".into(),
                message: "A database error occurred.".into(),
                details: Some(err.to_string()),
            },
            Self::Pool(err) => AppErrorResponse {
                code: "DATABASE_ERROR".into(),
                message: "A database connection pool error occurred.".into(),
                details: Some(err.to_string()),
            },
            Self::Io(err) => AppErrorResponse {
                code: "IO_ERROR".into(),
                message: "A file system error occurred.".into(),
                details: Some(err.to_string()),
            },
            Self::SerdeJson(err) => AppErrorResponse {
                code: "JSON_ERROR".into(),
                message: "A data processing error occurred.".into(),
                details: Some(err.to_string()),
            },
            Self::NotFound(msg) => AppErrorResponse {
                code: "NOT_FOUND".into(),
                message: msg.clone(),
                details: None,
            },
            Self::Internal(msg) => AppErrorResponse {
                code: "INTERNAL_ERROR".into(),
                message: "An internal application error occurred.".into(),
                details: Some(msg.clone()),
            },
            Self::Tauri(msg) => AppErrorResponse {
                code: "TAURI_ERROR".into(),
                message: "A Tauri framework error occurred.".into(),
                details: Some(msg.clone()),
            },
            Self::Updater(err) => AppErrorResponse {
                code: "UPDATER_ERROR".into(),
                message: "An update error occurred.".into(),
                details: Some(err.to_string()),
            },
        };
        response.serialize(serializer)
    }
}
