use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::time::Duration;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use crate::error::AppError;

pub struct AudioPlayer {
    sink: Option<Sink>,
    _stream: OutputStream,
    stream_handle: OutputStreamHandle,
    current_file: Option<PathBuf>,
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
        let (stream, stream_handle) = OutputStream::try_default()
            .map_err(|e| AppError::Internal(format!("Failed to open audio output: {}", e)))?;
        Ok(Self {
            sink: None,
            _stream: stream,
            stream_handle,
            current_file: None,
            duration_ms: None,
            volume: 1.0,
        })
    }

    pub fn play(&mut self, path: &str) -> Result<(), AppError> {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }

        let path_buf = PathBuf::from(path);

        // Read duration from a separate decoder
        self.duration_ms = Self::read_duration(path);

        let source = Decoder::new(BufReader::new(
            File::open(&path_buf)
                .map_err(|e| AppError::Internal(format!("Failed to open audio file: {}", e)))?,
        ))
        .map_err(|e| AppError::Internal(format!("Failed to decode audio: {}", e)))?;

        let sink = Sink::try_new(&self.stream_handle)
            .map_err(|e| AppError::Internal(format!("Failed to create audio sink: {}", e)))?;

        sink.set_volume(self.volume);
        sink.append(source);

        self.sink = Some(sink);
        self.current_file = Some(path_buf);

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
        self.sink
            .as_ref()
            .map(|s| s.is_paused())
            .unwrap_or(false)
    }

    pub fn volume(&self) -> f32 {
        self.volume
    }

    pub fn current_file(&self) -> Option<String> {
        self.current_file.as_ref().map(|p| p.to_string_lossy().to_string())
    }

    fn read_duration(path: &str) -> Option<u64> {
        let file = File::open(path).ok()?;
        let reader = BufReader::new(file);
        let decoder = Decoder::new(reader).ok()?;
        decoder.total_duration().map(|d| d.as_millis() as u64)
    }
}
