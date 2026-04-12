#[test]
fn axum_tungstenite_hmac_compile() {
    let _ = axum::Router::<()>::new();
    let _: Option<tokio_tungstenite::tungstenite::Message> = None;
    use hmac::Mac;
    let mut m = <hmac::Hmac<sha2::Sha256>>::new_from_slice(b"k").unwrap();
    m.update(b"x");
    let _ = m.finalize();
}
