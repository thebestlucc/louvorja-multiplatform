// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// M-MIMALLOC-APPS from @references/perf/allocators.md
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

fn main() {
    // --build-bible: headless mode used by platform installer hooks
    // (NSIS POSTINSTALL, deb/rpm postinst) to generate bible.db from
    // bundled .sqlite sources without starting the Tauri GUI.
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--build-bible") {
        // windows_subsystem = "windows" suppresses console output.
        // Re-attach to the parent console so eprintln!() works in NSIS hooks.
        #[cfg(target_os = "windows")]
        unsafe {
            windows_sys::Win32::System::Console::AttachConsole(
                windows_sys::Win32::System::Console::ATTACH_PARENT_PROCESS,
            );
        }

        let mut input = None;
        let mut output = None;
        for pair in args.windows(2) {
            match pair[0].as_str() {
                "--input" => input = Some(pair[1].clone()),
                "--output" => output = Some(pair[1].clone()),
                _ => {}
            }
        }

        let (Some(input), Some(output)) = (input, output) else {
            eprintln!("Usage: LouvorJA --build-bible --input <sqlite-dir> --output <bible.db-path>");
            std::process::exit(2);
        };

        match louvorja_multiplatform::bible_builder::build_bible_db(
            std::path::Path::new(&input),
            std::path::Path::new(&output),
        ) {
            Ok(_) => std::process::exit(0),
            Err(e) => {
                eprintln!("[build-bible] ERROR: {e}");
                std::process::exit(1);
            }
        }
    }

    louvorja_multiplatform::run();
}
