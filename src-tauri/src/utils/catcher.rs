use crate::error::AppError;
use std::future::Future;

/// Standardizes error handling by wrapping a Result and returning a (Option<T>, Option<AppError>) tuple.
/// Similar to the frontend's catcher utility.
///
/// # Example
/// ```rust,ignore
/// let (data, err) = catcher(some_fn());
/// if let Some(e) = err {
///     return Err(e);
/// }
/// let data = data.unwrap();
/// ```
pub fn catcher<T, E>(result: Result<T, E>) -> (Option<T>, Option<AppError>)
where
    E: Into<AppError>,
{
    match result {
        Ok(data) => (Some(data), None),
        Err(err) => (None, Some(err.into())),
    }
}

/// Standardizes error handling for async operations.
#[allow(dead_code)]
pub async fn catcher_async<F, T, E>(future: F) -> (Option<T>, Option<AppError>)
where
    F: Future<Output = Result<T, E>>,
    E: Into<AppError>,
{
    catcher(future.await)
}

/// Standardizes error handling for closures.
#[allow(dead_code)]
pub fn catcher_sync<F, T, E>(f: F) -> (Option<T>, Option<AppError>)
where
    F: FnOnce() -> Result<T, E>,
    E: Into<AppError>,
{
    catcher(f())
}
