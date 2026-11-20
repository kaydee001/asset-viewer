//! The "av" protocol: the files the page can't have embedded (the page itself is in the exe).
//! WebView2 reaches it at http://av.localhost (web/static/shell.js).
//!
//! - /startup-files        JSON list of the startup files: [{"name": "car.glb", "url": "/startup-file/0"}]
//! - /startup-file/<index> one of them, by index, so the page never sends a path of its own
//! - /hdri/<name>          an HDRI map from the hdri folder bundled next to the exe; 404 if it is missing,
//!                         and the page falls back to its built-in room lighting

use percent_encoding::percent_decode_str;
use std::path::{Path, PathBuf};
use tauri::http::{header, Response, StatusCode};

fn reply(status: StatusCode, content_type: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        // the page's own origin is http://tauri.localhost, so these are cross-origin fetches
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap()
}

fn not_found() -> Response<Vec<u8>> {
    reply(StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec())
}

fn file(path: &Path) -> Response<Vec<u8>> {
    match std::fs::read(path) {
        Ok(bytes) => reply(StatusCode::OK, "application/octet-stream", bytes),
        Err(_) => not_found(),
    }
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

pub fn respond(path: &str, startup_files: &[PathBuf], hdri_dir: &Path) -> Response<Vec<u8>> {
    if path == "/startup-files" {
        let items: Vec<_> = startup_files
            .iter()
            .enumerate()
            .map(|(i, p)| serde_json::json!({ "name": file_name(p), "url": format!("/startup-file/{i}") }))
            .collect();
        return reply(StatusCode::OK, "application/json", serde_json::to_vec(&items).unwrap());
    }
    if let Some(index) = path.strip_prefix("/startup-file/") {
        return match index.parse::<usize>().ok().and_then(|i| startup_files.get(i)) {
            Some(p) => file(p),
            None => not_found(),
        };
    }
    if let Some(name) = path.strip_prefix("/hdri/") {
        let Ok(name) = percent_decode_str(name).decode_utf8() else { return not_found() };
        // a plain file name only: no escaping the hdri folder
        if name.is_empty() || name.contains(['/', '\\', ':']) || name.starts_with('.') {
            return not_found();
        }
        return file(&hdri_dir.join(name.as_ref()));
    }
    not_found()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    fn get(path: &str, files: &[PathBuf]) -> Response<Vec<u8>> {
        respond(path, files, &root().join("hdri"))
    }

    #[test]
    fn no_startup_files_by_default() {
        assert_eq!(get("/startup-files", &[]).body(), b"[]");
    }

    #[test]
    fn startup_files_are_listed_and_served() {
        let files = [root().join("samples").join("cube.glb")];
        let list: serde_json::Value = serde_json::from_slice(get("/startup-files", &files).body()).unwrap();
        assert_eq!(list, serde_json::json!([{ "name": "cube.glb", "url": "/startup-file/0" }]));
        assert_eq!(&get("/startup-file/0", &files).body()[..4], b"glTF");
    }

    #[test]
    fn unknown_or_malformed_startup_file_is_404() {
        for path in ["/startup-file/3", "/startup-file/abc", "/startup-file/-1", "/nope"] {
            assert_eq!(get(path, &[]).status(), StatusCode::NOT_FOUND, "{path}");
        }
    }

    #[test]
    fn responses_allow_the_page_origin() {
        assert_eq!(get("/startup-files", &[]).headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN], "*");
    }

    #[test]
    fn hdri_cannot_escape_its_folder() {
        for path in ["/hdri/", "/hdri/../src-tauri/Cargo.toml", "/hdri/..%2Fsrc-tauri%2FCargo.toml", "/hdri/..%5CREADME.md", "/hdri/.gitkeep"] {
            assert_eq!(get(path, &[]).status(), StatusCode::NOT_FOUND, "{path}");
        }
    }

    #[test]
    fn missing_hdri_is_404() {
        assert_eq!(get("/hdri/nope.hdr", &[]).status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn hdri_maps_are_served_when_present() {
        // hdri files are not committed (see readme), so this only checks a clone that has them
        let name = "studio_small_09_2k.hdr";
        if root().join("hdri").join(name).is_file() {
            assert_eq!(get(&format!("/hdri/{name}"), &[]).status(), StatusCode::OK);
        }
    }
}
