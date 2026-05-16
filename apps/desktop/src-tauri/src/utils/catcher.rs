use crate::error::AppError;

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
