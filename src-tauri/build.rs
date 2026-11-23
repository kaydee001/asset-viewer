use std::{env, fs, path::Path};

fn main() {
    tauri_build::build();
    if env::var_os("CARGO_FEATURE_PORTABLE").is_some() {
        embed_hdris();
    }
}

/// The portable exe has no hdri folder next to it, so the maps are built in: this writes the list
/// that protocol.rs includes, one (file name, bytes) entry per .hdr in ../hdri
fn embed_hdris() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("hdri");
    println!("cargo:rerun-if-changed={}", dir.display());
    let mut names: Vec<String> = fs::read_dir(&dir)
        .expect("the portable build needs the hdri folder (see CONTRIBUTING.md)")
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .filter(|name| name.ends_with(".hdr"))
        .collect();
    assert!(!names.is_empty(), "the portable build needs the HDRI files in hdri/ (see CONTRIBUTING.md)");
    names.sort();
    let entries: String = names
        .iter()
        .map(|name| format!("    ({name:?}, include_bytes!({:?})),\n", dir.join(name).display().to_string()))
        .collect();
    let out = Path::new(&env::var("OUT_DIR").unwrap()).join("hdris.rs");
    fs::write(out, format!("pub const HDRIS: &[(&str, &[u8])] = &[\n{entries}];\n")).unwrap();
}
