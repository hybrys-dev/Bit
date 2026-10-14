mod sidecar;
mod window;

use sidecar::SIDECAR_NAME;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use window::{CompanionWindow, COMPANION_LABEL};

struct SidecarState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

#[derive(Debug)]
struct ShellError(String);

impl std::fmt::Display for ShellError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for ShellError {}

fn apply_placeholder(window: &tauri::WebviewWindow) -> Result<(), ShellError> {
    let config = CompanionWindow::placeholder();
    window
        .set_always_on_top(config.always_on_top)
        .map_err(|error| ShellError(error.to_string()))?;
    window
        .set_decorations(config.decorations)
        .map_err(|error| ShellError(error.to_string()))?;
    window
        .set_ignore_cursor_events(config.click_through)
        .map_err(|error| ShellError(error.to_string()))?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(
            f64::from(config.width),
            f64::from(config.height),
        )))
        .map_err(|error| ShellError(error.to_string()))?;
    Ok(())
}

fn start_sidecar(app: &tauri::AppHandle) -> Result<(), ShellError> {
    let sidecar = app
        .shell()
        .sidecar(SIDECAR_NAME)
        .map_err(|error| ShellError(error.to_string()))?;
    let (mut events, child) = sidecar
        .spawn()
        .map_err(|error| ShellError(error.to_string()))?;
    app.manage(SidecarState {
        child: Mutex::new(Some(child)),
    });
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(_) => {}
                CommandEvent::Stderr(bytes) => {
                    if let Ok(text) = String::from_utf8(bytes) {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            eprintln!("bitd: {trimmed}");
                        }
                    }
                }
                CommandEvent::Error(error) => eprintln!("bitd sidecar error: {error}"),
                CommandEvent::Terminated(payload) => {
                    eprintln!(
                        "bitd sidecar exited: code={:?} signal={:?}",
                        payload.code, payload.signal
                    );
                }
                _ => {}
            }
        }
    });
    Ok(())
}

fn stop_sidecar(app: &tauri::AppHandle) {
    let Some(state) = app.try_state::<SidecarState>() else {
        return;
    };
    let Ok(mut child) = state.child.lock() else {
        return;
    };
    if let Some(child) = child.take() {
        let _ = child.kill();
    }
}

pub fn run() -> Result<(), String> {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app
                .get_webview_window(COMPANION_LABEL)
                .ok_or_else(|| ShellError("companion window is missing".to_string()))?;
            apply_placeholder(&window)?;
            start_sidecar(app.handle())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .map_err(|error| error.to_string())?;
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            stop_sidecar(app_handle);
        }
    });
    Ok(())
}
