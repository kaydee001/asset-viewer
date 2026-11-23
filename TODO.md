# To do

2.0.2 is released (2026-11-23): the portable exe next to the installer. What's left, roughly in order.

## Check by hand
- A Draco and a KTX2 compressed glTF. CC0 test files from the Khronos glTF Sample Assets: the `glTF-Draco` folders of BoomBox, Lantern, WaterBottle, Corset or Avocado, and the `glTF-KTX-BasisU` folder of FlightHelmet
- An STL opened from Explorer with "Open with"
- Once a Draco model loads, `web/static/vendor/three/addons/libs/draco/gltf/draco_decoder.js` (512 KB) can go: it is the asm.js fallback for browsers without WebAssembly, which WebView2 always has

## Desktop app
- Screenshot (hidden for now): WebView2 saves it straight to Downloads. Add a save dialog (the `on_download` hook), then bring back the button, the S shortcut and the Screenshot panel section
- Download size: the installer is 24 MB, 20 of it the six 2k HDRIs, and the portable exe 38 MB (its HDRIs are not compressed). Ship 1k ones, or download the extra presets on first use, if size matters
- Maybe: a "Set as default app" step. Windows doesn't let an app make itself the default, but the installer can open the Default apps page for it (needs a RegisteredApplications / Capabilities entry in the NSIS installer)
- Later: heavy work in Rust (folder scanning, parsing very large files, thumbnails, batch / headless renders)

## Upgrade three.js
The vendored build is r150.

- Move to the current release: `outputEncoding` / `sRGBEncoding` become `outputColorSpace` / `SRGBColorSpace`, and color management is on by default (recheck the overlay colours in `overlays.js` and the HDRI brightness)
- Environment maps can be rotated natively (`scene.environmentRotation`), which can replace the manual HDRI shifting in `scene.js`
- Try the WebGPU renderer (WebView2 is a current Chromium, so it is available)
- Re-vendor the loaders and decoders (Draco, Basis / KTX2, meshopt) at the same version
- The wireframe material (`viewmodes.js`) patches MeshBasicMaterial's shader at `#include <output_fragment>`, and the grid (`scene.js`) uses `#include <encodings_fragment>`. Both chunks were renamed in r154 (`opaque_fragment`, `colorspace_fragment`)

## Later / maybe
- USDZ support: only if real users bring USDZ files (Apple AR, Reality Composer, e-commerce). three.js's `USDZLoader` is experimental, and the r150 version reads only text USDA, while most real files are binary USDC. Do it after the three.js upgrade, with a clear "unsupported USD feature" message and `.usdz` in the installer's "Open with" types. Pipeline USD (`.usd` / `.usda` / `.usdc` with layers, references and variants) is out of scope for a three.js loader
