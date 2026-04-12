/// Simple liveness probe endpoint.
pub async fn health_handler() -> &'static str {
    "ok"
}
