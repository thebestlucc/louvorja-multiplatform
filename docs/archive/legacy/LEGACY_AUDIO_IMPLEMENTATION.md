# Legacy Audio Path Resolution

## Overview

This document explains how the application resolves audio paths for hymns migrated from the legacy Delphi database, even when the physical audio files are missing from the modern media directory.

## Implementation

### Rust Side

#### 1. Database Migration (v14)

Added a new column to the `hymns` table to preserve legacy file references:

```rust
// In src-tauri/src/db/migrations.rs
fn migrate_v14(conn: &Connection) -> Result<(), AppError> {
    // Adds legacy_file_id column to hymns table
    add_column_if_missing(conn, "hymns", "legacy_file_id", "INTEGER")?;
    
    // Populates legacy_file_id by matching hymn titles to legacy musics records
    // This preserves references to the original files table entries
}
```

#### 2. Query Helper

Added a function to resolve audio paths with fallback logic:

```rust
// In src-tauri/src/db/queries/music.rs
pub fn resolve_hymn_audio_path(
    conn: &Connection, 
    hymn_id: i64
) -> Result<Option<String>, AppError> {
    // Priority 1: Modern audio_path (if set)
    // Priority 2: Legacy file reference (reconstructed from files table)
    // Returns: Some("/musics/pt/Hinário Adventista/001.mp3") or None
}
```

#### 3. Tauri Command

Exposed the query as a command:

```rust
// In src-tauri/src/commands/music.rs
#[tauri::command]
pub fn get_hymn_audio_path(
    hymn_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, AppError>
```

### Frontend Side

#### 1. TypeScript Wrapper

```typescript
// In src/lib/tauri.ts
export async function getHymnAudioPath(hymnId: number): Promise<string | null> {
  return tauriInvoke<string | null>("get_hymn_audio_path", { hymn_id: hymnId });
}
```

#### 2. React Query Hook

```typescript
// In src/lib/queries.ts
export function useHymnAudioPath(hymnId: number) {
  return useQuery({
    queryKey: queryKeys.hymns.audioPath(hymnId),
    queryFn: () => getHymnAudioPath(hymnId),
  });
}
```

## Usage in Components

### Basic Usage

```typescript
import { useHymnAudioPath } from "@/lib/queries";
import { convertFileSrc } from "@tauri-apps/api/core";

function HymnAudioPlayer({ hymnId }: { hymnId: number }) {
  const { data: audioPath, isLoading, error } = useHymnAudioPath(hymnId);

  if (isLoading) return <div>Loading audio...</div>;
  if (error) return <div>Error loading audio</div>;
  if (!audioPath) return <div>Audio not available</div>;

  // Convert legacy path to accessible URL
  const audioUrl = convertFileSrc(audioPath);

  return (
    <audio controls>
      <source src={audioUrl} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
}
```

### With Fallback Content

```typescript
function HymnWithAudio({ hymn }: { hymn: Hymn }) {
  const { data: audioPath } = useHymnAudioPath(hymn.id);

  return (
    <div>
      <h2>{hymn.title}</h2>
      
      {audioPath ? (
        <audio controls className="w-full mb-4">
          <source src={convertFileSrc(audioPath)} type="audio/mpeg" />
          Audio not supported
        </audio>
      ) : (
        <p className="text-amber-600">
          Audio not available for this hymn
        </p>
      )}
      
      <div className="lyrics">{hymn.lyrics}</div>
    </div>
  );
}
```

## Data Path Format

Legacy audio paths follow this structure:

```
/musics/{language}/{album_name}/{track_number}.mp3
```

Examples:
- `/musics/pt/Hinário Adventista/001.mp3`
- `/musics/pt/2026 - Meu Lugar no Mundo/003.mp3`
- `/musics/pt/Adoradores/005.mp3`

These paths reference entries in the legacy `files` table:
- `dir`: `/musics/pt/Hinário Adventista`
- `file_name`: `001.mp3`

## Migration Path

### Phase 1: Legacy Compatibility (Current)
- ✅ Hymns import with lyrics
- ✅ Audio paths preserved in `legacy_file_id`
- ✅ Paths reconstructed on demand
- ✅ No physical files needed

### Phase 2: Modern Media (Optional)
When users want to migrate physical files to the managed media directory:

1. Copy/move audio files to `media/hymns/{hymn_id}/audio.mp3`
2. Update `hymns.audio_path` to point to new location
3. Clear `legacy_file_id` (optional, for cleanup)

This allows gradual migration without losing access to audio metadata.

## Database Schema

### hymns table
```sql
CREATE TABLE hymns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  audio_path TEXT,              -- Modern path (optional)
  legacy_file_id INTEGER,       -- Foreign key to files table
  -- ... other fields
  FOREIGN KEY (legacy_file_id) REFERENCES files(id_file)
);
```

### files table (Legacy)
```sql
CREATE TABLE files (
  id_file INTEGER PRIMARY KEY,
  dir VARCHAR NOT NULL,         -- e.g., "/musics/pt/Hinário Adventista"
  file_name VARCHAR NOT NULL,   -- e.g., "001.mp3"
  type VARCHAR NOT NULL,        -- "music", "image_album", etc.
  size INTEGER NOT NULL,        -- File size in bytes
  -- ... other fields
);
```

## Query Flow

```
useHymnAudioPath(hymnId)
  ↓
getHymnAudioPath(hymnId) [Tauri command]
  ↓
resolve_hymn_audio_path(conn, hymn_id) [Rust query]
  ↓
SELECT audio_path FROM hymns WHERE id = ?
  ├─ IF SET AND NOT EMPTY → Return modern path
  └─ ELSE:
       SELECT dir || '/' || file_name
       FROM files
       WHERE id_file = (SELECT legacy_file_id FROM hymns WHERE id = ?)
       └─ Return legacy path
  ↓
Return Option<String> to component
  ↓
convertFileSrc() → accessible file URL (if needed)
```

## Error Handling

If a hymn has no audio available:

1. **Both paths NULL:** Returns `None`, component should show "Audio not available"
2. **File doesn't exist:** Component may still receive path; error occurs at playback
3. **Database error:** Caught and returned as `AppError`, handled by React Query

## Performance

- **Query keys:** `["hymns", hymnId, "audioPath"]` - cached per hymn
- **Cache invalidation:** Manual via `queryClient.invalidateQueries()`
- **No automatic refetch:** Static data (paths don't change during session)
- **Single query:** One SELECT statement, minimal DB impact

## Testing

To test legacy audio resolution:

1. **Create a test hymn** in the import migration
2. **Verify `legacy_file_id` is set** after v14 migration runs
3. **Call `resolve_hymn_audio_path`** directly or via command
4. **Log the returned path** and verify format

```rust
// In tests or CLI
let path = resolve_hymn_audio_path(&db, 1)?;
println!("Audio path: {:?}", path);
// Expected: Some("/musics/pt/Hinário Adventista/001.mp3")
```

## Future Enhancements

1. **Batch path resolution** - Load audio paths for multiple hymns at once
2. **Path existence check** - Verify files exist before returning paths
3. **File discovery** - Scan app data for missing audio files and re-link them
4. **Media migration tool** - Admin UI to copy legacy files to modern directory
5. **Path canonicalization** - Normalize paths across different OS formats

## See Also

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Full schema documentation
- [CLAUDE.md](../CLAUDE.md) - Project conventions and patterns
- `src-tauri/src/db/migrations.rs` - Migration v14 implementation
- `src-tauri/src/db/queries/music.rs` - Query helper implementation
