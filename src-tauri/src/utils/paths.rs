use std::path::{Component, Path, PathBuf};
use crate::error::AppError;

/// Resolves a content-DB relative path to an absolute path, handling Unicode normalization
/// mismatches between the content DB (NFC) and files extracted from macOS-created ZIPs (NFD).
///
/// On Windows, NTFS stores filenames as-is without Unicode normalization, so a path component
/// like "Hinário" (NFC U+00E1) won't match a directory named with NFD decomposed a + U+0301.
/// Returns the NFC path if it exists, falls back to NFD, or returns NFC if neither exists.
pub fn resolve_content_path(app_data_dir: &Path, rel: &str) -> String {
    let nfc_path = app_data_dir
        .join(rel.trim_start_matches('/'))
        .to_string_lossy()
        .replace('\\', "/");

    if Path::new(&nfc_path).exists() {
        return nfc_path;
    }

    // Fallback: try NFD normalization for files extracted from macOS ZIPs on Windows.
    #[cfg(target_os = "windows")]
    {
        use unicode_normalization::UnicodeNormalization;
        let nfd_path: String = nfc_path.nfd().collect();
        if nfd_path != nfc_path && Path::new(&nfd_path).exists() {
            return nfd_path;
        }
    }

    nfc_path
}

pub struct SafePath {
    root: PathBuf,
}

impl SafePath {
    pub fn new<P: AsRef<Path>>(root: P) -> Self {
        Self {
            root: root.as_ref().to_path_buf(),
        }
    }

    pub fn resolve<P: AsRef<Path>>(&self, path: P) -> Result<PathBuf, AppError> {
        let path = path.as_ref();
        
        // 1. Join root and path
        let mut full_path = self.root.clone();
        
        // If the path is absolute, we should still handle it carefully
        // or reject it if it doesn't start with root.
        if path.is_absolute() {
            if !path.starts_with(&self.root) {
                return Err(AppError::Internal(format!(
                    "Absolute path {:?} is outside of root {:?}",
                    path, self.root
                )));
            }
            full_path = path.to_path_buf();
        } else {
            full_path.push(path);
        }

        // 2. Normalize components to resolve '..' and '.'
        let mut normalized = PathBuf::new();
        for component in full_path.components() {
            match component {
                Component::Normal(_c) => normalized.push(component),
                Component::CurDir => {}
                Component::ParentDir => {
                    if !normalized.pop() {
                        return Err(AppError::Internal(format!(
                            "Path traversal attempt detected: {:?}",
                            path
                        )));
                    }
                }
                Component::RootDir => {
                    normalized.push(component);
                }
                Component::Prefix(_p) => {
                    normalized.push(component);
                }
            }
        }

        // 3. Ensure the normalized path still starts with the root
        // (This handles cases where the path starts with enough '..' to escape)
        if !normalized.starts_with(&self.root) {
            return Err(AppError::Internal(format!(
                "Resolved path {:?} is outside of root {:?}",
                normalized, self.root
            )));
        }

        Ok(normalized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_resolve_simple() {
        let root = PathBuf::from("/media");
        let safe = SafePath::new(&root);
        let result = safe.resolve("test.txt").unwrap();
        assert_eq!(result, PathBuf::from("/media/test.txt"));
    }

    #[test]
    fn test_prevent_traversal() {
        let root = PathBuf::from("/media");
        let safe = SafePath::new(&root);
        let result = safe.resolve("../outside.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_prevent_deep_traversal() {
        let root = PathBuf::from("/media/app");
        let safe = SafePath::new(&root);
        let result = safe.resolve("subdir/../../outside.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_allow_subdir() {
        let root = PathBuf::from("/media");
        let safe = SafePath::new(&root);
        let result = safe.resolve("videos/church.mp4").unwrap();
        assert_eq!(result, PathBuf::from("/media/videos/church.mp4"));
    }

    #[test]
    fn test_prevent_absolute_outside_root() {
        let root = PathBuf::from("/media");
        let safe = SafePath::new(&root);
        // Note: On windows this might behave differently if prefix differs
        let result = safe.resolve("/etc/passwd");
        assert!(result.is_err());
    }
}
