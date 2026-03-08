use super::{
    evaluate_config_update, BridgeConfig, BridgeConfigApplyDecision, BridgeStartupSource,
    BridgeStatus, BridgeSupervision, BridgeSupervisionExitReason, PowerPointAdapter,
    PowerPointCommand, PowerPointCommandResult, DEFAULT_HEARTBEAT_TIMEOUT,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::fs::{remove_file, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use thiserror::Error;

#[derive(Debug)]
pub struct BridgeRuntime {
    status: BridgeStatus,
    supervision: Arc<Mutex<BridgeSupervision>>,
    shutdown_tx: Option<Sender<()>>,
    server_thread: Option<JoinHandle<Result<(), BridgeIpcError>>>,
    _singleton_guard: SingletonGuard,
}

impl BridgeRuntime {
    pub fn status(&self) -> &BridgeStatus {
        &self.status
    }

    pub fn notify_parent_death(&self) -> Result<(), BridgeIpcError> {
        let mut supervision = self
            .supervision
            .lock()
            .map_err(|_| BridgeIpcError::SupervisionStatePoisoned)?;
        supervision.mark_parent_dead();
        Ok(())
    }

    pub fn wait(mut self) -> Result<(), BridgeIpcError> {
        if let Some(handle) = self.server_thread.take() {
            handle
                .join()
                .map_err(|_| BridgeIpcError::ServerThreadPanic)??;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeApplyConfigIpcResult {
    pub decision: BridgeConfigApplyDecision,
    pub status: BridgeStatus,
}

#[derive(Debug)]
struct BridgeRuntimeState {
    config: BridgeConfig,
    status: BridgeStatus,
}

pub fn bootstrap_ipc(
    config: &BridgeConfig,
    startup_source: BridgeStartupSource,
) -> Result<BridgeRuntime, BridgeIpcError> {
    bootstrap_platform_ipc(config, startup_source)
}

pub fn probe_bridge_status() -> Result<Option<BridgeStatus>, BridgeIpcError> {
    probe_platform_bridge_status()
}

pub fn request_bridge_shutdown() -> Result<(), BridgeIpcError> {
    request_platform_bridge_shutdown()
}

pub fn request_bridge_apply_config(
    config: &BridgeConfig,
) -> Result<BridgeApplyConfigIpcResult, BridgeIpcError> {
    request_platform_bridge_apply_config(config)
}

pub fn request_bridge_next() -> Result<PowerPointCommandResult, BridgeIpcError> {
    request_platform_bridge_next()
}

pub fn request_bridge_previous() -> Result<PowerPointCommandResult, BridgeIpcError> {
    request_platform_bridge_previous()
}

#[derive(Debug, Error)]
pub enum BridgeIpcError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("Another presentation-bridge instance is already running at {0}")]
    AlreadyRunning(PathBuf),
    #[error("Failed to join the bridge IPC server thread")]
    ServerThreadPanic,
    #[error("Bridge supervision state became unavailable")]
    SupervisionStatePoisoned,
    #[error("Bridge runtime state became unavailable")]
    RuntimeStatePoisoned,
    #[error("Bridge request failed with {code}: {message}")]
    RequestFailed { code: String, message: String },
    #[error("Bridge IPC is not implemented for this platform yet")]
    UnsupportedPlatform,
}

#[derive(Debug)]
struct SingletonGuard {
    artifacts: Vec<PathBuf>,
}

impl Drop for SingletonGuard {
    fn drop(&mut self) {
        for artifact in &self.artifacts {
            let _ = remove_file(artifact);
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct BridgeRequest {
    id: Option<String>,
    command: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct BridgeResponse {
    id: Option<String>,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<BridgeResponseError>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BridgeResponseError {
    code: String,
    message: String,
}

#[cfg(unix)]
pub fn bridge_socket_path() -> PathBuf {
    std::env::temp_dir().join("louvorja-presentation-bridge.sock")
}

fn bridge_lock_path() -> PathBuf {
    std::env::temp_dir().join("louvorja-presentation-bridge.lock")
}

#[cfg(windows)]
fn bridge_port_path() -> PathBuf {
    std::env::temp_dir().join("louvorja-presentation-bridge.port")
}

#[cfg(unix)]
fn bootstrap_platform_ipc(
    config: &BridgeConfig,
    startup_source: BridgeStartupSource,
) -> Result<BridgeRuntime, BridgeIpcError> {
    use std::os::unix::net::UnixListener;

    let socket_path = bridge_socket_path();
    let lock_path = bridge_lock_path();

    let singleton_guard = acquire_singleton(&socket_path, &lock_path)?;
    let _ = remove_file(&socket_path);

    let listener = UnixListener::bind(&socket_path)?;
    listener.set_nonblocking(true)?;

    let status = BridgeStatus::bootstrap(config, startup_source);
    let runtime_state = Arc::new(Mutex::new(BridgeRuntimeState {
        config: config.clone(),
        status: status.clone(),
    }));
    let supervision = Arc::new(Mutex::new(BridgeSupervision::new(
        status.mode,
        DEFAULT_HEARTBEAT_TIMEOUT,
        Instant::now(),
    )));
    let runtime_state_for_thread = Arc::clone(&runtime_state);
    let supervision_for_thread = Arc::clone(&supervision);
    let (shutdown_tx, shutdown_rx) = channel::<()>();
    let shutdown_tx_for_thread = shutdown_tx.clone();

    let server_thread = thread::spawn(move || -> Result<(), BridgeIpcError> {
        loop {
            match listener.accept() {
                Ok((stream, _addr)) => handle_stream(
                    stream,
                    &runtime_state_for_thread,
                    &supervision_for_thread,
                    &shutdown_tx_for_thread,
                )?,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    match shutdown_rx.try_recv() {
                        Ok(()) | Err(TryRecvError::Disconnected) => return Ok(()),
                        Err(TryRecvError::Empty) => {
                            if let Some(_exit_reason) =
                                supervision_exit_reason(&supervision_for_thread)?
                            {
                                return Ok(());
                            }
                            thread::sleep(Duration::from_millis(50));
                        }
                    }
                }
                Err(error) => return Err(error.into()),
            }
        }
    });

    Ok(BridgeRuntime {
        status,
        supervision,
        shutdown_tx: Some(shutdown_tx),
        server_thread: Some(server_thread),
        _singleton_guard: singleton_guard,
    })
}

#[cfg(windows)]
fn bootstrap_platform_ipc(
    config: &BridgeConfig,
    startup_source: BridgeStartupSource,
) -> Result<BridgeRuntime, BridgeIpcError> {
    use std::net::TcpListener;

    let lock_path = bridge_lock_path();
    let port_path = bridge_port_path();

    let singleton_guard = acquire_windows_singleton(&lock_path, &port_path)?;
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    listener.set_nonblocking(true)?;
    std::fs::write(&port_path, listener.local_addr()?.port().to_string())?;

    let status = BridgeStatus::bootstrap(config, startup_source);
    let runtime_state = Arc::new(Mutex::new(BridgeRuntimeState {
        config: config.clone(),
        status: status.clone(),
    }));
    let supervision = Arc::new(Mutex::new(BridgeSupervision::new(
        status.mode,
        DEFAULT_HEARTBEAT_TIMEOUT,
        Instant::now(),
    )));
    let runtime_state_for_thread = Arc::clone(&runtime_state);
    let supervision_for_thread = Arc::clone(&supervision);
    let (shutdown_tx, shutdown_rx) = channel::<()>();
    let shutdown_tx_for_thread = shutdown_tx.clone();

    let server_thread = thread::spawn(move || -> Result<(), BridgeIpcError> {
        loop {
            match listener.accept() {
                Ok((stream, _addr)) => handle_stream(
                    stream,
                    &runtime_state_for_thread,
                    &supervision_for_thread,
                    &shutdown_tx_for_thread,
                )?,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    match shutdown_rx.try_recv() {
                        Ok(()) | Err(TryRecvError::Disconnected) => return Ok(()),
                        Err(TryRecvError::Empty) => {
                            if let Some(_exit_reason) =
                                supervision_exit_reason(&supervision_for_thread)?
                            {
                                return Ok(());
                            }
                            thread::sleep(Duration::from_millis(50));
                        }
                    }
                }
                Err(error) => return Err(error.into()),
            }
        }
    });

    Ok(BridgeRuntime {
        status,
        supervision,
        shutdown_tx: Some(shutdown_tx),
        server_thread: Some(server_thread),
        _singleton_guard: singleton_guard,
    })
}

#[cfg(not(any(unix, windows)))]
fn bootstrap_platform_ipc(
    _config: &BridgeConfig,
    _startup_source: BridgeStartupSource,
) -> Result<BridgeRuntime, BridgeIpcError> {
    Err(BridgeIpcError::UnsupportedPlatform)
}

#[cfg(unix)]
fn probe_platform_bridge_status() -> Result<Option<BridgeStatus>, BridgeIpcError> {
    match send_platform_request::<BridgeStatus, Value>("status", &Value::Null) {
        Ok(status) => Ok(Some(status)),
        Err(BridgeIpcError::Io(error)) if is_bridge_unreachable(&error) => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(windows)]
fn probe_platform_bridge_status() -> Result<Option<BridgeStatus>, BridgeIpcError> {
    match send_request_to_tcp::<BridgeStatus, Value>(&bridge_port_path(), "status", &Value::Null) {
        Ok(status) => Ok(Some(status)),
        Err(BridgeIpcError::Io(error)) if is_bridge_unreachable(&error) => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(not(any(unix, windows)))]
fn probe_platform_bridge_status() -> Result<Option<BridgeStatus>, BridgeIpcError> {
    Err(BridgeIpcError::UnsupportedPlatform)
}

#[cfg(unix)]
fn request_platform_bridge_shutdown() -> Result<(), BridgeIpcError> {
    let _: Value = send_platform_request("shutdown", &Value::Null)?;
    Ok(())
}

#[cfg(windows)]
fn request_platform_bridge_shutdown() -> Result<(), BridgeIpcError> {
    let _: Value = send_request_to_tcp(&bridge_port_path(), "shutdown", &Value::Null)?;
    Ok(())
}

#[cfg(not(any(unix, windows)))]
fn request_platform_bridge_shutdown() -> Result<(), BridgeIpcError> {
    Err(BridgeIpcError::UnsupportedPlatform)
}

#[cfg(unix)]
fn request_platform_bridge_apply_config(
    config: &BridgeConfig,
) -> Result<BridgeApplyConfigIpcResult, BridgeIpcError> {
    send_platform_request("apply_config", config)
}

#[cfg(windows)]
fn request_platform_bridge_apply_config(
    config: &BridgeConfig,
) -> Result<BridgeApplyConfigIpcResult, BridgeIpcError> {
    send_request_to_tcp(&bridge_port_path(), "apply_config", config)
}

#[cfg(not(any(unix, windows)))]
fn request_platform_bridge_apply_config(
    _config: &BridgeConfig,
) -> Result<BridgeApplyConfigIpcResult, BridgeIpcError> {
    Err(BridgeIpcError::UnsupportedPlatform)
}

#[cfg(unix)]
fn request_platform_bridge_next() -> Result<PowerPointCommandResult, BridgeIpcError> {
    send_platform_request("next", &Value::Null)
}

#[cfg(windows)]
fn request_platform_bridge_next() -> Result<PowerPointCommandResult, BridgeIpcError> {
    send_request_to_tcp(&bridge_port_path(), "next", &Value::Null)
}

#[cfg(not(any(unix, windows)))]
fn request_platform_bridge_next() -> Result<PowerPointCommandResult, BridgeIpcError> {
    Err(BridgeIpcError::UnsupportedPlatform)
}

#[cfg(unix)]
fn request_platform_bridge_previous() -> Result<PowerPointCommandResult, BridgeIpcError> {
    send_platform_request("previous", &Value::Null)
}

#[cfg(windows)]
fn request_platform_bridge_previous() -> Result<PowerPointCommandResult, BridgeIpcError> {
    send_request_to_tcp(&bridge_port_path(), "previous", &Value::Null)
}

#[cfg(not(any(unix, windows)))]
fn request_platform_bridge_previous() -> Result<PowerPointCommandResult, BridgeIpcError> {
    Err(BridgeIpcError::UnsupportedPlatform)
}

#[cfg(unix)]
fn acquire_singleton(
    socket_path: &Path,
    lock_path: &Path,
) -> Result<SingletonGuard, BridgeIpcError> {
    match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(lock_path)
    {
        Ok(_file) => Ok(SingletonGuard {
            artifacts: vec![socket_path.to_path_buf(), lock_path.to_path_buf()],
        }),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            if bridge_server_responds(socket_path) {
                Err(BridgeIpcError::AlreadyRunning(socket_path.to_path_buf()))
            } else {
                let _ = remove_file(socket_path);
                let _ = remove_file(lock_path);
                OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(lock_path)?;
                Ok(SingletonGuard {
                    artifacts: vec![socket_path.to_path_buf(), lock_path.to_path_buf()],
                })
            }
        }
        Err(error) => Err(error.into()),
    }
}

#[cfg(unix)]
fn bridge_server_responds(socket_path: &Path) -> bool {
    send_request_to_socket::<Value, Value>(socket_path, "ping", &Value::Null)
        .map(|response| response["message"] == "pong")
        .unwrap_or(false)
}

#[cfg(windows)]
fn acquire_windows_singleton(
    lock_path: &Path,
    port_path: &Path,
) -> Result<SingletonGuard, BridgeIpcError> {
    match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(lock_path)
    {
        Ok(_file) => Ok(SingletonGuard {
            artifacts: vec![port_path.to_path_buf(), lock_path.to_path_buf()],
        }),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            if bridge_server_responds_on_tcp(port_path) {
                Err(BridgeIpcError::AlreadyRunning(port_path.to_path_buf()))
            } else {
                let _ = remove_file(port_path);
                let _ = remove_file(lock_path);
                OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(lock_path)?;
                Ok(SingletonGuard {
                    artifacts: vec![port_path.to_path_buf(), lock_path.to_path_buf()],
                })
            }
        }
        Err(error) => Err(error.into()),
    }
}

#[cfg(windows)]
fn bridge_server_responds_on_tcp(port_path: &Path) -> bool {
    send_request_to_tcp::<Value, Value>(port_path, "ping", &Value::Null)
        .map(|response| response["message"] == "pong")
        .unwrap_or(false)
}

fn handle_stream<S>(
    mut stream: S,
    runtime_state: &Arc<Mutex<BridgeRuntimeState>>,
    supervision: &Arc<Mutex<BridgeSupervision>>,
    shutdown_tx: &Sender<()>,
) -> Result<(), BridgeIpcError>
where
    S: Read + Write,
{
    let request = {
        let mut reader = BufReader::new(&mut stream);
        let mut line = String::new();
        reader.read_line(&mut line)?;
        serde_json::from_str::<BridgeRequest>(&line)?
    };

    let response = match request.command.as_str() {
        "ping" => BridgeResponse {
            id: request.id,
            ok: true,
            payload: Some(serde_json::json!({ "message": "pong" })),
            error: None,
        },
        "heartbeat" => {
            let mut supervision = supervision
                .lock()
                .map_err(|_| BridgeIpcError::SupervisionStatePoisoned)?;
            supervision.record_heartbeat(Instant::now());

            BridgeResponse {
                id: request.id,
                ok: true,
                payload: Some(serde_json::json!({ "acknowledged": true })),
                error: None,
            }
        }
        "status" => {
            let status = runtime_state
                .lock()
                .map_err(|_| BridgeIpcError::RuntimeStatePoisoned)?
                .status
                .clone();

            BridgeResponse {
                id: request.id,
                ok: true,
                payload: Some(serde_json::to_value(status)?),
                error: None,
            }
        }
        "next" => handle_powerpoint_command(request.id, runtime_state, PowerPointCommand::Next)?,
        "previous" => {
            handle_powerpoint_command(request.id, runtime_state, PowerPointCommand::Previous)?
        }
        "shutdown" => {
            let _ = shutdown_tx.send(());
            BridgeResponse {
                id: request.id,
                ok: true,
                payload: Some(serde_json::json!({ "acknowledged": true })),
                error: None,
            }
        }
        "apply_config" => {
            let next_config: BridgeConfig = serde_json::from_value(request.payload)?;
            let mut runtime_state = runtime_state
                .lock()
                .map_err(|_| BridgeIpcError::RuntimeStatePoisoned)?;

            let decision = evaluate_config_update(&runtime_state.config, &next_config);
            if decision == BridgeConfigApplyDecision::ApplyLive {
                runtime_state.config = next_config.clone();
                runtime_state.status.target_app = next_config.target_app;
                runtime_state.status.shortcuts_registered = next_config.enabled;
            }

            BridgeResponse {
                id: request.id,
                ok: true,
                payload: Some(serde_json::to_value(BridgeApplyConfigIpcResult {
                    decision,
                    status: runtime_state.status.clone(),
                })?),
                error: None,
            }
        }
        _ => BridgeResponse {
            id: request.id,
            ok: false,
            payload: None,
            error: Some(BridgeResponseError {
                code: "UNKNOWN_COMMAND".into(),
                message: format!("Unknown bridge command: {}", request.command),
            }),
        },
    };

    write_response(&mut stream, &response)?;
    Ok(())
}

fn handle_powerpoint_command(
    request_id: Option<String>,
    runtime_state: &Arc<Mutex<BridgeRuntimeState>>,
    command: PowerPointCommand,
) -> Result<BridgeResponse, BridgeIpcError> {
    let adapter = PowerPointAdapter::new();

    match adapter.dispatch(command) {
        Ok(result) => {
            runtime_state
                .lock()
                .map_err(|_| BridgeIpcError::RuntimeStatePoisoned)?
                .status
                .adapter_healthy = true;

            Ok(BridgeResponse {
                id: request_id,
                ok: true,
                payload: Some(serde_json::to_value(result)?),
                error: None,
            })
        }
        Err(error) => {
            runtime_state
                .lock()
                .map_err(|_| BridgeIpcError::RuntimeStatePoisoned)?
                .status
                .adapter_healthy = false;

            Ok(BridgeResponse {
                id: request_id,
                ok: false,
                payload: None,
                error: Some(BridgeResponseError {
                    code: "POWERPOINT_ADAPTER_ERROR".into(),
                    message: error.to_string(),
                }),
            })
        }
    }
}

fn supervision_exit_reason(
    supervision: &Arc<Mutex<BridgeSupervision>>,
) -> Result<Option<BridgeSupervisionExitReason>, BridgeIpcError> {
    let supervision = supervision
        .lock()
        .map_err(|_| BridgeIpcError::SupervisionStatePoisoned)?;
    Ok(supervision.exit_reason(Instant::now()))
}

#[cfg(unix)]
fn send_platform_request<T, P>(command: &str, payload: &P) -> Result<T, BridgeIpcError>
where
    T: DeserializeOwned,
    P: Serialize,
{
    send_request_to_socket(&bridge_socket_path(), command, payload)
}

#[cfg(unix)]
fn send_request_to_socket<T, P>(
    socket_path: &Path,
    command: &str,
    payload: &P,
) -> Result<T, BridgeIpcError>
where
    T: DeserializeOwned,
    P: Serialize,
{
    use std::os::unix::net::UnixStream;

    let mut stream = UnixStream::connect(socket_path)?;
    let request = BridgeRequest {
        id: Some(command.into()),
        command: command.into(),
        payload: serde_json::to_value(payload)?,
    };
    write_request(&mut stream, &request)?;
    let response = read_response(stream)?;
    decode_response(response)
}

#[cfg(windows)]
fn send_request_to_tcp<T, P>(
    port_path: &Path,
    command: &str,
    payload: &P,
) -> Result<T, BridgeIpcError>
where
    T: DeserializeOwned,
    P: Serialize,
{
    let port = std::fs::read_to_string(port_path)?
        .trim()
        .parse::<u16>()
        .map_err(|error| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("invalid bridge port file: {error}"),
            )
        })?;

    let mut stream = std::net::TcpStream::connect(("127.0.0.1", port))?;
    let request = BridgeRequest {
        id: Some(command.into()),
        command: command.into(),
        payload: serde_json::to_value(payload)?,
    };
    write_request(&mut stream, &request)?;
    let response = read_response(stream)?;
    decode_response(response)
}

fn read_response<R>(stream: R) -> Result<BridgeResponse, BridgeIpcError>
where
    R: Read,
{
    let mut line = String::new();
    let mut reader = BufReader::new(stream);
    reader.read_line(&mut line)?;
    Ok(serde_json::from_str::<BridgeResponse>(&line)?)
}

fn decode_response<T>(response: BridgeResponse) -> Result<T, BridgeIpcError>
where
    T: DeserializeOwned,
{
    if response.ok {
        serde_json::from_value(response.payload.unwrap_or(Value::Null)).map_err(Into::into)
    } else {
        let error = response.error.unwrap_or(BridgeResponseError {
            code: "UNKNOWN".into(),
            message: "Bridge request failed without an error payload".into(),
        });
        Err(BridgeIpcError::RequestFailed {
            code: error.code,
            message: error.message,
        })
    }
}

fn is_bridge_unreachable(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::NotFound
            | std::io::ErrorKind::ConnectionRefused
            | std::io::ErrorKind::ConnectionAborted
            | std::io::ErrorKind::BrokenPipe
            | std::io::ErrorKind::InvalidData
    )
}

fn write_request<W>(stream: &mut W, request: &BridgeRequest) -> Result<(), BridgeIpcError>
where
    W: Write,
{
    let encoded = serde_json::to_vec(request)?;
    stream.write_all(&encoded)?;
    stream.write_all(b"\n")?;
    stream.flush()?;
    Ok(())
}

fn write_response<W>(stream: &mut W, response: &BridgeResponse) -> Result<(), BridgeIpcError>
where
    W: Write,
{
    let encoded = serde_json::to_vec(response)?;
    stream.write_all(&encoded)?;
    stream.write_all(b"\n")?;
    stream.flush()?;
    Ok(())
}

impl Drop for BridgeRuntime {
    fn drop(&mut self) {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            let _ = shutdown_tx.send(());
        }

        if let Some(server_thread) = self.server_thread.take() {
            let _ = server_thread.join();
        }
    }
}
