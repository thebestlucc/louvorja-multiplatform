# Database Schema Documentation

**Location:** `src-tauri/src/db/database.db` (SQLite)

Last Updated: 2026-02-21

## Overview

The LouvorJA multiplatform database contains **46 tables** organized in two layers:
1. **Modern Application Tables** (lowercase) - Core system tables with proper relationships
2. **Legacy/Delphi Tables** (UPPERCASE) - Compatibility views and tables from the original system

All tables support **multi-language content** via the `id_language` foreign key (currently: `en`, `pt`, `es`).

## Legacy Database Migration Strategy

When importing from a legacy LouvorJA database (Delphi-era):
- **Legacy hymn data** is merged into the modern `hymns` table
- **Audio/image file references** are preserved via `legacy_file_id` → `files` table
- This allows resolution of file paths like `/musics/pt/Hinário Adventista/001.mp3` even if the physical files are missing

**How to resolve audio paths:**
```rust
use db::queries::music::resolve_hymn_audio_path;

let path = resolve_hymn_audio_path(conn, hymn_id)?;
// Returns: Some("/musics/pt/Hinário Adventista/001.mp3") or None
```

---

## Core Application Tables

### Language System

#### `languages`
```sql
CREATE TABLE languages (
  id_language VARCHAR PRIMARY KEY NOT NULL,
  language VARCHAR,
  created_at DATETIME,
  updated_at DATETIME
);
```
**Purpose:** Language definitions for i18n support.
**Keys:** `pt`, `en`, `es`

---

### File Management

#### `files`
```sql
CREATE TABLE files (
  id_file INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  size INTEGER NOT NULL,
  dir VARCHAR NOT NULL,
  file_name VARCHAR NOT NULL,
  image_position INTEGER,
  duration TIME,
  version INTEGER NOT NULL,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE UNIQUE INDEX files_dir_file_name_unique ON files (dir, file_name);
```
**Purpose:** Metadata for all media files (images, audio, videos).
**Fields:**
- `type`: File type (image, audio, video, etc.)
- `size`: File size in bytes
- `dir`: Directory path relative to app data
- `file_name`: Filename
- `duration`: For audio/video files (TIME format: HH:MM:SS)
- `image_position`: Position index for carousel-like displays
- `version`: Schema version for migrations

**Referenced by:** `albums.id_file_image`, `musics`, `lyrics.id_file_image`

---

## Music System

### Albums

