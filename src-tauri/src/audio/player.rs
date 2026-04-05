use crate::error::AppError;
use cpal::traits::{DeviceTrait, HostTrait};
use rodio::source::SineWave;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::{BufReader, Cursor};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

const LIVE_SWITCH_COMPENSATION_CAP_MS: u64 = 1_500;

fn resolve_play_start_ms(
    current_position_ms: u64,
    fallback_start_ms: Option<u64>,
    preserve_live_position: bool,
    had_existing_audio: bool,
    was_playing: bool,
    elapsed_ms: u64,
) -> Option<u64> {
    if !preserve_live_position || !had_existing_audio {
        return fallback_start_ms;
    }

    if was_playing {
        return Some(
            current_position_ms.saturating_add(elapsed_ms.min(LIVE_SWITCH_COMPENSATION_CAP_MS)),
        );
    }

    Some(current_position_ms)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AudioVariant {
    Sung,
    Karaoke,
}

fn resolve_single_volume(volume: f32, output_muted: bool) -> f32 {
    if output_muted {
        0.0
    } else {
        volume
    }
}

fn resolve_variant_volumes(
    active_variant: AudioVariant,
    volume: f32,
    output_muted: bool,
) -> (f32, f32) {
    if output_muted {
        return (0.0, 0.0);
    }

    match active_variant {
        AudioVariant::Sung => (volume, 0.0),
        AudioVariant::Karaoke => (0.0, volume),
    }
}

struct SingleTrackSession {
    sink: Sink,
    input_path: String,
    duration_ms: Option<u64>,
}

struct VariantTrackSession {
    sink: Sink,
    input_path: String,
    duration_ms: Option<u64>,
}

struct VariantSession {
    sung: VariantTrackSession,
    karaoke: VariantTrackSession,
    active_variant: AudioVariant,
}

type AudioDecoder = Decoder<BufReader<Cursor<Arc<[u8]>>>>;

impl VariantSession {
    fn active_track(&self) -> &VariantTrackSession {
        match self.active_variant {
            AudioVariant::Sung => &self.sung,
            AudioVariant::Karaoke => &self.karaoke,
        }
    }

    fn sync_volumes(&self, volume: f32, output_muted: bool) {
        let (sung_volume, karaoke_volume) =
            resolve_variant_volumes(self.active_variant, volume, output_muted);
        self.sung.sink.set_volume(sung_volume);
        self.karaoke.sink.set_volume(karaoke_volume);
    }

    fn play(&self) {
        self.sung.sink.play();
        self.karaoke.sink.play();
    }

    fn pause(&self) {
        self.sung.sink.pause();
        self.karaoke.sink.pause();
    }

    fn stop(self) {
        self.sung.sink.stop();
        self.karaoke.sink.stop();
    }

    fn seek(&self, position_ms: u64) -> Result<(), AppError> {
        self.sung
            .sink
            .try_seek(Duration::from_millis(position_ms))
            .map_err(|e| AppError::Internal(format!("Seek failed: {}", e)))?;
        self.karaoke
            .sink
            .try_seek(Duration::from_millis(position_ms))
            .map_err(|e| AppError::Internal(format!("Seek failed: {}", e)))?;
        Ok(())
    }

    fn position_ms(&self) -> u64 {
        self.active_track().sink.get_pos().as_millis() as u64
    }

    fn duration_ms(&self) -> Option<u64> {
        match (self.sung.duration_ms, self.karaoke.duration_ms) {
            (Some(left), Some(right)) => Some(left.max(right)),
            (Some(value), None) | (None, Some(value)) => Some(value),
            (None, None) => None,
        }
    }

    fn is_playing(&self) -> bool {
        (!self.sung.sink.is_paused() && !self.sung.sink.empty())
            || (!self.karaoke.sink.is_paused() && !self.karaoke.sink.empty())
    }

    fn is_paused(&self) -> bool {
        let has_buffered_audio = !self.sung.sink.empty() || !self.karaoke.sink.empty();
        has_buffered_audio && self.sung.sink.is_paused() && self.karaoke.sink.is_paused()
    }
}

enum PlaybackSession {
    Single(SingleTrackSession),
    Variants(VariantSession),
}

pub struct AudioPlayer {
    session: Option<PlaybackSession>,
    _stream: Option<OutputStream>,
    stream_handle: Option<OutputStreamHandle>,
    volume: f32,
    output_muted: bool,
}

// SAFETY: AudioPlayer is always accessed through a Mutex<AudioPlayer>,
// ensuring exclusive access. The OutputStream/OutputStreamHandle from rodio
// are not Send/Sync due to cpal platform internals, but we only create them
// once on the main thread and access through Mutex.
unsafe impl Send for AudioPlayer {}
unsafe impl Sync for AudioPlayer {}

impl AudioPlayer {
    pub fn new() -> Result<Self, AppError> {
        let (stream, stream_handle) = Self::try_open_output_stream()
            .map_err(|e| AppError::Internal(format!("Failed to open audio output: {e}")))?;
        Ok(Self {
            session: None,
            _stream: Some(stream),
            stream_handle: Some(stream_handle),
            volume: 1.0,
            output_muted: false,
        })
    }

    /// Try to open an audio output stream, falling back to every available
    /// device on the host if the system default fails (common on Windows when
    /// WASAPI has issues with the default device).
    fn try_open_output_stream() -> Result<(OutputStream, OutputStreamHandle), String> {
        if let Ok(result) = OutputStream::try_default() {
            return Ok(result);
        }

        let host = cpal::default_host();
        if let Ok(devices) = host.output_devices() {
            for device in devices {
                if let Ok(result) = OutputStream::try_from_device(&device) {
                    let name = device.name().unwrap_or_else(|_| "unknown".into());
                    eprintln!("[louvorja] Using fallback audio device: {name}");
                    return Ok(result);
                }
            }
        }

        Err("No usable audio output device found".into())
    }

    /// Creates a disabled player when no audio output device is available.
    /// Audio commands will return errors gracefully instead of panicking.
    pub fn disabled() -> Self {
        Self {
            session: None,
            _stream: None,
            stream_handle: None,
            volume: 1.0,
            output_muted: false,
        }
    }

    fn is_audio_available(&self) -> bool {
        self.stream_handle.is_some()
    }

    pub fn play(
        &mut self,
        path: &str,
        input_path: &str,
        start_ms: Option<u64>,
        preserve_live_position: bool,
    ) -> Result<(), AppError> {
        if !self.is_audio_available() {
            return Err(AppError::Internal(
                "No audio output device available".into(),
            ));
        }

        let playback_start = Instant::now();
        let had_existing_audio = self.session.is_some();
        let current_position_ms = self.position_ms();
        let was_playing = self.is_playing();

        self.clear_session();

        let path_buf = PathBuf::from(path);
        let duration_ms = Self::read_duration_from_path(path);

        let source =
            Decoder::new(BufReader::new(File::open(&path_buf).map_err(|e| {
                AppError::Internal(format!("Failed to open audio file: {}", e))
            })?))
            .map_err(|e| AppError::Internal(format!("Failed to decode audio: {}", e)))?;

        // SAFETY: we verified stream_handle.is_some() above
        let sink = Sink::try_new(self.stream_handle.as_ref().unwrap())
            .map_err(|e| AppError::Internal(format!("Failed to create audio sink: {}", e)))?;

        sink.set_volume(resolve_single_volume(self.volume, self.output_muted));
        sink.append(source);

        let effective_start_ms = resolve_play_start_ms(
            current_position_ms,
            start_ms,
            preserve_live_position,
            had_existing_audio,
            was_playing,
            playback_start.elapsed().as_millis() as u64,
        );

        if let Some(ms) = effective_start_ms {
            if let Err(e) = sink.try_seek(Duration::from_millis(ms)) {
                eprintln!("[louvorja] Initial seek to {}ms failed: {}", ms, e);
            }
        }

        self.session = Some(PlaybackSession::Single(SingleTrackSession {
            sink,
            input_path: input_path.to_string(),
            duration_ms,
        }));

        Ok(())
    }

    pub fn play_variants(
        &mut self,
        sung_path: &str,
        sung_input_path: &str,
        karaoke_path: &str,
        karaoke_input_path: &str,
        active_variant: AudioVariant,
        start_ms: Option<u64>,
    ) -> Result<(), AppError> {
        if !self.is_audio_available() {
            return Err(AppError::Internal(
                "No audio output device available".into(),
            ));
        }

        let playback_start = Instant::now();
        let had_existing_audio = self.session.is_some();
        let current_position_ms = self.position_ms();
        let was_playing = self.is_playing();

        self.clear_session();

        let effective_start_ms = resolve_play_start_ms(
            current_position_ms,
            start_ms,
            false,
            had_existing_audio,
            was_playing,
            playback_start.elapsed().as_millis() as u64,
        );

        let sung = self.prepare_variant_track(sung_path, sung_input_path, effective_start_ms)?;
        let karaoke =
            self.prepare_variant_track(karaoke_path, karaoke_input_path, effective_start_ms)?;

        let session = VariantSession {
            sung,
            karaoke,
            active_variant,
        };
        session.sync_volumes(self.volume, self.output_muted);
        session.play();

        self.session = Some(PlaybackSession::Variants(session));
        Ok(())
    }

    pub fn switch_variant(&mut self, active_variant: AudioVariant) -> Result<(), AppError> {
        let Some(PlaybackSession::Variants(session)) = self.session.as_mut() else {
            return Err(AppError::Internal(
                "No dual-track audio session is active.".into(),
            ));
        };

        session.active_variant = active_variant;
        session.sync_volumes(self.volume, self.output_muted);
        Ok(())
    }

    pub fn play_alert(&self, path: Option<&str>, volume: Option<f32>) -> Result<(), AppError> {
        let Some(ref stream_handle) = self.stream_handle else {
            return Err(AppError::Internal(
                "No audio output device available".into(),
            ));
        };

        let sink = Sink::try_new(stream_handle)
            .map_err(|e| AppError::Internal(format!("Failed to create alert sink: {e}")))?;

        let mut alert_volume = volume.unwrap_or(self.volume);
        if !alert_volume.is_finite() {
            alert_volume = self.volume;
        }
        sink.set_volume(alert_volume.clamp(0.0, 1.0));

        match path.map(str::trim).filter(|value| !value.is_empty()) {
            Some(file_path) => {
                let source = Decoder::new(BufReader::new(File::open(file_path).map_err(|e| {
                    AppError::Internal(format!("Failed to open alert audio file: {}", e))
                })?))
                .map_err(|e| AppError::Internal(format!("Failed to decode alert audio: {}", e)))?;
                sink.append(source);
            }
            None => {
                let first_tone = SineWave::new(880.0)
                    .take_duration(Duration::from_millis(260))
                    .amplify(0.12);
                let second_tone = SineWave::new(660.0)
                    .take_duration(Duration::from_millis(260))
                    .amplify(0.12)
                    .delay(Duration::from_millis(60));
                sink.append(first_tone);
                sink.append(second_tone);
            }
        }

        // Detach so alert playback continues independently of command lifetime.
        sink.detach();
        Ok(())
    }

    pub fn pause(&self) {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => session.sink.pause(),
            Some(PlaybackSession::Variants(session)) => session.pause(),
            None => {}
        }
    }

    pub fn resume(&self) {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => session.sink.play(),
            Some(PlaybackSession::Variants(session)) => session.play(),
            None => {}
        }
    }

    pub fn stop(&mut self) {
        self.clear_session();
    }

    pub fn seek(&self, ms: u64) -> Result<(), AppError> {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => {
                session
                    .sink
                    .try_seek(Duration::from_millis(ms))
                    .map_err(|e| AppError::Internal(format!("Seek failed: {}", e)))?;
            }
            Some(PlaybackSession::Variants(session)) => session.seek(ms)?,
            None => {}
        }
        Ok(())
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.volume = volume.clamp(0.0, 1.0);
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => session
                .sink
                .set_volume(resolve_single_volume(self.volume, self.output_muted)),
            Some(PlaybackSession::Variants(session)) => {
                session.sync_volumes(self.volume, self.output_muted)
            }
            None => {}
        }
    }

    pub fn set_output_muted(&mut self, output_muted: bool) {
        self.output_muted = output_muted;
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => session
                .sink
                .set_volume(resolve_single_volume(self.volume, self.output_muted)),
            Some(PlaybackSession::Variants(session)) => {
                session.sync_volumes(self.volume, self.output_muted)
            }
            None => {}
        }
    }

    pub fn position_ms(&self) -> u64 {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => session.sink.get_pos().as_millis() as u64,
            Some(PlaybackSession::Variants(session)) => session.position_ms(),
            None => 0,
        }
    }

    pub fn duration_ms(&self) -> Option<u64> {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => session.duration_ms,
            Some(PlaybackSession::Variants(session)) => session.duration_ms(),
            None => None,
        }
    }

    pub fn is_playing(&self) -> bool {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => {
                !session.sink.is_paused() && !session.sink.empty()
            }
            Some(PlaybackSession::Variants(session)) => session.is_playing(),
            None => false,
        }
    }

    pub fn is_paused(&self) -> bool {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => session.sink.is_paused(),
            Some(PlaybackSession::Variants(session)) => session.is_paused(),
            None => false,
        }
    }

    pub fn volume(&self) -> f32 {
        self.volume
    }

    /// Returns the original (unresolved) file path passed by the caller.
    /// This is the path the frontend uses for identity comparison.
    pub fn current_file(&self) -> Option<String> {
        match self.session.as_ref() {
            Some(PlaybackSession::Single(session)) => Some(session.input_path.clone()),
            Some(PlaybackSession::Variants(session)) => {
                Some(session.active_track().input_path.clone())
            }
            None => None,
        }
    }

    fn clear_session(&mut self) {
        match self.session.take() {
            Some(PlaybackSession::Single(session)) => session.sink.stop(),
            Some(PlaybackSession::Variants(session)) => session.stop(),
            None => {}
        }
    }

    fn prepare_variant_track(
        &self,
        resolved_path: &str,
        input_path: &str,
        start_ms: Option<u64>,
    ) -> Result<VariantTrackSession, AppError> {
        let audio_bytes = Self::load_audio_bytes(resolved_path)?;
        let duration_ms = Self::read_duration_from_bytes(audio_bytes.clone());
        let source = Self::decode_audio_bytes(audio_bytes)?;
        let sink = Sink::try_new(self.stream_handle.as_ref().unwrap())
            .map_err(|e| AppError::Internal(format!("Failed to create audio sink: {}", e)))?;

        sink.set_volume(0.0);
        sink.pause();
        sink.append(source);

        if let Some(ms) = start_ms {
            if let Err(e) = sink.try_seek(Duration::from_millis(ms)) {
                eprintln!("[louvorja] Initial seek to {}ms failed: {}", ms, e);
            }
        }

        Ok(VariantTrackSession {
            sink,
            input_path: input_path.to_string(),
            duration_ms,
        })
    }

    fn load_audio_bytes(path: &str) -> Result<Arc<[u8]>, AppError> {
        let p = std::path::Path::new(path);
        if !p.exists() {
            let parent_exists = p.parent().map(|d| d.exists()).unwrap_or(false);
            log::error!(
                "[audio] File not found: {} | parent dir exists: {} | parent: {:?}",
                path,
                parent_exists,
                p.parent()
            );
            return Err(AppError::Internal(format!(
                "Audio file not found: {}",
                path
            )));
        }
        let bytes = std::fs::read(path)
            .map_err(|e| AppError::Internal(format!("Failed to read audio file '{}': {}", path, e)))?;
        Ok(Arc::<[u8]>::from(bytes))
    }

    fn decode_audio_bytes(
        bytes: Arc<[u8]>,
    ) -> Result<AudioDecoder, AppError> {
        Decoder::new(BufReader::new(Cursor::new(bytes)))
            .map_err(|e| AppError::Internal(format!("Failed to decode audio: {}", e)))
    }

    fn read_duration_from_path(path: &str) -> Option<u64> {
        let file = File::open(path).ok()?;
        let reader = BufReader::new(file);
        let decoder = Decoder::new(reader).ok()?;
        decoder
            .total_duration()
            .map(|d| d.as_millis() as u64)
            .or_else(|| Self::estimate_mp3_duration_cbr(path))
    }

    fn read_duration_from_bytes(bytes: Arc<[u8]>) -> Option<u64> {
        let reader = BufReader::new(Cursor::new(bytes.clone()));
        let decoder = Decoder::new(reader).ok()?;
        decoder
            .total_duration()
            .map(|d| d.as_millis() as u64)
            .or_else(|| Self::estimate_mp3_duration_cbr_from_bytes(bytes.as_ref()))
    }

    fn estimate_mp3_duration_cbr(path: &str) -> Option<u64> {
        use std::io::Read;

        // Read only the first 4 KB — enough to parse the ID3 header and find
        // the first MPEG frame header. Using fs::read() previously loaded the
        // entire MP3 (up to 50+ MB) just to inspect a few bytes at the start.
        let file = std::fs::File::open(path).ok()?;
        let file_len = file.metadata().ok()?.len() as usize;
        if file_len < 4 {
            return None;
        }
        let read_len = file_len.min(4096);
        let mut reader = std::io::BufReader::new(file);
        let mut buf = vec![0u8; read_len];
        reader.read_exact(&mut buf).ok()?;

        let mut offset = 0usize;
        if buf.len() >= 10 && &buf[0..3] == b"ID3" {
            let id3_size = ((buf[6] as usize & 0x7f) << 21)
                | ((buf[7] as usize & 0x7f) << 14)
                | ((buf[8] as usize & 0x7f) << 7)
                | (buf[9] as usize & 0x7f);
            offset = 10usize.saturating_add(id3_size);
            if offset >= buf.len() {
                return None;
            }
        }

        let mpeg1_l3_bitrate_kbps = [
            0u32, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
        ];
        let mpeg2_l3_bitrate_kbps = [
            0u32, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
        ];

        let mut cursor = offset;
        while cursor + 4 <= buf.len() {
            let header = u32::from_be_bytes([
                buf[cursor],
                buf[cursor + 1],
                buf[cursor + 2],
                buf[cursor + 3],
            ]);

            let sync_word = (header >> 21) & 0x7ff;
            if sync_word != 0x7ff {
                cursor += 1;
                continue;
            }

            let version_bits = (header >> 19) & 0x3;
            let layer_bits = (header >> 17) & 0x3;
            let bitrate_index = ((header >> 12) & 0x0f) as usize;
            let sample_rate_index = ((header >> 10) & 0x03) as usize;

            if version_bits == 0b01
                || layer_bits != 0b01
                || bitrate_index == 0
                || bitrate_index == 0x0f
                || sample_rate_index == 0x03
            {
                cursor += 1;
                continue;
            }

            let bitrate_kbps = if version_bits == 0b11 {
                mpeg1_l3_bitrate_kbps[bitrate_index]
            } else {
                mpeg2_l3_bitrate_kbps[bitrate_index]
            };
            if bitrate_kbps == 0 {
                cursor += 1;
                continue;
            }

            // Use file_len (not buf.len()) for accurate duration estimate
            let stream_bits = ((file_len - offset) as u128) * 8u128;
            let bitrate_bps = (bitrate_kbps as u128) * 1000u128;
            let duration_ms = (stream_bits * 1000u128) / bitrate_bps;
            if duration_ms == 0 {
                return None;
            }
            return Some(duration_ms as u64);
        }

        None
    }

    fn estimate_mp3_duration_cbr_from_bytes(bytes: &[u8]) -> Option<u64> {
        if bytes.len() < 4 {
            return None;
        }

        let mut offset = 0usize;
        if bytes.len() >= 10 && &bytes[0..3] == b"ID3" {
            let id3_size = ((bytes[6] as usize & 0x7f) << 21)
                | ((bytes[7] as usize & 0x7f) << 14)
                | ((bytes[8] as usize & 0x7f) << 7)
                | (bytes[9] as usize & 0x7f);
            offset = 10usize.saturating_add(id3_size);
            if offset >= bytes.len() {
                return None;
            }
        }

        let scan_limit = bytes.len().min(offset.saturating_add(4096));
        let mpeg1_l3_bitrate_kbps = [
            0u32, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
        ];
        let mpeg2_l3_bitrate_kbps = [
            0u32, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
        ];

        let mut cursor = offset;
        while cursor + 4 <= scan_limit {
            let header = u32::from_be_bytes([
                bytes[cursor],
                bytes[cursor + 1],
                bytes[cursor + 2],
                bytes[cursor + 3],
            ]);

            let sync_word = (header >> 21) & 0x7ff;
            if sync_word != 0x7ff {
                cursor += 1;
                continue;
            }

            let version_bits = (header >> 19) & 0x3;
            let layer_bits = (header >> 17) & 0x3;
            let bitrate_index = ((header >> 12) & 0x0f) as usize;
            let sample_rate_index = ((header >> 10) & 0x03) as usize;

            if version_bits == 0b01
                || layer_bits != 0b01
                || bitrate_index == 0
                || bitrate_index == 0x0f
                || sample_rate_index == 0x03
            {
                cursor += 1;
                continue;
            }

            let bitrate_kbps = if version_bits == 0b11 {
                mpeg1_l3_bitrate_kbps[bitrate_index]
            } else {
                mpeg2_l3_bitrate_kbps[bitrate_index]
            };
            if bitrate_kbps == 0 {
                cursor += 1;
                continue;
            }

            let stream_bits = ((bytes.len() - offset) as u128) * 8u128;
            let bitrate_bps = (bitrate_kbps as u128) * 1000u128;
            let duration_ms = (stream_bits * 1000u128) / bitrate_bps;
            if duration_ms == 0 {
                return None;
            }
            return Some(duration_ms as u64);
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::{
        resolve_play_start_ms, resolve_single_volume, resolve_variant_volumes, AudioVariant,
    };

    #[test]
    fn keeps_fallback_start_when_live_position_is_not_requested() {
        assert_eq!(
            resolve_play_start_ms(4_000, Some(3_500), false, true, true, 120),
            Some(3_500)
        );
    }

    #[test]
    fn compensates_live_switches_while_audio_is_playing() {
        assert_eq!(
            resolve_play_start_ms(4_000, Some(3_500), true, true, true, 120),
            Some(4_120)
        );
    }

    #[test]
    fn preserves_exact_position_when_switching_while_paused() {
        assert_eq!(
            resolve_play_start_ms(4_000, Some(3_500), true, true, false, 120),
            Some(4_000)
        );
    }

    #[test]
    fn caps_live_switch_compensation() {
        assert_eq!(
            resolve_play_start_ms(4_000, Some(3_500), true, true, true, 5_000),
            Some(5_500)
        );
    }

    #[test]
    fn routes_volume_to_sung_track_only() {
        assert_eq!(
            resolve_variant_volumes(AudioVariant::Sung, 0.75, false),
            (0.75, 0.0)
        );
    }

    #[test]
    fn routes_volume_to_karaoke_track_only() {
        assert_eq!(
            resolve_variant_volumes(AudioVariant::Karaoke, 0.75, false),
            (0.0, 0.75)
        );
    }

    #[test]
    fn mutes_all_variant_output_when_silent_mode_is_enabled() {
        assert_eq!(
            resolve_variant_volumes(AudioVariant::Karaoke, 0.75, true),
            (0.0, 0.0)
        );
    }

    #[test]
    fn mutes_single_track_output_when_silent_mode_is_enabled() {
        assert_eq!(resolve_single_volume(0.75, true), 0.0);
    }
}
