use crate::content_sync::importer::{lyrics_to_sync_json, lyrics_to_text};
use crate::db::models::ContentSyncRemoteEntityInput;
use crate::error::AppError;
use crate::ftp_sync::{client as ftp_client, credentials::FtpSettings};
use crate::legacy_fetch::{ApiAlbum, ApiLyric, ApiMusic};
use crate::migration::{open_readonly_source, preflight_source_path};
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::Path;

const HYMNAL_CATEGORY_SLUGS: &[&str] = &["hymnal", "hymnal_1996"];

#[derive(Debug, Clone)]
pub struct SnapshotMusicRecord {
    pub remote: ContentSyncRemoteEntityInput,
    pub music: ApiMusic,
    pub album_name: Option<String>,
    pub category: Option<String>,
    pub audio_remote_path: Option<String>,
    pub playback_remote_path: Option<String>,
    pub cover_remote_path: Option<String>,
}

impl SnapshotMusicRecord {
    pub fn local_audio_path(&self) -> Option<String> {
        self.audio_remote_path
            .as_deref()
            .map(|path| crate::content_sync::derive_local_media_path(path, "audio", self.music.id_music))
    }

    pub fn local_playback_path(&self) -> Option<String> {
        self.playback_remote_path.as_deref().map(|path| {
            crate::content_sync::derive_local_media_path(path, "playback", self.music.id_music)
        })
    }

    pub fn local_cover_path(&self) -> Option<String> {
        self.cover_remote_path
            .as_deref()
            .map(|path| crate::content_sync::derive_local_media_path(path, "images", self.music.id_music))
    }
}

#[derive(Debug, Clone)]
pub struct SnapshotAlbumRecord {
    pub remote: ContentSyncRemoteEntityInput,
    pub album: ApiAlbum,
    pub cover_remote_path: Option<String>,
    pub musics: Vec<SnapshotMusicRecord>,
}

