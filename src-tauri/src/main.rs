//! Desktop entry point (Tauri). Replaces main.py + server.py: the page in web/ is embedded in the exe and
//! shown in the system WebView2. All the actual viewer logic lives in web/static/*.js.
//!
//! usage: asset-viewer [model.glb] [--debug]

// no console window in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod protocol;
mod startup;

use startup::StartupFiles;
use tauri::{Manager, Theme, WebviewUrl, WebviewWindowBuilder};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // inspect the page with the dev tools, and expose window.viewer in its console (viewer.js)
    let debug = args.iter().any(|a| a == "--debug");

    tauri::Builder::default()
        .manage(StartupFiles(startup::startup_files(&args)))
        // files can be large, so they are read off the main thread
        .register_asynchronous_uri_scheme_protocol("av", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let path = request.uri().path().to_owned();
            std::thread::spawn(move || {
                let hdri_dir = app.path().resource_dir().map(|dir| dir.join("hdri")).unwrap_or_default();
                let files = &app.state::<StartupFiles>().0;
                responder.respond(protocol::respond(&path, files, &hdri_dir));
            });
        })
        .setup(move |app| {
            let mut window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Asset Viewer")
                .inner_size(1280.0, 780.0)
                .min_inner_size(640.0, 420.0)
                // the page starts dark; shell.js keeps the title bar in step after that
                .theme(Some(Theme::Dark))
                // hidden until the page has drawn its first frame (shell.js shows it), so there is no white
                // flash of the empty webview at startup
                .visible(false)
                // let the page handle drops itself (files and whole folders, dragdrop.js)
                .disable_drag_drop_handler();
            if debug {
                window = window.initialization_script("window.__AV_DEBUG__ = true;");
            }
            let window = window.build()?;
            if debug {
                window.open_devtools();
            }
            // in case the page never gets to show the window (a script error), show it anyway
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                let _ = window.show();
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running asset viewer");
}
