# Asset Viewer

A lightweight 3D model viewer that runs locally. Drop in a GLB, GLTF, FBX, OBJ, STL, PLY or 3MF file and inspect it. Nothing is uploaded and there are no accounts.

![Screenshot](screenshot.png)

## Features

- Drag and drop loading for files or whole folders, plus an Open button
- GLB, GLTF, FBX, OBJ, STL, PLY and 3MF support, including Draco, meshopt and KTX2 compressed GLBs
- External `.bin`, `.mtl` and texture files are picked up from the dropped set
- One asset per session: loading a new model replaces the current one
- Animation playback for GLB / FBX clips, with scrubber, speed and loop
- Shading modes: shaded, clay, normals, UV checker and vertex colors
- Parts tree with per-mesh triangle counts and show/hide, plus a material and texture readout
- Mesh stats: objects, materials, vertices, faces, triangles, dimensions and file size
- HDRI lighting with built-in presets and custom upload, light angle and exposure controls
- Bounding box and axes overlays (ground axis lines plus a corner gizmo)
- Cameras stored in glTF files can be selected
- Orbit controls (right mouse button or shift + left drag pans) with auto rotate and bottom lock, and an orthographic / perspective switch
- Wireframe, grid, light/dark theme and PNG screenshot (up to 4x resolution, with or without background)
- Open from the command line or Explorer's "Open with"
- Dark mode by default, with settings remembered between launches
- Works offline, since three.js is bundled and there is no CDN

## Download

Grab the latest build from the [releases page](../../releases). No Python required.

## Run from source

Requires Python 3 on Windows (the UI is styled for Windows 11).

```bash
pip install -r requirements.txt
python main.py [model.glb] [--debug]
```

The `samples/` folder has a few tiny models to try it with, for example `python main.py samples/cube.glb`.

- Pass a model path to open it on startup. Neighbouring `.bin`, `.mtl` and texture files in the same folder are loaded with it.
- `--debug` opens the Chromium dev tools port, so you can inspect the app at http://localhost:9222. It also exposes `window.viewer` (scene, camera, renderer, controls) in the console.

### HDRIs

HDRI files are not committed. Put `.hdr` files named `hdri_1.hdr` to `hdri_5.hdr` in an `hdri/` folder (the names match the dropdown in `templates/index.html`). Without them, built-in room lighting is used.

### Tests

```bash
pip install -r requirements-dev.txt
python -m pytest
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `W` | Toggle wireframe |
| `G` | Toggle grid |
| `R` | Toggle auto rotate |
| `P` | Toggle orthographic / perspective |
| `B` | Toggle bounding box |
| `X` | Toggle axes |
| `F` | Reset view |
| `S` | Save screenshot |
| `O` | Open file |
| `T` | Toggle light/dark theme |
| `H` | Hide / show interface |

## Build the exe

```bash
pyinstaller --noconfirm --onedir --windowed --name "asset-viewer" --add-data "templates;templates" --add-data "static;static" --add-data "hdri;hdri" main.py
```

The output ends up in `dist/asset-viewer/`. PyInstaller comes from `requirements-dev.txt`.

## How it works

`main.py` starts a small Flask server on a background thread and opens it in a PyQt5 window (an embedded Chromium). The server only hands out the page, the static files, the HDRIs and any model passed on the command line. Everything else happens in the browser: dropped files are read locally and parsed by three.js, and nothing leaves your machine.

The Qt WebEngine that ships with PyQt5 is an old Chromium (83), so there is no CSS `gap` on flexbox and no `:has()`. Keep that in mind when editing the CSS.

The light angle slider turns the lighting around the model. The bundled three.js version can't rotate an HDRI, so the app keeps a 1024 px wide copy of it and shifts the image sideways; the key light is aimed from the brightest part of the HDRI and turns with it. The orthographic switch is the same perspective camera with a 1 degree field of view, moved far back.

When you drop a file:

1. `dragdrop.js` collects the files, including the contents of dropped folders.
2. `loader.js` parses the model and resolves its `.bin` / `.mtl` / textures by file name from the same drop.
3. The old model is disposed. The new one is scaled so its longest side is 4 units and placed on the grid.
4. The stats, parts tree and animations are filled in.

## Project structure

```
main.py                 Qt window, picks a port, finds the sidecar files for a model given on the command line
server.py               Flask routes: page, /hdri/*, /startup-files
templates/index.html    the whole page; the JS looks up elements by the ids in here
samples/                tiny test models (cube.glb with animation and a camera, pyramid.stl, triangle.ply, tetra.3mf)
tests/                  pytest tests for the server and the command line handling
static/
  viewer.js             entry point, imports everything and runs the render loop
  scene.js              scene, camera, renderer, lights, grid, HDRI loading and rotation
  controls.js           orbit controls and their limits
  loader.js             loads a model, scales and centers it
  stats.js              the model info card (counts, size)
  viewmodes.js          shading modes, done by swapping materials
  outliner.js           the parts tree on the left and the material readout
  animation.js          animation clip picker, scrubber, speed, loop, play/pause
  helpers.js            bounding box and axes overlays
  toast.js              status messages and the loading bar
  ui.js                 the view buttons and sliders (wireframe, grid, theme, light angle, projection, screenshot...)
  shortcuts.js          keyboard shortcuts and tooltips
  dragdrop.js           drag and drop, the Open button, the command line file
  settings.js           remembers the settings between launches
  style.css             all styling (Windows 11 look, dark/light via body class)
  vendor/three/         three.js (r150) and the loaders/addons used
```

See [CHANGELOG.md](CHANGELOG.md) for what changed between versions.

## Making changes

- **New shortcut or toggle:** add the button in `index.html`, wire up its click in `ui.js`, and add the key to the `shortcuts` object in `shortcuts.js`.
- **New shading mode:** add an `<option>` in `index.html` and a material to the `overrides` object in `viewmodes.js`.
- **New HDRI preset:** add an `<option>` in `index.html` whose value is the file name in `hdri/`.
- **New file format:** add its loader in `loader.js`, and add the extension to `MODEL_EXTENSIONS` in both `dragdrop.js` and `main.py`.
- **New saved setting:** add it to `saveSettings()` in `settings.js`, and restore it further down in the same file.

## Tech stack

- [three.js](https://threejs.org) for 3D rendering
- [Flask](https://flask.palletsprojects.com) as the local server
- [PyQt5](https://riverbankcomputing.com/software/pyqt/) with QtWebEngine as the desktop wrapper
- [PyInstaller](https://pyinstaller.org) for exe packaging

## License

Released under the [MIT License](LICENSE). three.js is also MIT licensed, and its license is in `static/vendor/three/LICENSE`.
