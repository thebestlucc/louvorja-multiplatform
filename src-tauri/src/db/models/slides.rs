use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Presentation {
    #[specta(type = i32)]
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub aspect_ratio: String,
    pub library_kind: Option<String>,
    pub file_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Slide {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub presentation_id: i64,
    pub slide_index: i32,
    pub slide_type: String,
    pub content: String,
    pub notes: Option<String>,
    pub transition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Liturgy {
    #[specta(type = i32)]
    pub id: i64,
    pub title: String,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub item_count: i64,
    pub hymn_count: i64,
    pub week_day: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LiturgyItem {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub service_id: i64,
    pub item_type: String,
    #[specta(type = Option<i32>)]
    pub item_id: Option<i64>,
    pub title: String,
    pub item_order: i32,
    pub notes: Option<String>,
    #[specta(type = Option<i32>)]
    pub parent_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LiturgyWithItems {
    pub service: Liturgy,
    pub items: Vec<LiturgyItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MonitorConfig {
    #[specta(type = i32)]
    pub id: i64,
    pub monitor_id: String,
    pub role: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub friendly_name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub connection_type: Option<String>,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundConfig {
    pub kind: BackgroundKind,
    pub color: Option<String>,
    pub image_path: Option<String>,
    pub gradient_start: Option<String>,
    pub gradient_end: Option<String>,
    pub gradient_angle: Option<i32>,
    pub opacity: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BackgroundKind { #[default] Solid, Image, Gradient }

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VideoMode { #[default] Fullscreen, Background }

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VideoSource { #[default] Local, Youtube }

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ImageFit { Contain, #[default] Cover, Fill }

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TextAlignment { Left, #[default] Center, Right }

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RefPosition { #[default] Bottom, Top, Hidden }

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GradientOverlay {
    pub angle: i32,
    pub start_color: String,
    pub end_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct BibleMode {
    pub alignment: TextAlignment,
    pub ref_position: RefPosition,
    pub text_shadow: bool,
    pub gradient: Option<GradientOverlay>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct TransitionConfig {
    pub kind: TransitionKind,
    pub duration_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TransitionKind { #[default] Fade, Slide, Pop, None }

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "slideType", rename_all = "camelCase")]
pub enum SlideContent {
    Cover {
        title: String,
        subtitle: Option<String>,
        label: Option<String>,
        background: BackgroundConfig,
        text_color: Option<String>,
        text_size: Option<i32>,
    },
    Lyrics {
        text: String,
        label: Option<String>,
        background: BackgroundConfig,
        text_color: Option<String>,
        text_size: Option<i32>,
    },
    Text {
        content: String,
        background: BackgroundConfig,
        text_color: Option<String>,
        text_size: Option<i32>,
    },
    Image {
        path: String,
        caption: Option<String>,
        fit: ImageFit,
        background: BackgroundConfig,
    },
    Video {
        path: String,
        auto_play: bool,
        loop_video: bool,
        muted: bool,
        mode: VideoMode,
        overlay_text: Option<String>,
        audio_path: Option<String>,
    },
    Bible {
        reference: String,
        text: String,
        mode: BibleMode,
        background: BackgroundConfig,
        text_color: Option<String>,
        text_size: Option<i32>,
    },
    OnlineVideo {
        url: String,
        video_id: String,
        source: VideoSource,
        title: Option<String>,
    },
    Pause,
}

impl SlideContent {
    pub fn slide_type_str(&self) -> &'static str {
        match self {
            SlideContent::Cover { .. }        => "cover",
            SlideContent::Lyrics { .. }       => "lyrics",
            SlideContent::Text { .. }         => "text",
            SlideContent::Image { .. }        => "image",
            SlideContent::Video { .. }        => "video",
            SlideContent::Bible { .. }        => "bible",
            SlideContent::OnlineVideo { .. }  => "online_video",
            SlideContent::Pause              => "pause",
        }
    }

    pub fn default_background() -> BackgroundConfig {
        BackgroundConfig {
            kind: BackgroundKind::Solid,
            color: Some("#1a1a2e".to_string()),
            ..Default::default()
        }
    }

    /// Return the slide type as a string for streaming/IPC compatibility.
    pub fn slide_type(&self) -> &'static str {
        self.slide_type_str()
    }

    /// Extract the primary text content for streaming/display.
    pub fn text(&self) -> Option<&str> {
        match self {
            SlideContent::Lyrics { text, .. } => Some(text.as_str()),
            SlideContent::Text { content, .. } => Some(content.as_str()),
            SlideContent::Bible { text, .. } => Some(text.as_str()),
            _ => None,
        }
    }

    /// Extract a title/reference for streaming/display.
    pub fn title(&self) -> Option<&str> {
        match self {
            SlideContent::Cover { title, .. } => Some(title.as_str()),
            SlideContent::Bible { reference, .. } => Some(reference.as_str()),
            SlideContent::OnlineVideo { title, .. } => title.as_deref(),
            _ => None,
        }
    }

    /// Extract subtitle.
    pub fn subtitle(&self) -> Option<&str> {
        match self {
            SlideContent::Cover { subtitle, .. } => subtitle.as_deref(),
            _ => None,
        }
    }

    /// Extract a label (used for cover utility slides: "timer", "clock").
    pub fn label(&self) -> Option<&str> {
        match self {
            SlideContent::Cover { label, .. } => label.as_deref(),
            SlideContent::Lyrics { label, .. } => label.as_deref(),
            _ => None,
        }
    }

    /// Extract the background image path.
    pub fn background_image(&self) -> Option<&str> {
        match self {
            SlideContent::Cover { background, .. }
            | SlideContent::Lyrics { background, .. }
            | SlideContent::Text { background, .. }
            | SlideContent::Image { background, .. }
            | SlideContent::Bible { background, .. } => background.image_path.as_deref(),
            _ => None,
        }
    }

    /// Extract the background color.
    pub fn background_color(&self) -> Option<&str> {
        match self {
            SlideContent::Cover { background, .. }
            | SlideContent::Lyrics { background, .. }
            | SlideContent::Text { background, .. }
            | SlideContent::Image { background, .. }
            | SlideContent::Bible { background, .. } => background.color.as_deref(),
            _ => None,
        }
    }

    /// Extract video/media path.
    pub fn video_path(&self) -> Option<&str> {
        match self {
            SlideContent::Video { path, .. } => Some(path.as_str()),
            _ => None,
        }
    }

    /// Extract audio path.
    pub fn audio_path(&self) -> Option<&str> {
        match self {
            SlideContent::Video { audio_path, .. } => audio_path.as_deref(),
            _ => None,
        }
    }

    /// Extract text color.
    pub fn text_color(&self) -> Option<&str> {
        match self {
            SlideContent::Cover { text_color, .. }
            | SlideContent::Lyrics { text_color, .. }
            | SlideContent::Text { text_color, .. }
            | SlideContent::Bible { text_color, .. } => text_color.as_deref(),
            _ => None,
        }
    }

    /// Extract text size.
    pub fn text_size(&self) -> Option<i32> {
        match self {
            SlideContent::Cover { text_size, .. }
            | SlideContent::Lyrics { text_size, .. }
            | SlideContent::Text { text_size, .. }
            | SlideContent::Bible { text_size, .. } => *text_size,
            _ => None,
        }
    }

    /// Extract online video URL.
    pub fn video_url(&self) -> Option<&str> {
        match self {
            SlideContent::OnlineVideo { url, .. } => Some(url.as_str()),
            _ => None,
        }
    }

    /// Extract online video ID.
    pub fn video_id(&self) -> Option<&str> {
        match self {
            SlideContent::OnlineVideo { video_id, .. } => Some(video_id.as_str()),
            _ => None,
        }
    }

    /// Extract online video source as string.
    pub fn video_source(&self) -> Option<&str> {
        match self {
            SlideContent::OnlineVideo { source, .. } => match source {
                VideoSource::Youtube => Some("youtube"),
                VideoSource::Local => Some("local"),
            },
            _ => None,
        }
    }

    /// Extract online video title.
    pub fn video_title(&self) -> Option<&str> {
        match self {
            SlideContent::OnlineVideo { title, .. } => title.as_deref(),
            _ => None,
        }
    }
}
