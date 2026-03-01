use crate::error::AppError;
use cpal::traits::{DeviceTrait, HostTrait};
use rodio::source::SineWave;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::time::Duration;

pub struct AudioPlayer {
    sink: Option<Sink>,
    _stream: Option<OutputStream>,
    stream_handle: Option<OutputStreamHandle>,
    current_file: Option<PathBuf>,
    /// The original (unresolved) path passed by the frontend, used for identity
    /// checks in the UI (e.g. comparing which hymn is playing).
    input_path: Option<String>,
    duration_ms: Option<u64>,
    volume: f32,
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
            sink: None,
            _stream: Some(stream),
            stream_handle: Some(stream_handle),
            current_file: None,
            input_path: None,
            duration_ms: None,
            volume: 1.0,
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
            sink: None,
            _stream: None,
            stream_handle: None,
            current_file: None,
            input_path: None,
            duration_ms: None,
            volume: 1.0,
        }
    }

    fn is_audio_available(&self) -> bool {
        self.stream_handle.is_some()
    }

    pub fn play(&mut self, path: &str) -> Result<(), AppError> {
        if !self.is_audio_available() {
            return Err(AppError::Internal("No audio output device available".into()));
        }

        if let Some(sink) = self.sink.take() {
            sink.stop();
        }

        let path_buf = PathBuf::from(path);

        // Read duration from a separate decoder
        self.duration_ms = Self::read_duration(path);

        let source =
            Decoder::new(BufReader::new(File::open(&path_buf).map_err(|e| {
                AppError::Internal(format!("Failed to open audio file: {}", e))
            })?))
            .map_err(|e| AppError::Internal(format!("Failed to decode audio: {}", e)))?;

        // SAFETY: we verified stream_handle.is_some() above
        let sink = Sink::try_new(self.stream_handle.as_ref().unwrap())
            .map_err(|e| AppError::Internal(format!("Failed to create audio sink: {}", e)))?;

        sink.set_volume(self.volume);
        sink.append(source);

        self.sink = Some(sink);
        self.current_file = Some(path_buf);

        Ok(())
    }

    pub fn play_alert(&self, path: Option<&str>, volume: Option<f32>) -> Result<(), AppError> {
        let Some(ref stream_handle) = self.stream_handle else {
            return Err(AppError::Internal("No audio output device available".into()));
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
        if let Some(ref sink) = self.sink {
            sink.pause();
        }
    }

    pub fn resume(&self) {
        if let Some(ref sink) = self.sink {
            sink.play();
        }
    }

    pub fn stop(&mut self) {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
        self.current_file = None;
        self.input_path = None;
        self.duration_ms = None;
    }

    pub fn seek(&self, ms: u64) -> Result<(), AppError> {
        if let Some(ref sink) = self.sink {
            sink.try_seek(Duration::from_millis(ms))
                .map_err(|e| AppError::Internal(format!("Seek failed: {}", e)))?;
        }
        Ok(())
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.volume = volume.clamp(0.0, 1.0);
        if let Some(ref sink) = self.sink {
            sink.set_volume(self.volume);
        }
    }

    pub fn position_ms(&self) -> u64 {
        self.sink
            .as_ref()
            .map(|s| s.get_pos().as_millis() as u64)
            .unwrap_or(0)
    }

    pub fn duration_ms(&self) -> Option<u64> {
        self.duration_ms
    }

    pub fn is_playing(&self) -> bool {
        self.sink
            .as_ref()
            .map(|s| !s.is_paused() && !s.empty())
            .unwrap_or(false)
    }

    pub fn is_paused(&self) -> bool {
        self.sink.as_ref().map(|s| s.is_paused()).unwrap_or(false)
    }

    pub fn volume(&self) -> f32 {
        self.volume
    }

    /// Returns the original (unresolved) file path passed by the caller.
    /// This is the path the frontend uses for identity comparison.
    pub fn current_file(&self) -> Option<String> {
        self.input_path.clone()
    }

    /// Store the original (unresolved) file path for identity matching.
    pub fn set_input_path(&mut self, path: &str) {
        self.input_path = Some(path.to_string());
    }

    fn read_duration(path: &str) -> Option<u64> {
        let file = File::open(path).ok()?;
        let reader = BufReader::new(file);
        let decoder = Decoder::new(reader).ok()?;
        decoder
            .total_duration()
            .map(|d| d.as_millis() as u64)
            .or_else(|| Self::estimate_mp3_duration_cbr(path))
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
}
