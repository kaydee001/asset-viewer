# Contributing

Asset Viewer is a [three.js](https://threejs.org) page inside a [Tauri 2](https://tauri.app) shell, using the system's WebView2. The page is plain ES modules with no bundler or build step.

## Setup

You need Windows 10 or 11, [Rust](https://rustup.rs) with the Visual Studio C++ Build Tools, and [Node.js](https://nodejs.org) for the Tauri CLI.

```bash
npm install
npm run dev
```

The HDRI presets aren't in the repository. Download these 2k `.hdr` files from [Poly Haven](https://polyhaven.com/hdris) into `hdri/`, named like `studio_small_09_2k.hdr`: `studio_small_09`, `brown_photostudio_02`, `photo_studio_loft_hall`, `empty_warehouse_01`, `kloofendal_overcast_puresky` and `venice_sunset`. Without them the viewer falls back to built-in room lighting.

To pass arguments to the app in dev mode, put them after three `--`. Paths must be absolute, because the app runs from `src-tauri/`:

```bash
npm run dev -- -- -- D:/code/asset-viewer/samples/cube.glb --debug
```

`--debug` opens the developer tools and exposes `window.viewer` (scene, camera, renderer, controls) in their console. `samples/` has a few tiny models to try: `cube.glb` (with an animation and a camera), `pyramid.stl`, `triangle.ply` and `tetra.3mf`.

## Tests and checks

```bash
cd src-tauri
cargo test                                # the av protocol, startup files, and the model types matching across Rust, JS and the installer
cargo clippy --all-targets -- -D warnings
cargo fmt --check                         # 120 columns, see rustfmt.toml
```

CI (`.github/workflows/tests.yml`) runs all three on every push. The page itself has no automated tests, so check changes in the running app.

## Building

```bash
npm run build
```

This produces `src-tauri/target/release/asset-viewer.exe`, with the page embedded in it, and an installer in `src-tauri/target/release/bundle/nsis/`. The installer puts the `hdri/` folder next to the exe and registers the file associations.

To change the app icon, edit `src-tauri/icons/app-icon.svg`, then run `npx tauri icon src-tauri/icons/app-icon.svg -o <folder>` and copy over the files listed under `bundle.icon` in `tauri.conf.json`, plus `icon.png`.

## How it works

The Tauri shell (`src-tauri/`) embeds the page from `web/` in the exe and shows it in a WebView2 window. A small `av` protocol (`protocol.rs`, which the page reaches at `http://av.localhost`) serves only two things: the HDRI presets, and a model passed on the command line. Everything else happens in the page, and `web/static/shell.js` is the only script that talks to the shell.

When you open a file:

1. `dragdrop.js` collects the files, including everything inside dropped folders.
2. `loader.js` parses the model with the loader for its extension, and finds its `.bin`, `.mtl` and texture files by name among the same files.
3. The previous model is freed. The new one is scaled so its longest side is 4 units, and placed on the grid.
4. The stats, parts tree and animations are filled in.

A few details that aren't obvious from the code:

- **On-demand rendering.** Frames are drawn only when something changes. While the view moves it renders at screen resolution; a supersampled frame follows once it settles.
- **Light angle.** three.js r150 can't rotate an environment map, so the app keeps a 1024 px wide copy of the HDRI and shifts it sideways. The key light is aimed from the HDRI's brightest region and turns with it.
- **Orthographic.** The orthographic view is the same perspective camera with a 1 degree field of view, moved far back, so the orbit controls, framing and panel offset keep working unchanged.

## Project structure

```
src-tauri/
  src/main.rs           window, --debug, registers the av protocol
  src/startup.rs        finds the model given on the command line and its sidecar files (with tests)
  src/protocol.rs       the av protocol: /hdri/*, /startup-files (with tests)
  tauri.conf.json       window, bundle, file associations, bundled hdri/ folder
  capabilities/         what the page may ask of the window (theme, title, show)
  icons/                app-icon.svg is the source; the PNGs and icon.ico are generated from it
samples/                tiny test models
web/index.html          the whole page; the scripts find elements by the ids in here
web/static/
  viewer.js             entry point: imports everything, runs the render loop
  shell.js              the link to the Tauri shell: startup files, HDRI urls, title bar theme

  scene.js              scene, camera, renderer, key light, grid, HDRI loading and rotation
  controls.js           orbit controls, their limits and the grid lock
  overlays.js           bounding box, ground axes and the navigation gizmo
  viewmodes.js          shading modes and the wireframe, done by swapping materials
  layout.js             keeps the model centred between the side panels

  loader.js             the supported formats; loads a model, scales and centres it
  dragdrop.js           drag and drop, the Open button, the command-line file
  animation.js          clip picker, scrubber, speed, loop, play / pause
  outliner.js           the parts tree and the material readout
  stats.js              the model info (format, counts, dimensions)

  ui.js                 the scene panel's switches, sliders and buttons
  dropdown.js           styled stand-ins for the native <select> menus
  shortcuts.js          keyboard shortcuts, tooltips and the shortcut list
  settings.js           remembers the settings between launches
  toast.js              status messages and the loading bar
  fps.js                frame rate readout while a clip plays
  util.js               small shared helpers
  style.css             all styling: graphite panels, one amber accent, dark / light themes
  vendor/three/         three.js r150 and the loaders it needs
```

The modules sit in one flat folder on purpose: at this size, the groups above are easier to follow than subfolders.

## Making changes

- **New shortcut or toggle:** add the button in `index.html`, wire it up in `ui.js`, and add the key to `shortcuts` in `shortcuts.js`.
- **New shading mode:** add an `<option>` in `index.html` and a material to `overrides` in `viewmodes.js`.
- **New HDRI preset:** add an `<option>` in `index.html` whose value is the file name in `hdri/`.
- **New file format:** add its loader to `FORMATS` in `loader.js`; the drop hint and the "not supported" message follow from it. Also add the extension to `MODEL_EXTENSIONS` in `src-tauri/src/startup.rs` and to `fileAssociations` in `tauri.conf.json`. `cargo test` fails if the three lists differ.
- **New saved setting:** add it to `saveSettings()` in `settings.js`, and restore it further down in the same file.

Planned work is in [TODO.md](TODO.md), and past changes are in [CHANGELOG.md](CHANGELOG.md).