impl SnapshotAlbumRecord {
    pub fn local_cover_path(&self) -> Option<String> {
        self.cover_remote_path.as_deref().map(|path| {
            crate::content_sync::derive_local_media_path(path, "album_covers", self.album.id_album)
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct SnapshotManifest {
    pub hymns: Vec<SnapshotMusicRecord>,
    pub albums: Vec<SnapshotAlbumRecord>,
}

impl SnapshotManifest {
    pub fn has_content(&self) -> bool {
        !self.hymns.is_empty() || !self.albums.is_empty()
    }

    pub fn hymn_inputs(&self) -> Vec<ContentSyncRemoteEntityInput> {
        self.hymns.iter().map(|record| record.remote.clone()).collect()
    }

    pub fn album_inputs(&self) -> Vec<ContentSyncRemoteEntityInput> {
        self.albums
            .iter()
            .map(|record| record.remote.clone())
            .collect()
    }

    pub fn hymn_by_id(&self, remote_id: i64) -> Option<&SnapshotMusicRecord> {
        self.hymns.iter().find(|record| record.music.id_music == remote_id)
    }

    pub fn album_by_id(&self, remote_id: i64) -> Option<&SnapshotAlbumRecord> {
        self.albums
            .iter()
            .find(|record| record.album.id_album == remote_id)
    }
}

#[derive(Debug, Clone)]
struct LegacyFile {
    remote_path: Option<String>,
    version: Option<String>,
}

#[derive(Debug, Clone)]
struct LegacyMusicRow {
    id_music: i64,
    name: String,
    id_file_image: Option<i64>,
    id_file_music: Option<i64>,
    id_file_instrumental_music: Option<i64>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Clone)]
struct LegacyAlbumRow {
    id_album: i64,
    name: String,
    color: String,
    id_file_image: Option<i64>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Clone)]
struct LegacyAlbumMusicRow {
    id_album: i64,
    id_music: i64,
    track: i64,
}

#[derive(Debug, Clone)]
struct LegacyHymnalMembership {
    album_name: String,
    track: i64,
}

pub fn load_remote_snapshot_manifest(
    ftp_settings: &FtpSettings,
    remote_snapshot_path: &str,
    lang: &str,
) -> Result<SnapshotManifest, AppError> {
    let temp_dir = tempfile::tempdir().map_err(AppError::Io)?;
    let local_path = temp_dir.path().join("database.db");
    ftp_client::sync_file(ftp_settings, remote_snapshot_path, &local_path)?;
    parse_snapshot_manifest_from_path(&local_path, lang)
}

pub fn parse_snapshot_manifest_from_path(
    path: &Path,
    lang: &str,
) -> Result<SnapshotManifest, AppError> {
    let source_path = path.to_string_lossy().to_string();
    preflight_source_path(&source_path)?;
    let conn = open_readonly_source(&source_path)?;
    parse_snapshot_manifest(&conn, lang)
}

pub fn parse_snapshot_manifest(
    source: &Connection,
    lang: &str,
) -> Result<SnapshotManifest, AppError> {
    let files = load_files(source)?;
    let lyrics = load_lyrics(source)?;
    let music_rows = load_music_rows(source, lang)?;
    let album_rows = load_album_rows(source, lang)?;
    let album_categories = load_album_categories(source)?;
    let album_musics = load_album_musics(source, lang)?;

    let mut hymnal_membership_by_music = HashMap::<i64, LegacyHymnalMembership>::new();
    let mut album_song_rows = HashMap::<i64, Vec<LegacyAlbumMusicRow>>::new();

    for row in album_musics {
        let is_hymnal = album_categories
            .get(&row.id_album)
            .is_some_and(|slugs| slugs.iter().any(|slug| is_hymnal_slug(slug)));

        if is_hymnal {
            if let Some(album) = album_rows.get(&row.id_album) {
                hymnal_membership_by_music
                    .entry(row.id_music)
                    .or_insert_with(|| LegacyHymnalMembership {
                        album_name: album.name.clone(),
                        track: row.track,
                    });
            }
            continue;
        }

        album_song_rows
            .entry(row.id_album)
            .or_default()
            .push(row);
    }

    let mut hymn_ids = hymnal_membership_by_music.keys().copied().collect::<Vec<_>>();
    hymn_ids.sort_unstable();

    let mut hymns = Vec::with_capacity(hymn_ids.len());
    for music_id in hymn_ids {
        let Some(music) = music_rows.get(&music_id) else {
            continue;
        };
        let Some(membership) = hymnal_membership_by_music.get(&music_id) else {
            continue;
        };
        hymns.push(build_music_record(
            music,
            membership.track,
            Some(membership.album_name.clone()),
            Some("hymnal".to_string()),
            &lyrics,
            &files,
        ));
    }

    let mut album_ids = album_rows.keys().copied().collect::<Vec<_>>();
    album_ids.sort_unstable();

    let mut albums = Vec::new();
    for album_id in album_ids {
        let Some(album) = album_rows.get(&album_id) else {
            continue;
        };

        if album_categories
            .get(&album_id)
            .is_some_and(|slugs| slugs.iter().any(|slug| is_hymnal_slug(slug)))
        {
            continue;
        }

        let mut music_refs = album_song_rows.remove(&album_id).unwrap_or_default();
        music_refs.sort_by_key(|row| (row.track, row.id_music));

        let musics = music_refs
            .iter()
            .filter_map(|row| music_rows.get(&row.id_music).map(|music| (row, music)))
            .map(|(row, music)| {
                build_music_record(
                    music,
                    row.track,
                    Some(album.name.clone()),
                    Some("album".to_string()),
                    &lyrics,
                    &files,
                )
            })
            .collect::<Vec<_>>();

        albums.push(build_album_record(
            album,
            musics,
            &files,
            album_categories.get(&album_id),
        ));
    }

    Ok(SnapshotManifest { hymns, albums })
}

pub fn legacy_file_to_ftp_remote_path(dir: &str, name: &str) -> Option<String> {
    let normalized_dir = dir.trim().trim_start_matches('/').replace('\\', "/");
    let normalized_name = name.trim().trim_start_matches('/').replace('\\', "/");

    if normalized_dir.is_empty() || normalized_name.is_empty() {
        return None;
    }

    if let Some(rest) = normalized_dir.strip_prefix("musics/pt/") {
        return Some(format!("config/musicas/{}/{}", rest, normalized_name));
    }

    if let Some(rest) = normalized_dir.strip_prefix("musics/en/") {
        return Some(format!("EN/config/musicas/{}/{}", rest, normalized_name));
    }

    if let Some(rest) = normalized_dir.strip_prefix("musics/es/") {
        return Some(format!("ES/config/musicas/{}/{}", rest, normalized_name));
    }

    if normalized_dir == "images" {
        return Some(format!("config/imagens/{}", normalized_name));
    }

    if normalized_dir == "covers" {
        return Some(format!("config/imagens/covers/{}", normalized_name));
    }

    None
}

fn load_files(source: &Connection) -> Result<HashMap<i64, LegacyFile>, AppError> {
    let mut stmt = source.prepare("SELECT id_file, dir, name FROM files ORDER BY id_file ASC")?;
    let rows = stmt.query_map([], |row| {
        let id = row.get::<_, i64>(0)?;
        let dir = row.get::<_, String>(1)?;
        let name = row.get::<_, String>(2)?;
        Ok((
            id,
            LegacyFile {
                remote_path: legacy_file_to_ftp_remote_path(&dir, &name),
                version: Some(format!("{id}:{dir}/{name}")),
            },
        ))
    })?;

    rows.collect::<Result<HashMap<_, _>, _>>()
        .map_err(AppError::Database)
}

fn load_lyrics(source: &Connection) -> Result<HashMap<i64, Vec<ApiLyric>>, AppError> {
    let mut stmt = source.prepare(
        r#"
        SELECT id_lyric, id_music, lyric, "order", time, instrumental_time, show_slide
        FROM lyrics
        ORDER BY id_music ASC, "order" ASC, id_lyric ASC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(ApiLyric {
            id_lyric: row.get(0)?,
            id_music: row.get(1)?,
            lyric: row.get(2)?,
            order: row.get(3)?,
            time: row.get(4)?,
            instrumental_time: row.get(5)?,
            show_slide: row.get(6)?,
        })
    })?;

    let mut grouped = HashMap::<i64, Vec<ApiLyric>>::new();
    for row in rows {
        let lyric = row?;
        grouped.entry(lyric.id_music).or_default().push(lyric);
    }

    Ok(grouped)
}

fn load_music_rows(
    source: &Connection,
    lang: &str,
) -> Result<HashMap<i64, LegacyMusicRow>, AppError> {
    let mut stmt = source.prepare(
        r#"
        SELECT id_music, name, id_file_image, id_file_music, id_file_instrumental_music, created_at, updated_at
        FROM musics
        WHERE id_language = ?1
        ORDER BY id_music ASC
        "#,
    )?;

    let rows = stmt.query_map([lang], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            LegacyMusicRow {
                id_music: row.get(0)?,
                name: row.get(1)?,
                id_file_image: row.get(2)?,
                id_file_music: row.get(3)?,
                id_file_instrumental_music: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            },
        ))
    })?;

    rows.collect::<Result<HashMap<_, _>, _>>()
        .map_err(AppError::Database)
}

