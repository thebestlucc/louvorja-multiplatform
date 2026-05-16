/// Render a URL as an SVG QR code string.
/// Returns a self-contained, inline-embeddable SVG.
pub fn render_svg(url: &str) -> String {
    use qrcode::QrCode;
    use qrcode::render::svg;

    let code = match QrCode::new(url.as_bytes()) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    code.render::<svg::Color>()
        .min_dimensions(200, 200)
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn svg_is_well_formed() {
        let svg = render_svg("http://192.168.1.1:7456/pair?token=abc123");
        assert!(svg.starts_with("<svg") || svg.starts_with("<?xml"));
        assert!(svg.contains("</svg>"));
    }
}
