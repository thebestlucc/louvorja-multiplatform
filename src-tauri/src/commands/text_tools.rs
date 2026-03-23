use crate::error::AppError;
use rand::rngs::OsRng;
use rand::seq::SliceRandom;

#[tauri::command]
#[specta::specta]
pub fn run_lottery(names: Vec<String>) -> Result<String, AppError> {
    let sanitized = sanitize_lottery_names(names);
    if sanitized.is_empty() {
        return Err(AppError::Internal(
            "Lottery requires at least one non-empty name.".into(),
        ));
    }

    let mut rng = OsRng;
    let winner = sanitized
        .choose(&mut rng)
        .ok_or_else(|| AppError::Internal("Failed to select lottery winner.".into()))?;

    Ok(winner.clone())
}

#[tauri::command]
#[specta::specta]
pub fn format_text(text: String, format: String) -> Result<String, AppError> {
    let normalized = format.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "uppercase" => Ok(text.to_uppercase()),
        "lowercase" => Ok(text.to_lowercase()),
        "title_case" => Ok(to_title_case(&text)),
        "sentence_case" => Ok(to_sentence_case(&text)),
        _ => Err(AppError::Internal(format!(
            "Unsupported text format '{}'. Use uppercase, lowercase, title_case, or sentence_case.",
            format
        ))),
    }
}

fn sanitize_lottery_names(names: Vec<String>) -> Vec<String> {
    names
        .into_iter()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect()
}

fn to_title_case(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut is_word_start = true;

    for ch in text.chars() {
        if ch.is_alphabetic() {
            if is_word_start {
                output.extend(ch.to_uppercase());
                is_word_start = false;
            } else {
                output.extend(ch.to_lowercase());
            }
        } else {
            output.push(ch);
            is_word_start = ch.is_whitespace() || matches!(ch, '-' | '_' | '/' | '\\');
        }
    }

    output
}

fn to_sentence_case(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut capitalize_next = true;

    for ch in text.chars() {
        if ch.is_alphabetic() {
            if capitalize_next {
                output.extend(ch.to_uppercase());
                capitalize_next = false;
            } else {
                output.extend(ch.to_lowercase());
            }
        } else {
            output.push(ch);
            if matches!(ch, '.' | '!' | '?') {
                capitalize_next = true;
            }
        }
    }

    output
}