fn load_album_rows(
    source: &Connection,
    lang: &str,
) -> Result<HashMap<i64, LegacyAlbumRow>, AppError> {
    let mut stmt = source.prepare(
        r#"
        SELECT id_album, name, color, id_file_image, created_at, updated_at
        FROM albums
        WHERE id_language = ?1
        ORDER BY id_album ASC
        "#,
    )?;

    let rows = stmt.query_map([lang], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            LegacyAlbumRow {
                id_album: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                id_file_image: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            },
        ))
    })?;

    rows.collect::<Result<HashMap<_, _>, _>>()
        .map_err(AppError::Database)
}

fn load_album_categories(source: &Connection) -> Result<HashMap<i64, Vec<String>>, AppError> {
    let mut stmt = source.prepare(
        r#"
        SELECT ca.id_album, c.slug
        FROM categories_albums ca
        INNER JOIN categories c ON c.id_category = ca.id_category
        ORDER BY ca.id_album ASC, c.slug ASC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut categories = HashMap::<i64, Vec<String>>::new();
    for row in rows {
        let (album_id, slug) = row?;
        categories.entry(album_id).or_default().push(slug);
    }

    Ok(categories)
}

fn load_album_musics(
    source: &Connection,
    lang: &str,
) -> Result<Vec<LegacyAlbumMusicRow>, AppError> {
    let mut stmt = source.prepare(
        r#"
        SELECT id_album, id_music, track
        FROM albums_musics
        WHERE id_language = ?1
        ORDER BY id_album ASC, track ASC, id_music ASC
        "#,
    )?;

    let rows = stmt.query_map([lang], |row| {
        Ok(LegacyAlbumMusicRow {
            id_album: row.get(0)?,
            id_music: row.get(1)?,
            track: row.get(2)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)
}

fn build_music_record(
    music: &LegacyMusicRow,
    track: i64,
    album_name: Option<String>,
    category: Option<String>,
    lyrics_by_music: &HashMap<i64, Vec<ApiLyric>>,
    files: &HashMap<i64, LegacyFile>,
) -> SnapshotMusicRecord {
    let lyrics = lyrics_by_music
        .get(&music.id_music)
        .cloned()
        .unwrap_or_default();
    let audio_remote_path = music
        .id_file_music
        .and_then(|id| files.get(&id))
        .and_then(|file| file.remote_path.clone());
    let playback_remote_path = music
        .id_file_instrumental_music
        .and_then(|id| files.get(&id))
        .and_then(|file| file.remote_path.clone());
    let cover_remote_path = music
        .id_file_image
        .and_then(|id| files.get(&id))
        .and_then(|file| file.remote_path.clone());

    let api_music = ApiMusic {
        id_music: music.id_music,
        name: music.name.clone(),
        track: Some(track),
        id_file_image: music.id_file_image,
        id_file_music: music.id_file_music,
        id_file_instrumental_music: music.id_file_instrumental_music,
        url_image: None,
        url_music: None,
        url_instrumental_music: None,
        id_language: None,
        lyrics: lyrics.clone(),
    };

    let lyrics_text = lyrics_to_text(&lyrics);
    let lyrics_sync = lyrics_to_sync_json(&lyrics);
    let content_hash = hash_parts(&[
        &api_music.id_music.to_string(),
        &api_music.name,
        &track.to_string(),
        album_name.as_deref().unwrap_or_default(),
        &lyrics_text,
        lyrics_sync.as_deref().unwrap_or_default(),
        music.id_file_image.map(|v| v.to_string()).as_deref().unwrap_or_default(),
        music.id_file_music.map(|v| v.to_string()).as_deref().unwrap_or_default(),
        music
            .id_file_instrumental_music
            .map(|v| v.to_string())
            .as_deref()
            .unwrap_or_default(),
    ]);
    let lyrics_hash = hash_parts(&[
        &api_music.id_music.to_string(),
        &lyrics_text,
        lyrics_sync.as_deref().unwrap_or_default(),
    ]);

    SnapshotMusicRecord {
        remote: ContentSyncRemoteEntityInput {
            entity_type: "hymn".to_string(),
            remote_id: api_music.id_music,
            local_id: None,
            remote_version: api_music.track,
            content_hash: Some(content_hash),
            lyrics_hash: Some(lyrics_hash),
            image_version: file_version(music.id_file_image, files),
            audio_version: file_version(music.id_file_music, files),
            playback_version: file_version(music.id_file_instrumental_music, files),
            updated_at: music
                .updated_at
                .clone()
                .or_else(|| music.created_at.clone()),
            deleted: false,
            label: Some(api_music.name.clone()),
        },
        music: api_music,
        album_name,
        category,
        audio_remote_path,
        playback_remote_path,
        cover_remote_path,
    }
}

fn build_album_record(
    album: &LegacyAlbumRow,
    musics: Vec<SnapshotMusicRecord>,
    files: &HashMap<i64, LegacyFile>,
    categories: Option<&Vec<String>>,
) -> SnapshotAlbumRecord {
    let cover_remote_path = album
        .id_file_image
        .and_then(|id| files.get(&id))
        .and_then(|file| file.remote_path.clone());
    let category_list = categories.cloned().unwrap_or_default();
    let content_hash = hash_parts(&[
        &album.id_album.to_string(),
        &album.name,
        &album.color,
        &category_list.join(","),
        &musics
            .iter()
            .map(|music| {
                format!(
                    "{}:{}",
                    music.music.id_music,
                    music.music.track.unwrap_or_default()
                )
            })
            .collect::<Vec<_>>()
            .join("|"),
    ]);

    let api_album = ApiAlbum {
        id_album: album.id_album,
        name: album.name.clone(),
        color: Some(album.color.clone()),
        id_file_image: album.id_file_image,
        url_image: None,
        subtitle: if category_list.is_empty() {
            None
        } else {
            Some(category_list.join(", "))
        },
        order: Some(i64::try_from(musics.len()).unwrap_or_default()),
        image_version: file_version(album.id_file_image, files),
        musics: musics.iter().map(|music| music.music.clone()).collect(),
    };

    SnapshotAlbumRecord {
        remote: ContentSyncRemoteEntityInput {
            entity_type: "album".to_string(),
            remote_id: api_album.id_album,
            local_id: None,
            remote_version: api_album.order,
            content_hash: Some(content_hash),
            lyrics_hash: None,
            image_version: file_version(album.id_file_image, files),
            audio_version: None,
            playback_version: None,
            updated_at: album
                .updated_at
                .clone()
                .or_else(|| album.created_at.clone()),
            deleted: false,
            label: Some(api_album.name.clone()),
        },
        album: api_album,
        cover_remote_path,
        musics,
    }
}

fn hash_parts(parts: &[&str]) -> String {
    let mut hasher = blake3::Hasher::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update(&[0]);
    }
    hasher.finalize().to_hex().to_string()
}

fn file_version(file_id: Option<i64>, files: &HashMap<i64, LegacyFile>) -> Option<String> {
    file_id
        .and_then(|id| files.get(&id))
        .and_then(|file| file.version.clone())
}

fn is_hymnal_slug(slug: &str) -> bool {
    HYMNAL_CATEGORY_SLUGS.iter().any(|candidate| candidate == &slug)
}

#[cfg(test)]
mod tests {
    use super::{legacy_file_to_ftp_remote_path, parse_snapshot_manifest_from_path};
    use crate::content_sync::importer::import_music_to_db;
    use crate::db::queries::music::get_sync_points;
    use crate::legacy_fetch::{ApiLyric, ApiMusic};
    use rusqlite::{params, Connection};
    use tempfile::TempDir;

    fn create_legacy_snapshot_fixture() -> (TempDir, std::path::PathBuf) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let db_path = temp_dir.path().join("legacy.db");
        let conn = Connection::open(&db_path).expect("legacy db");
        conn.execute_batch(
            r#"
            CREATE TABLE files (
                id_file INTEGER PRIMARY KEY,
                dir TEXT NOT NULL,
                name TEXT NOT NULL
            );
            CREATE TABLE musics (
                id_music INTEGER PRIMARY KEY,
                name TEXT,
                id_file_image INTEGER,
                id_file_music INTEGER,
                id_file_instrumental_music INTEGER,
                id_language TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE lyrics (
                id_lyric INTEGER PRIMARY KEY,
                id_music INTEGER NOT NULL,
                lyric TEXT NOT NULL,
                "order" INTEGER NOT NULL,
                time TEXT,
                instrumental_time TEXT,
                show_slide INTEGER
            );
            CREATE TABLE albums (
                id_album INTEGER PRIMARY KEY,
                name TEXT,
                id_file_image INTEGER,
                color TEXT NOT NULL,
                id_language TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE albums_musics (
                id_album_music INTEGER PRIMARY KEY,
                id_album INTEGER NOT NULL,
                id_music INTEGER NOT NULL,
                track INTEGER NOT NULL,
                id_language TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE categories (
                id_category INTEGER PRIMARY KEY,
                slug TEXT NOT NULL,
                name TEXT NOT NULL
            );
            CREATE TABLE categories_albums (
                id_category_album INTEGER PRIMARY KEY,
                id_album INTEGER NOT NULL,
                id_category INTEGER NOT NULL
            );
            "#,
        )
        .expect("legacy schema");

        conn.execute(
            "INSERT INTO files (id_file, dir, name) VALUES (?1, ?2, ?3)",
            params![1_i64, "/covers", "album-1999.bmp"],
        )
        .expect("album cover");
        conn.execute(
            "INSERT INTO files (id_file, dir, name) VALUES (?1, ?2, ?3)",
            params![2_i64, "/images", "music-cover.jpg"],
        )
        .expect("music cover");
        conn.execute(
            "INSERT INTO files (id_file, dir, name) VALUES (?1, ?2, ?3)",
            params![3_i64, "/musics/pt/1999 - Test Collection", "Song One.mp3"],
        )
        .expect("music file");
        conn.execute(
            "INSERT INTO files (id_file, dir, name) VALUES (?1, ?2, ?3)",
            params![
                4_i64,
                "/musics/pt/1999 - Test Collection",
                "Song One - PB.mp3"
            ],
        )
        .expect("playback file");
        conn.execute(
            "INSERT INTO files (id_file, dir, name) VALUES (?1, ?2, ?3)",
            params![5_i64, "/musics/pt/Hymnal", "Hymn One.mp3"],
        )
        .expect("hymn music");

        conn.execute(
            "INSERT INTO categories (id_category, slug, name) VALUES (1, 'hymnal', 'Hymnal')",
            [],
        )
        .expect("category hymnal");
        conn.execute(
            "INSERT INTO categories (id_category, slug, name) VALUES (2, 'aym', 'Collection')",
            [],
        )
        .expect("category album");

        conn.execute(
            "INSERT INTO albums (id_album, name, id_file_image, color, id_language, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'pt', '2026-03-18T00:00:00Z', '2026-03-18T01:00:00Z')",
            params![10_i64, "Hinário Adventista", 1_i64, "#112233"],
        )
        .expect("album hymnal");
        conn.execute(
            "INSERT INTO albums (id_album, name, id_file_image, color, id_language, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'pt', '2026-03-18T00:00:00Z', '2026-03-18T01:00:00Z')",
            params![11_i64, "Test Collection", 1_i64, "#445566"],
        )
        .expect("album collection");
        conn.execute(
            "INSERT INTO categories_albums (id_category_album, id_album, id_category) VALUES (1, 10, 1)",
            [],
        )
        .expect("hymnal category");
        conn.execute(
            "INSERT INTO categories_albums (id_category_album, id_album, id_category) VALUES (2, 11, 2)",
            [],
        )
        .expect("album category");

        conn.execute(
            "INSERT INTO musics (id_music, name, id_file_image, id_file_music, id_file_instrumental_music, id_language, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'pt', '2026-03-18T00:00:00Z', '2026-03-18T01:00:00Z')",
            params![101_i64, "Hymn One", 2_i64, 5_i64, Option::<i64>::None],
        )
        .expect("music hymn");
        conn.execute(
            "INSERT INTO musics (id_music, name, id_file_image, id_file_music, id_file_instrumental_music, id_language, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'pt', '2026-03-18T00:00:00Z', '2026-03-18T01:00:00Z')",
            params![202_i64, "Song One", 2_i64, 3_i64, 4_i64],
        )
        .expect("music collection");

        conn.execute(
            "INSERT INTO lyrics (id_lyric, id_music, lyric, \"order\", time, instrumental_time, show_slide)
             VALUES (1, 101, 'Verse one', 1, '00:00:03', '00:00:05', 1)",
            [],
        )
        .expect("lyric 1");
        conn.execute(
            "INSERT INTO lyrics (id_lyric, id_music, lyric, \"order\", time, instrumental_time, show_slide)
             VALUES (2, 101, 'Verse two', 2, '00:00:06', '00:00:08', 2)",
            [],
        )
        .expect("lyric 2");
        conn.execute(
            "INSERT INTO lyrics (id_lyric, id_music, lyric, \"order\", time, instrumental_time, show_slide)
             VALUES (3, 202, 'Song verse', 1, '00:00:04', '00:00:07', 1)",
            [],
        )
        .expect("album lyric");

        conn.execute(
            "INSERT INTO albums_musics (id_album_music, id_album, id_music, track, id_language, created_at, updated_at)
             VALUES (1, 10, 101, 7, 'pt', '2026-03-18T00:00:00Z', '2026-03-18T01:00:00Z')",
            [],
        )
        .expect("hymnal mapping");
        conn.execute(
            "INSERT INTO albums_musics (id_album_music, id_album, id_music, track, id_language, created_at, updated_at)
             VALUES (2, 11, 202, 1, 'pt', '2026-03-18T00:00:00Z', '2026-03-18T01:00:00Z')",
            [],
        )
        .expect("album mapping");

        let quick_check: String = conn
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .expect("quick check");
        assert_eq!(quick_check, "ok");

        (temp_dir, db_path)
    }

    fn setup_target_db() -> Connection {
        let conn = Connection::open_in_memory().expect("target db");
        conn.execute_batch(
            r#"
            CREATE TABLE hymns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                number INTEGER,
                title TEXT NOT NULL,
                author TEXT,
                album TEXT,
                lyrics TEXT,
                chords TEXT,
                audio_path TEXT,
                playback_path TEXT,
                category TEXT,
                notes TEXT,
                cover_path TEXT,
                lyrics_sync TEXT,
                api_music_id INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE audio_sync_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hymn_id INTEGER NOT NULL,
                slide_index INTEGER NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                instrumental_timestamp_ms INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            "#,
        )
        .expect("target schema");
        conn
    }

    #[test]
    fn legacy_file_paths_map_to_current_ftp_structure() {
        assert_eq!(
            legacy_file_to_ftp_remote_path("/musics/pt/Collection", "Song.mp3").as_deref(),
            Some("config/musicas/Collection/Song.mp3")
        );
        assert_eq!(
            legacy_file_to_ftp_remote_path("/covers", "1999.bmp").as_deref(),
            Some("config/imagens/covers/1999.bmp")
        );
        assert_eq!(
            legacy_file_to_ftp_remote_path("/images", "cover.jpg").as_deref(),
            Some("config/imagens/cover.jpg")
        );
    }

    #[test]
    fn snapshot_parser_builds_hymns_and_collections_with_legacy_timing() {
        let (_temp_dir, db_path) = create_legacy_snapshot_fixture();
        let manifest = parse_snapshot_manifest_from_path(&db_path, "pt").expect("snapshot manifest");

        assert!(manifest.has_content());
        assert_eq!(manifest.hymns.len(), 1);
        assert_eq!(manifest.albums.len(), 1);

        let hymn = &manifest.hymns[0];
        assert_eq!(hymn.music.id_music, 101);
        assert_eq!(hymn.music.track, Some(7));
        assert_eq!(
            hymn.audio_remote_path.as_deref(),
            Some("config/musicas/Hymnal/Hymn One.mp3")
        );
        assert_eq!(
            hymn.cover_remote_path.as_deref(),
            Some("config/imagens/music-cover.jpg")
        );

        let sync_json =
            crate::content_sync::importer::lyrics_to_sync_json(&hymn.music.lyrics).expect("sync");
        assert!(sync_json.contains("\"time\":\"00:00:03\""));
        assert!(sync_json.contains("\"instrumentalTime\":\"00:00:05\""));

        let album = &manifest.albums[0];
        assert_eq!(album.album.name, "Test Collection");
        assert_eq!(
            album.cover_remote_path.as_deref(),
            Some("config/imagens/covers/album-1999.bmp")
        );
        assert_eq!(album.musics.len(), 1);
        assert_eq!(album.musics[0].music.id_music, 202);
        assert_eq!(album.musics[0].music.track, Some(1));
    }

    #[test]
    fn snapshot_reimport_keeps_local_audio_sync_overrides() {
        let conn = setup_target_db();
        let music = ApiMusic {
            id_music: 101,
            name: "Hymn One".to_string(),
            track: Some(7),
            id_file_image: None,
            id_file_music: None,
            id_file_instrumental_music: None,
            url_image: None,
            url_music: None,
            url_instrumental_music: None,
            id_language: None,
            lyrics: vec![
                ApiLyric {
                    id_lyric: 1,
                    id_music: 101,
                    lyric: "Verse one".to_string(),
                    order: 1,
                    time: Some("00:00:03".to_string()),
                    instrumental_time: Some("00:00:05".to_string()),
                    show_slide: Some(1),
                },
                ApiLyric {
                    id_lyric: 2,
                    id_music: 101,
                    lyric: "Verse two".to_string(),
                    order: 2,
                    time: Some("00:00:06".to_string()),
                    instrumental_time: Some("00:00:08".to_string()),
                    show_slide: Some(2),
                },
            ],
        };

        let (_, hymn_id) = import_music_to_db(
            &conn,
            &music,
            Some("media/audio/101/hymn-one.mp3"),
            Some("media/playback/101/hymn-one-pb.mp3"),
            Some("media/images/101/hymn-one.jpg"),
            false,
            Some("Hinário Adventista"),
            Some(101),
            Some("hymnal"),
        )
        .expect("initial import");
        let hymn_id = hymn_id.expect("hymn id");

        conn.execute(
            "INSERT INTO audio_sync_points (hymn_id, slide_index, timestamp_ms, instrumental_timestamp_ms)
             VALUES (?1, 0, 1234, 5678)",
            params![hymn_id],
        )
        .expect("override");

        let mut updated_music = music.clone();
        updated_music.lyrics[0].time = Some("00:00:04".to_string());
        updated_music.lyrics[0].instrumental_time = Some("00:00:06".to_string());

        let (_, updated_hymn_id) = import_music_to_db(
            &conn,
            &updated_music,
            Some("media/audio/101/hymn-one.mp3"),
            Some("media/playback/101/hymn-one-pb.mp3"),
            Some("media/images/101/hymn-one.jpg"),
            true,
            Some("Hinário Adventista"),
            Some(101),
            Some("hymnal"),
        )
        .expect("update import");
        assert_eq!(updated_hymn_id, Some(hymn_id));

        let points = get_sync_points(&conn, hymn_id).expect("sync points");
        assert!(
            points.iter().any(|point| point.timestamp_ms == 1234),
            "local override timestamp must survive snapshot reimport"
        );
        assert!(
            points
                .iter()
                .any(|point| point.instrumental_timestamp_ms == Some(5678)),
            "local override instrumental timestamp must survive snapshot reimport"
        );
    }

    #[test]
    fn empty_snapshot_fixture_produces_no_actions() {
        let (_temp_dir, db_path) = create_legacy_snapshot_fixture();
        let manifest = parse_snapshot_manifest_from_path(&db_path, "en").expect("snapshot manifest");
        assert!(!manifest.has_content());
        assert_eq!(manifest.hymns.len(), 0);
        assert_eq!(manifest.albums.len(), 0);
    }
}
