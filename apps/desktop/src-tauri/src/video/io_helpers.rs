use crate::error::AppError;
use std::io::{Read, Seek, SeekFrom};

pub fn read_u8<R: Read>(reader: &mut R) -> Result<u8, AppError> {
    let mut b = [0u8; 1];
    reader.read_exact(&mut b)?;
    Ok(b[0])
}

pub fn read_u32_be<R: Read>(reader: &mut R) -> Result<u32, AppError> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)?;
    Ok(u32::from_be_bytes(buf))
}

pub fn read_u64_be<R: Read>(reader: &mut R) -> Result<u64, AppError> {
    let mut buf = [0u8; 8];
    reader.read_exact(&mut buf)?;
    Ok(u64::from_be_bytes(buf))
}

pub fn skip_exact<R: Read + Seek>(reader: &mut R, bytes: u64) -> Result<(), AppError> {
    reader.seek(SeekFrom::Current(bytes as i64))?;
    Ok(())
}
