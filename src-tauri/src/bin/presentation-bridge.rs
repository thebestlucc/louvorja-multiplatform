#[cfg(not(any(target_os = "android", target_os = "ios")))]
use global_hotkey::{hotkey::HotKey, GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
use louvorja_multiplatform::presentation_bridge::{
    bootstrap_ipc, BridgeConfig, BridgeRuntime, BridgeStartupSource, PowerPointAdapter,
    PowerPointCommand, PowerPointCommandOutcome,
};
use std::str::FromStr;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tao::event_loop::{ControlFlow, EventLoopBuilder};

fn main() {
    if let Err(error) = run() {
        eprintln!("presentation-bridge bootstrap failed: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let startup_source = startup_source_from_args();
    let config = BridgeConfig::load()?;
    let runtime = bootstrap_ipc(&config, startup_source)?;
    run_bridge_runtime(runtime, &config)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn run_bridge_runtime(
    runtime: BridgeRuntime,
    config: &BridgeConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    if !config.enabled {
        runtime.wait()?;
        return Ok(());
    }

    let event_loop = EventLoopBuilder::new().build();
    let hotkey_manager = GlobalHotKeyManager::new()?;
    let registered_hotkeys = register_bridge_hotkeys(&hotkey_manager, config)?;
    let adapter = PowerPointAdapter::new();
    let hotkey_events = GlobalHotKeyEvent::receiver();
    let (runtime_done_tx, runtime_done_rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        let result = runtime.wait().map_err(|error| error.to_string());
        let _ = runtime_done_tx.send(result);
    });

    event_loop.run(move |_event, _, control_flow| {
        *control_flow = ControlFlow::Poll;

        match runtime_done_rx.try_recv() {
            Ok(Ok(())) => {
                *control_flow = ControlFlow::Exit;
                return;
            }
            Ok(Err(error)) => {
                eprintln!("presentation-bridge runtime failed: {error}");
                *control_flow = ControlFlow::Exit;
                return;
            }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                *control_flow = ControlFlow::Exit;
                return;
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
        }

        if let Ok(event) = hotkey_events.try_recv() {
            if event.state == HotKeyState::Pressed {
                for (hotkey_id, action) in &registered_hotkeys {
                    if *hotkey_id == event.id {
                        dispatch_hotkey_action(&adapter, action);
                        break;
                    }
                }
            }
        }

        let _keep_manager_alive = &hotkey_manager;
    });
}

#[cfg(any(target_os = "android", target_os = "ios"))]
fn run_bridge_runtime(
    runtime: BridgeRuntime,
    _config: &BridgeConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    runtime.wait()?;
    Ok(())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn register_bridge_hotkeys(
    hotkey_manager: &GlobalHotKeyManager,
    config: &BridgeConfig,
) -> Result<Vec<(u32, &'static str)>, Box<dyn std::error::Error>> {
    let mut registered = Vec::new();

    for (action, combo) in config.bridge_global_shortcuts() {
        if combo.trim().is_empty() {
            continue;
        }

        let hotkey: HotKey = combo.parse()?;
        hotkey_manager.register(hotkey)?;
        registered.push((hotkey.id(), action));
    }

    Ok(registered)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn dispatch_hotkey_action(adapter: &PowerPointAdapter, action: &str) {
    let Some(command) = powerpoint_command_for_action(action) else {
        return;
    };

    match adapter.dispatch(command) {
        Ok(result) if result.outcome == PowerPointCommandOutcome::Success => {}
        Ok(result) => eprintln!(
            "presentation-bridge action {:?} completed with {:?}",
            result.command, result.outcome
        ),
        Err(error) => eprintln!("presentation-bridge action {:?} failed: {error}", command),
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn powerpoint_command_for_action(action: &str) -> Option<PowerPointCommand> {
    match action {
        "slides-next" => Some(PowerPointCommand::Next),
        "slides-prev" => Some(PowerPointCommand::Previous),
        _ => None,
    }
}

fn startup_source_from_args() -> BridgeStartupSource {
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        if let Some(value) = arg.strip_prefix("--startup-source=") {
            return BridgeStartupSource::from_str(value)
                .unwrap_or(BridgeStartupSource::StartedManually);
        }

        if arg == "--startup-source" {
            return args
                .next()
                .and_then(|value| BridgeStartupSource::from_str(&value).ok())
                .unwrap_or(BridgeStartupSource::StartedManually);
        }
    }

    BridgeStartupSource::StartedManually
}
