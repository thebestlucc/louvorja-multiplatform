use std::path::Path;
use std::fs::File;
use std::io::Read;
use suppaftp::{FtpStream, Mode};
use crate::error::AppError;
use crate::ftp_sync::credentials::FtpSettings;

/// Synchronize a single file from FTP server
/// Only downloads if the file is missing or size differs
pub fn sync_file(settings: &FtpSettings, remote_path: &str, local_path: &Path) -> Result<(), AppError> {
    let addr = format!("{}:{}", settings.host, settings.port);
    let mut ftp_stream = FtpStream::connect(addr)
        .map_err(|e| AppError::Internal(format!("FTP connection failed to {}: {}", settings.host, e)))?;

    ftp_stream.login(&settings.user, &settings.pass)
        .map_err(|e| AppError::Internal(format!("FTP login failed for {}: {}", settings.user, e)))?;

    ftp_stream.set_mode(Mode::Passive);
    
    // Change to root directory if specified
    if !settings.root.is_empty() {
        ftp_stream.cwd(&settings.root)
            .map_err(|e| AppError::Internal(format!("FTP cwd to {} failed: {}", settings.root, e)))?;
    }

    // Check if file exists and compare size
    let remote_size = ftp_stream.size(remote_path)
        .map_err(|e| AppError::Internal(format!("Failed to get remote file size for {}: {}", remote_path, e)))?;

    let should_download = if local_path.exists() {
        let local_metadata = std::fs::metadata(local_path)
            .map_err(|e| AppError::Io(e))?;
        local_metadata.len() != remote_size as u64
    } else {
        true
    };

    if should_download {
        // Ensure local directory exists
        if let Some(parent) = local_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
        }
        
        let mut reader = ftp_stream.retr_as_stream(remote_path)
            .map_err(|e| AppError::Internal(format!("FTP download initialization failed for {}: {}", remote_path, e)))?;
        
        let mut file = File::create(local_path).map_err(|e| AppError::Io(e))?;
        
        let mut buffer = [0; 8192];
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 { break; }
            std::io::Write::write_all(&mut file, &buffer[..n]).map_err(|e| AppError::Io(e))?;
        }
        
        // Finalize the retrieval
        ftp_stream.finalize_retr_stream(reader)
            .map_err(|e| AppError::Internal(format!("FTP finalize download failed for {}: {}", remote_path, e)))?;
    }
    
    ftp_stream.quit().map_err(|e| AppError::Internal(format!("FTP quit failed: {}", e)))?;
    Ok(())
}
