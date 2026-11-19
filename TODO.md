# To do

## Finish the move to Tauri
The Tauri shell (`src-tauri/`) runs the page and serves the startup files and HDRIs. Saved settings start fresh once (accepted). Still to do:

- Check by hand: a Draco / KTX2 compressed GLB, and an STL from Explorer. (Checked: drag and drop of files and folders, "Open with" for GLB / GLTF / FBX / OBJ; the installer leaves the user's default app for each type alone)
- Installer is 24 MB, 20 of it the six 2k HDRIs: ship 1k ones or download the extra presets on first use if size matters
- Screenshot (hidden for now): WebView2 saves it straight to Downloads; the Python shell asked where. Add a save dialog (the `on_download` hook) before the button comes back
- Then remove the Python shell: `main.py`, `server.py`, `tests/`, the requirements files, the pytest CI job, and the `BACKEND = ""` branch in `web/static/shell.js`
- Once Chromium 83 is gone, the CSS can use flex `gap`, `:focus-visible`, `:is()` and `:has()`
- Later: heavy work in Rust (folder scanning, parsing very large files, thumbnails, batch / headless renders)

## Upgrade three.js
The vendored build is r150.

- Move to the current release: `outputEncoding` / `sRGBEncoding` become `outputColorSpace` / `SRGBColorSpace`, and color management is on by default (recheck the overlay colours in `helpers.js` and the HDRI brightness)
- Environment maps can be rotated natively (`scene.environmentRotation`), which can replace the manual HDRI shifting in `scene.js`
- Try the WebGPU renderer once the shell runs on a current Chromium
- Re-vendor the loaders and decoders (Draco, Basis / KTX2, meshopt) at the same version
- The wireframe material (`viewmodes.js`) patches MeshBasicMaterial's shader at `#include <output_fragment>`, and the grid (`scene.js`) uses `#include <encodings_fragment>`. Both chunks were renamed in r154 (`opaque_fragment`, `colorspace_fragment`)
