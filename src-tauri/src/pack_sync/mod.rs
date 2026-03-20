pub mod planner;
pub mod executor;

/// The CDN manifest URL, baked at compile time.
/// Empty string means pack sync is disabled (e.g. dev without .env).
pub const CDN_MANIFEST_URL: &str = env!("CDN_MANIFEST_URL");

pub fn is_pack_sync_enabled() -> bool {
    !CDN_MANIFEST_URL.is_empty()
}
