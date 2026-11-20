# To do

## Before the release (2026-11-20)
- Outliner type icons (`outliner.js`, `style.css`): in the code and shown working in a debug build with a test glTF. They didn't show in the installed copy, which was built before them. Rebuild, reinstall and check with the scene that has lights and areas
- No default cube when opening from Explorer (`main.rs` sets `__AV_OPENING__`, `loader.js`): also needs the reinstall to show
- Maybe: a "Set as default app" step. Windows doesn't let an app make itself the default, but the installer can open the Default apps page for it (needs a RegisteredApplications / Capabilities entry in the NSIS installer)

## Finish the move to Tauri
The Tauri shell (`src-tauri/`) runs the page and serves the startup files and HDRIs. Saved settings start fresh once (accepted). Still to do:

- Check by hand: a Draco / KTX2 compressed GLB, and an STL from Explorer. (Checked: drag and drop of files and folders, "Open with" for GLB / GLTF / FBX / OBJ; the installer leaves the user's default app for each type alone)
- Installer is 24 MB, 20 of it the six 2k HDRIs: ship 1k ones or download the extra presets on first use if size matters
- Screenshot (hidden for now): WebView2 saves it straight to Downloads; the Python shell asked where. Add a save dialog (the `on_download` hook) before the button comes back
- The Python shell is gone, so the CSS can use flex `gap`, `:is()` and `:has()` (Chromium 83 limits no longer apply); check each change by eye
- Later: heavy work in Rust (folder scanning, parsing very large files, thumbnails, batch / headless renders)

## Upgrade three.js
The vendored build is r150.

- Move to the current release: `outputEncoding` / `sRGBEncoding` become `outputColorSpace` / `SRGBColorSpace`, and color management is on by default (recheck the overlay colours in `helpers.js` and the HDRI brightness)
- Environment maps can be rotated natively (`scene.environmentRotation`), which can replace the manual HDRI shifting in `scene.js`
- Try the WebGPU renderer (WebView2 is a current Chromium, so it is available)
- Re-vendor the loaders and decoders (Draco, Basis / KTX2, meshopt) at the same version
- The wireframe material (`viewmodes.js`) patches MeshBasicMaterial's shader at `#include <output_fragment>`, and the grid (`scene.js`) uses `#include <encodings_fragment>`. Both chunks were renamed in r154 (`opaque_fragment`, `colorspace_fragment`)

## Later / maybe
- USDZ support: only if real users bring USDZ files (Apple AR, Reality Composer, e-commerce). three.js's `USDZLoader` is experimental, and the r150 version reads only text USDA, while most real files are binary USDC. Do it after the three.js upgrade, with a clear "unsupported USD feature" message and `.usdz` in the installer's "Open with" types. Pipeline USD (`.usd` / `.usda` / `.usdc` with layers, references and variants) is out of scope for a three.js loader
