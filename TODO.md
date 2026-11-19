# To do

## Move the desktop shell to Tauri
Replace PyQt5 + QtWebEngine (Chromium 83) and the Flask server with [Tauri](https://tauri.app). The page, three.js and the UI stay as they are.

- Runs on the system WebView2 (current Chromium, updated by Windows): no more Chromium 83 limits (flex `gap`, `:focus-visible`, `:is()`, native `<select>` styling, WebGPU)
- Installer around 10 MB instead of a bundled Chromium, faster start, less memory
- Command line open, the startup file list and HDRI serving move from `server.py` / `main.py` to Tauri commands or its asset protocol
- Later: heavy work in Rust (folder scanning, parsing very large files, thumbnails, batch / headless renders)
- Check that saved settings (localStorage) carry over or are migrated

## Upgrade three.js
The vendored build is r150.

- Move to the current release: `outputEncoding` / `sRGBEncoding` become `outputColorSpace` / `SRGBColorSpace`, and color management is on by default (recheck the overlay colours in `helpers.js` and the HDRI brightness)
- Environment maps can be rotated natively (`scene.environmentRotation`), which can replace the manual HDRI shifting in `scene.js`
- Try the WebGPU renderer once the shell runs on a current Chromium
- Re-vendor the loaders and decoders (Draco, Basis / KTX2, meshopt) at the same version