#### `albums`
```sql
CREATE TABLE albums (
  id_album INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name VARCHAR,
  id_file_image INTEGER,
  color VARCHAR NOT NULL,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_language) REFERENCES languages(id_language),
  FOREIGN KEY (id_file_image) REFERENCES files(id_file)
);
```
**Purpose:** Music album/collection containers (hymnal, doxology, children's songs, etc.).
**Fields:**
- `name`: Album title
- `color`: Display color (hex or CSS color name)
- `id_file_image`: Album cover image

**Related tables:**
- `albums_musics` - Links to musics
- `categories_albums` - Links to categories

---

#### `categories`
```sql
CREATE TABLE categories (
  id_category INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name VARCHAR,
  slug VARCHAR,
  order INTEGER NOT NULL,
  type VARCHAR,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_language) REFERENCES languages(id_language)
);

CREATE UNIQUE INDEX categories_slug_id_language_unique ON categories (slug, id_language);
```
**Purpose:** Album classifications (hymnal, doxology, misc, children, aym, etc.).
**Slugs:**
- `hymnal` - Adventist Hymnary (standard)
- `hymnal_1996` - 1996 edition
- `doxology` - Closing hymn/doxology
- `children` - Children's songs
- `aym` - Year-long hymn series
- `misc` - Miscellaneous

**Indexes:** `(slug, id_language)`

---

#### `categories_albums`
```sql
CREATE TABLE categories_albums (
  id_category_album INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  id_category INTEGER NOT NULL,
  id_album INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  order INTEGER NOT NULL,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_category) REFERENCES categories(id_category),
  FOREIGN KEY (id_album) REFERENCES albums(id_album),
  FOREIGN KEY (id_language) REFERENCES languages(id_language)
);

CREATE UNIQUE INDEX categories_albums_id_category_id_album_unique 
  ON categories_albums (id_category, id_album);
```
**Purpose:** Many-to-many relationship between categories and albums.
**Fields:**
- `name`: Subtitle/variant name for the album within category
- `order`: Display order

---

### Modern Hymns Table

#### `hymns`
```sql
CREATE TABLE hymns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER,
  title TEXT NOT NULL,
  author TEXT,
  album TEXT,
  lyrics TEXT,
  chords TEXT,
  audio_path TEXT,
  category TEXT,
  notes TEXT,
  legacy_file_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (legacy_file_id) REFERENCES files(id_file)
);
```
**Purpose:** Modern hymn records with full metadata and optional audio/imaging.

**Fields:**
- `number`: Track number (from legacy import or manual assignment)
- `title`: Hymn title
- `author`: Composer/author name
- `album`: Album/collection name
- `lyrics`: Full lyrics text (concatenated stanzas)
- `chords`: Optional chord progression (for musicians)
- `audio_path`: Direct path to audio file (modern media directory)
- `category`: Hymn category slug (hymnal, doxology, etc.)
- `notes`: Extra metadata/commentary
- `legacy_file_id`: **Foreign key to legacy `files` table** (populated during migration)

**Use Case for `legacy_file_id`:**
When importing from a legacy database without physical files, `legacy_file_id` preserves references to the legacy `files` table. Use the helper function:
```rust
resolve_hymn_audio_path(conn, hymn_id) -> Option<String>
```
This returns the reconstructed path (e.g., `/musics/pt/Hinário Adventista/001.mp3`) or `audio_path` if set.

**Full-Text Search:**
Updates automatically propagate to `hymns_fts` table for fast searching.

---

### Legacy Hymn/Songs Tables

#### `musics` (Legacy)
```sql
CREATE TABLE musics (
  id_music INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name VARCHAR,
  id_file_image INTEGER,
  id_file_music INTEGER,
  id_file_instrumental_music INTEGER,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_language) REFERENCES languages(id_language),
  FOREIGN KEY (id_file_image) REFERENCES files(id_file),
  FOREIGN KEY (id_file_music) REFERENCES files(id_file),
  FOREIGN KEY (id_file_instrumental_music) REFERENCES files(id_file)
);
```
**Note:** This is part of the legacy Delphi schema. Modern code uses the `hymns` table instead.

---

## Legacy Hymn System (Delphi-era)

The following tables and views are from the original Delphi system and are maintained for data migration purposes.

#### `musics` (Legacy Music Records)
```sql
CREATE TABLE musics (
  id_music INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name VARCHAR,
  id_file_image INTEGER,
  id_file_music INTEGER,
  id_file_instrumental_music INTEGER,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_language) REFERENCES languages(id_language),
  FOREIGN KEY (id_file_image) REFERENCES files(id_file),
  FOREIGN KEY (id_file_music) REFERENCES files(id_file),
  FOREIGN KEY (id_file_instrumental_music) REFERENCES files(id_file)
);
```
**Purpose:** Individual hymns/songs with audio and imagery.
**Fields:**
- `name`: Hymn title
- `id_file_image`: Associated artwork/thumbnail
- `id_file_music`: Vocal audio file
- `id_file_instrumental_music`: Instrumental/backing track

**Related tables:**
- `lyrics` - Song lyrics with timing
- `albums_musics` - Album membership
- `files` - Audio and image data

---

#### `lyrics`
```sql
CREATE TABLE lyrics (
  id_lyric INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  id_music INTEGER NOT NULL,
  lyric VARCHAR NOT NULL,
  aux_lyric VARCHAR,
  id_file_image INTEGER,
  time TIME NOT NULL,
  instrumental_time TIME NOT NULL,
  show_slide TINYINT(1) NOT NULL,
  order INTEGER NOT NULL,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_music) REFERENCES musics(id_music),
  FOREIGN KEY (id_language) REFERENCES languages(id_language),
  FOREIGN KEY (id_file_image) REFERENCES files(id_file)
);

CREATE UNIQUE INDEX lyrics_id_music_order_unique ON lyrics (id_music, order);
```
**Purpose:** Lyric stanzas with timing for synchronized audio display.
**Fields:**
- `lyric`: Primary verse text
- `aux_lyric`: Secondary text (e.g., alternate ending)
- `id_file_image`: Optional background image per stanza
- `time`: Start time in vocal audio (HH:MM:SS)
- `instrumental_time`: Start time in instrumental audio
- `show_slide`: Boolean to control projector display
- `order`: Stanza sequence (1-based)

**Indexes:** `(id_music, order)` - one order per hymn

---

#### `albums_musics`
```sql
CREATE TABLE albums_musics (
  id_album_music INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  id_album INTEGER NOT NULL,
  id_music INTEGER NOT NULL,
  track INTEGER NOT NULL,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_album) REFERENCES albums(id_album),
  FOREIGN KEY (id_music) REFERENCES musics(id_music),
  FOREIGN KEY (id_language) REFERENCES languages(id_language)
);

CREATE UNIQUE INDEX albums_musics_id_album_id_music_unique 
  ON albums_musics (id_album, id_music);
```
**Purpose:** Many-to-many relationship between albums and songs.
**Fields:**
- `track`: Track number within album (for ordering)

---

## Bible System

#### `bible_book`
```sql
CREATE TABLE bible_book (
  id_bible_book INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  book_number INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  chapters INTEGER NOT NULL,
  testament INTEGER NOT NULL,
  keywords VARCHAR,
  abbreviation VARCHAR NOT NULL,
  color VARCHAR NOT NULL,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_language) REFERENCES languages(id_language)
);

CREATE UNIQUE INDEX bible_book_book_number_id_language_unique 
  ON bible_book (book_number, id_language);
```
**Purpose:** Bible book metadata (Genesis, Exodus, etc.).
**Fields:**
- `book_number`: 1-66 standard ordering
- `chapters`: Total chapter count
- `testament`: 1 (OT) or 2 (NT)
- `abbreviation`: Short code (Gen, Exo, Mat, etc.)
- `color`: Display color for UI
- `keywords`: Searchable tags

---

#### `bible_version`
```sql
CREATE TABLE bible_version (
  id_bible_version INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name VARCHAR NOT NULL,
  abbreviation VARCHAR NOT NULL,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_language) REFERENCES languages(id_language)
);

CREATE UNIQUE INDEX bible_version_abbreviation_id_language_unique 
  ON bible_version (abbreviation, id_language);
```
**Purpose:** Bible translations (e.g., NTLH, ARC, KJV).
**Fields:**
- `name`: Full translation name
- `abbreviation`: Short code (NTLH, ARC, etc.)

---

#### `bible_verse`
```sql
CREATE TABLE bible_verse (
  id_bible_verse INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  id_bible_version INTEGER NOT NULL,
  id_bible_book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  id_language VARCHAR NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (id_bible_version) REFERENCES bible_version(id_bible_version),
  FOREIGN KEY (id_bible_book) REFERENCES bible_book(id_bible_book),
  FOREIGN KEY (id_language) REFERENCES languages(id_language)
);

CREATE UNIQUE INDEX bible_verse_id_bible_version_id_bible_book_chapter_verse_unique 
  ON bible_verse (id_bible_version, id_bible_book, chapter, verse);
```
**Purpose:** Individual Bible verses with full text.
**Fields:**
- `chapter`, `verse`: Standard Bible verse reference
- `text`: Escaped verse content (TEXT type supports long content)

**Index:** Ensures one verse per (translation, book, chapter:verse)

---

## Online Video System

#### `online_videos_channels`
```sql
CREATE TABLE online_videos_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_language VARCHAR NOT NULL DEFAULT 'und',
  channel_id VARCHAR NOT NULL UNIQUE,
  title VARCHAR,
  description TEXT,
  images TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'error')),
  playlists TEXT,
  error TEXT,
  base64 TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_language) REFERENCES languages(id_language)
);
```
**Purpose:** YouTube channel metadata and validation status.
**Fields:**
- `channel_id`: YouTube channel ID (unique)
- `id_language`: Language code (defaults to 'und')
- `images`: JSON object with image URLs (default, medium, high)
- `status`: pending (not validated), validated (working), error (fetch failed)
- `playlists`: JSON array of playlist IDs
- `error`: Last error message if status='error'
- `base64`: Cached base64-encoded thumbnail image

---

#### `online_videos_playlists`
```sql
CREATE TABLE online_videos_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_language VARCHAR NOT NULL DEFAULT 'und',
  id_channel INTEGER,
  playlist_id VARCHAR NOT NULL UNIQUE,
  title VARCHAR,
  description TEXT,
  images TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'error')),
  error TEXT,
  base64 TEXT,
  cover_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_language) REFERENCES languages(id_language),
  FOREIGN KEY (id_channel) REFERENCES online_videos_channels(id) ON DELETE CASCADE
);
```
**Purpose:** YouTube playlist metadata and validation.
**Fields:**
- `playlist_id`: YouTube playlist ID (unique)
- `id_channel`: FK to parent channel (nullable for standalone playlists)
- `images`: JSON object with image URLs
- `status`: pending, validated, or error
- `base64`: Cached base64-encoded thumbnail
- `cover_path`: Local path to downloaded cover image

**Cascade:** Deleting channel cascades to playlists

---

#### `online_videos`
```sql
CREATE TABLE online_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_language VARCHAR NOT NULL DEFAULT 'und',
  id_playlist INTEGER NOT NULL,
  video_id VARCHAR NOT NULL,
  sequence INTEGER DEFAULT 0,
  title VARCHAR,
  description TEXT,
  images TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'error')),
  error TEXT,
  local_path TEXT,
  duration_seconds INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_playlist, video_id),
  FOREIGN KEY (id_language) REFERENCES languages(id_language),
  FOREIGN KEY (id_playlist) REFERENCES online_videos_playlists(id) ON DELETE CASCADE
);
```
**Purpose:** Individual YouTube videos from playlists.
**Fields:**
- `video_id`: YouTube video ID
- `id_playlist`: FK to parent playlist
- `sequence`: Order in playlist (0-based)
- `images`: JSON object with image URLs
- `status`: pending, validated, or error
- `local_path`: Path to locally downloaded video file (via yt-dlp)
- `duration_seconds`: Video duration in seconds

**Cascade:** Deleting playlist cascades to videos

---

## Legacy/Delphi Compatibility Tables & Views

These tables and views maintain compatibility with the original Delphi system. They are built from the modern tables above.

### Legacy Views (Auto-Generated)

#### `ALBUM`
Filtered view of albums for Portuguese language with category-aware deactivation rules.

#### `ALBUM_TIPO`
Album categorization with type codes:
- `HASD` - Hymnal (Adventist)
- `HASD_1996` - Hymnal 1996 edition
- `DOX` - Doxology
- `INF` - Children (Infantil)
- `JA_ANO` - Year hymn series
- `DIV` - Miscellaneous

#### `MUSICAS`
Comprehensive view combining music data: title, album, artist, image, URL, instrumental URL, file sizes, and full lyrics.

#### `MUSICAS_LETRA`
Lyrics with display control and sequence order.

### Legacy Tables

#### `ALBUM_MUSICAS`
Simple mapping: `ID_ALBUM`, `ID_MUSICA`, `FAIXA`

#### `TIPOS_ALBUM`
Album type codes and descriptions.

#### `ARQUIVOS_ADICIONAIS`
External file references with URLs.

#### `IMAGEM_POSICAO`
Image position metadata for carousels.

### Other Legacy Tables
- `HINARIO_ADVENTISTA` - Adventist hymnal variants
- `HINARIO_ADVENTISTA_1996` - 1996 edition
- `MUSICAS_INFANTIS` - Children's songs
- `LISTA_COLETANEAS` - Playlist/collection lists
- `DOXOLOGIA_ALBUNS` - Doxology-specific albums
- `BIBLIA`, `LIVRO`, `VERSAO_BIBLICA` - Bible equivalents
- `ONL_CANAIS`, `ONL_PLAYLISTS`, `ONL_VIDEOS` - Web video aliases
- `_ALBUM_IGNORAR`, `_COLETANEAS_PERSONALIZADAS` - Special flags
- `VERSAO` - Schema version tracking

---

## Data Relationships

```
languages
├── albums (id_language)
├── categories (id_language)
├── musics (id_language)
├── lyrics (id_language)
├── albums_musics (id_language)
├── categories_albums (id_language)
├── bible_book (id_language)
├── bible_version (id_language)
├── bible_verse (id_language)
├── online_videos_channels (id_language)
├── online_videos_playlists (id_language)
└── online_videos (id_language)

files
├── albums.id_file_image
├── musics.id_file_image
├── musics.id_file_music
├── musics.id_file_instrumental_music
└── lyrics.id_file_image

albums
├── categories_albums.id_album
└── albums_musics.id_album

categories
└── categories_albums.id_category

musics
├── lyrics.id_music
└── albums_musics.id_music

bible_version
└── bible_verse.id_bible_version

bible_book
└── bible_verse.id_bible_book

online_videos_channels
└── online_videos_playlists.id_channel

online_videos_playlists
└── online_videos.id_playlist
```

---

## Key Patterns

### Multi-Language Support
Every modern table has `id_language` FK to `languages`. Queries typically filter by language:
```sql
SELECT * FROM hymns WHERE id_language = 'pt'
```

### Soft Deletes
No soft delete flags. Logical deletion via foreign key cascade (e.g., deleting a playlist cascades to videos).

### Audit Fields
All tables include `created_at` and `updated_at` timestamps.

### Unique Indexes
- Files: `(dir, file_name)` - prevents duplicate files
- Categories: `(slug, id_language)` - unique category per language
- Albums → Musics: `(id_album, id_music)` - no duplicates
- Categories → Albums: `(id_category, id_album)` - no duplicates
- Bible verses: `(id_bible_version, id_bible_book, chapter, verse)` - one verse per translation
- Videos: `(id_online_video_playlist, video_id)` - no duplicate videos
- Channels/Playlists: unique IDs per platform

### Status Enum Pattern
Online video tables use `status` CHECK constraint:
```sql
status VARCHAR CHECK (status IN ('pending', 'validated', 'error')) DEFAULT 'pending'
```

---

## Notes for Developers

1. **Always include `id_language` in queries** - Data is partitioned by language.
2. **Use Rust model types** in `src-tauri/src/db/models.rs` - Don't construct queries directly.
3. **Cascade deletes are configured** - Deleting a channel/playlist/video cascades appropriately.
4. **Legacy tables are views** - Updates should use modern tables; legacy views auto-update.
5. **Time fields use HH:MM:SS format** - Use `chrono::Duration` for conversions in Rust.
6. **Check audio/video paths** - File paths are relative (`dir` field); resolve via `convert_file_src()` for frontend.
