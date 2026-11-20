//! The model given on the command line (or by Explorer's "Open with") and the files that go with it.

use std::path::{Path, PathBuf};

/// what counts as a model, and which neighbouring files get loaded along with it
const MODEL_EXTENSIONS: &[&str] = &["glb", "gltf", "fbx", "obj", "stl", "ply", "3mf"];
const SIDECAR_EXTENSIONS: &[&str] = &["bin", "mtl", "png", "jpg", "jpeg", "tga", "webp", "bmp"];

/// the files the page opens on startup, served by index (see protocol.rs) so the page never sends a path
pub struct StartupFiles(pub Vec<PathBuf>);

fn has_extension(path: &Path, extensions: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| extensions.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// the first model among the arguments, then its neighbours (.bin, .mtl, textures) sorted by name
pub fn startup_files(args: &[String]) -> Vec<PathBuf> {
    let Some(model) = args
        .iter()
        .map(Path::new)
        .find(|p| p.is_file() && has_extension(p, MODEL_EXTENSIONS))
    else {
        return Vec::new();
    };
    let model = std::path::absolute(model).unwrap_or_else(|_| model.to_path_buf());
    let mut files = vec![model.clone()];
    if let Some(folder) = model.parent() {
        let mut sidecars: Vec<PathBuf> = std::fs::read_dir(folder)
            .into_iter()
            .flatten()
            .flatten()
            .map(|entry| entry.path())
            .filter(|p| *p != model && p.is_file() && has_extension(p, SIDECAR_EXTENSIONS))
            .collect();
        sidecars.sort();
        files.extend(sidecars);
    }
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("asset-viewer-test-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }

        fn touch(&self, name: &str) -> String {
            let path = self.0.join(name);
            std::fs::write(&path, b"x").unwrap();
            path.to_string_lossy().into_owned()
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn names(files: &[PathBuf]) -> Vec<String> {
        let mut names: Vec<String> = files.iter().map(|f| f.file_name().unwrap().to_string_lossy().into_owned()).collect();
        names.sort();
        names
    }

    #[test]
    fn collects_the_model_and_its_sidecars() {
        let dir = TempDir::new("sidecars");
        let model = dir.touch("car.gltf");
        dir.touch("car.bin");
        dir.touch("paint.PNG");
        dir.touch("notes.txt"); // not a sidecar type
        let files = startup_files(&[model.clone()]);
        assert_eq!(files[0], std::path::absolute(&model).unwrap());
        assert_eq!(names(&files), ["car.bin", "car.gltf", "paint.PNG"]);
    }

    #[test]
    fn ignores_arguments_that_are_not_models() {
        let dir = TempDir::new("not-models");
        let missing = dir.0.join("missing.glb").to_string_lossy().into_owned();
        assert!(startup_files(&["--debug".into(), missing]).is_empty());
        assert!(startup_files(&[dir.touch("readme.txt")]).is_empty());
    }

    #[test]
    fn newer_formats_are_accepted() {
        let dir = TempDir::new("formats");
        for name in ["a.stl", "b.ply", "c.3mf"] {
            assert!(startup_files(&[dir.touch(name)])[0].ends_with(name));
        }
    }

    #[test]
    fn only_the_first_model_argument_is_opened() {
        let dir = TempDir::new("first");
        let first = dir.touch("a.glb");
        let second = dir.touch("b.glb");
        assert_eq!(startup_files(&[first.clone(), second])[0], std::path::absolute(&first).unwrap());
    }

    #[test]
    fn extension_match_is_case_insensitive() {
        let dir = TempDir::new("case");
        assert!(!startup_files(&[dir.touch("SHIP.GLB")]).is_empty());
    }
}
