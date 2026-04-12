use crate::db::models::RemoteDevice;
use crate::error::AppError;
use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Hash a 32-byte device token with SHA-256. Never store plaintext tokens.
pub fn hash_token(token: &[u8]) -> Vec<u8> {
    let mut h = Sha256::new();
    h.update(token);
    h.finalize().to_vec()
}

/// Insert a new device and return its UUID.
pub fn insert_device(conn: &Connection, name: &str, token: &[u8]) -> Result<String, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let token_hash = hash_token(token);
    let created_at = now_ms();
    conn.execute(
        "INSERT INTO remote_devices (id, name, token_hash, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, name, token_hash, created_at],
    )?;
    Ok(id)
}

/// List all non-revoked devices.
pub fn list_devices(conn: &Connection) -> Result<Vec<RemoteDevice>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, created_at, last_seen_at, revoked_at
         FROM remote_devices WHERE revoked_at IS NULL
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(RemoteDevice {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
            last_seen_at: row.get(3)?,
            revoked_at: row.get(4)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

/// Soft-delete a device by setting `revoked_at`.
pub fn revoke_device(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE remote_devices SET revoked_at = ?1 WHERE id = ?2",
        rusqlite::params![now_ms(), id],
    )?;
    Ok(())
}

/// Look up a device (including revoked) by token hash.
pub fn find_by_token_hash(
    conn: &Connection,
    token: &[u8],
) -> Result<Option<RemoteDevice>, AppError> {
    let token_hash = hash_token(token);
    let result = conn
        .query_row(
            "SELECT id, name, created_at, last_seen_at, revoked_at
             FROM remote_devices WHERE token_hash = ?1 LIMIT 1",
            rusqlite::params![token_hash],
            |row| {
                Ok(RemoteDevice {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    last_seen_at: row.get(3)?,
                    revoked_at: row.get(4)?,
                })
            },
        )
        .optional()?;
    Ok(result)
}

/// Update `last_seen_at` for a device.
pub fn touch_last_seen(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE remote_devices SET last_seen_at = ?1 WHERE id = ?2",
        rusqlite::params![now_ms(), id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        crate::db::migrations::run_migrations(&c).unwrap();
        c
    }

    #[test]
    fn insert_and_list_roundtrip() {
        let c = seeded();
        let id = insert_device(&c, "Pedro's iPhone", &[0u8; 32]).unwrap();
        let list = list_devices(&c).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, id);
    }

    #[test]
    fn revoke_hides_from_active_list() {
        let c = seeded();
        let id = insert_device(&c, "A", &[1u8; 32]).unwrap();
        revoke_device(&c, &id).unwrap();
        assert!(list_devices(&c).unwrap().is_empty());
    }

    #[test]
    fn lookup_by_token_hash_returns_revoked_state() {
        let c = seeded();
        let id = insert_device(&c, "A", &[2u8; 32]).unwrap();
        let d = find_by_token_hash(&c, &[2u8; 32]).unwrap().unwrap();
        assert_eq!(d.id, id);
        assert!(d.revoked_at.is_none());
    }
}
