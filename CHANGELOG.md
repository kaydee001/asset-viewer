# Changelog

## Unreleased

### Added
- STL, PLY and 3MF support, KTX2 (basis) compressed textures in GLB/GLTF
- Light angle and exposure sliders
- Bounding box (`B`) and axes (`X`) overlays
- Vertex colors shading mode
- Transport bar at the bottom of the viewport (play/pause, seek, time, clip, speed, loop; Space toggles playback), greyed out when the model has no animation
- Keyboard shortcuts overlay (`?`)
- Orthographic / perspective switch (`P`)
- Screenshot at 2x / 4x resolution, optionally with the background
- Parts list is now the node tree; click a mesh to see its materials and textures
- Cameras stored in glTF files can be selected
- Tests (`cargo test`) and a GitHub Actions workflow, sample models in `samples/`
- Frame rate readout in the top right corner of the viewport while an animation plays
- New desktop shell built on Tauri 2 (`src-tauri/`), replacing the PyQt5 + Flask one: the page runs in the system's WebView2 (current Chromium) instead of QtWebEngine's Chromium 83, the exe is about 4 MB with the page embedded, an NSIS installer adds the app to "Open with" for the model types, and the title bar follows the light/dark theme without polling. Python is no longer needed to run or build from source

### Changed
- The page moved from `templates/` and `static/` to `web/`
- Saved settings start fresh once: the Tauri build keeps them apart from the old Python build's
- New interface: the stats and parts list and the settings are docked side panels instead of floating glass cards; the model sits on a neutral grey stage so its colours read true
- One amber accent for the selection, the play button and the seek bar; switches and checkboxes are neutral
- The model info is a spec sheet: format and file size, counts as figures, and the dimensions per axis lettered in the gizmo's X / Y / Z colours
- Lucide line icons at one size, sentence case labels and messages, mono tabular figures, readable texture slot names in the material info
- The axes gizmo is a navigation gizmo in the top right corner, always shown (not only with the axes overlay): hovering highlights it, and clicking an axis ball turns the view to look along that axis, as in Blender. The grid's centre line is neutral grey
- Keyboard focus rings show only while navigating with the keyboard
- Frames are drawn only when something changes (camera, a playing clip, a setting, a load) instead of every frame, so an idle viewer leaves the GPU alone
- While the camera or a clip moves the view renders at screen resolution; the 2x-3x supersampled frame follows once it settles
- The bounding box is measured once per model instead of every frame (every frame only while a clip plays)
- Counting unique vertices of unindexed models (STL, OBJ, FBX) is about 6x faster, and loading walks the geometry fewer times
- The renderer asks for the dedicated GPU on laptops that have two
- Parts list and model info (under it) are on the left, scene settings on the right, each panel with a heading; settings are grouped into Camera, Overlays (grid, axes, bounding box), Shading (with wireframe) and Lighting
- Theme toggle moved to an icon in the top bar; light mode is a softer mid grey and switching fades instead of flashing
- Dropdowns are drawn in the app's own style (keyboard friendly) instead of the native Windows list
- New lighting presets from Poly Haven (CC0, 2k): studio soft boxes, photo studio, loft window light, warehouse, overcast sky, sunset
- Screenshot controls are hidden for now (the code is kept)
- Every lighting preset is evened out to the same average brightness, so switching presets no longer needs an exposure change; an exposure saved for the old presets is reset once. Double click a slider to reset it


### Fixed
- The grid and wireframe no longer brighten while the camera moves and dim when it stops: both are drawn by shaders with a line width in screen pixels, so they look the same in the 1x frame drawn while moving and the supersampled still frame, and their lines are antialiased
- Wireframe is one flat colour whatever the shading mode (light grey on the dark theme, dark grey on the light one); the shading mode comes back when it is turned off
- No white flash when the Tauri window opens: it stays hidden until the page has drawn its first frame
- Flickering surfaces in orthographic view: the near and far planes now follow the far-away orthographic camera
- Grid, axes, gizmo and bounding box keep their exact colours instead of being tone mapped and washed out by the lighting and exposure
- The light angle slider turns the HDRI lighting and the key light together; the key light is aimed from the HDRI's brightest region
- Panning is part of the normal controls (right mouse button or shift + left drag) instead of a switch
- Shadows and the custom background colour are gone
- `ui.js` split into `ui.js`, `shortcuts.js`, `dragdrop.js` and `settings.js`, stats moved to `stats.js`
- Vertex count no longer merges every mesh just to count; the redundant "faces" row is gone
- Phong (OBJ/MTL) materials keep normal maps, opacity, sidedness and vertex colors, and shininess maps to roughness
- `pyinstaller` moved to `requirements-dev.txt`

- The model is centred in the free space between the side panels, not in the whole window
- The bounding box is drawn with visible edges (and works for the default cube); axes are now ground lines plus a corner gizmo instead of a 1 unit helper hidden inside the model
- Auto rotate stops immediately when switched off, and panning can no longer carry the camera under the grid
- Dark / light mode now also switches the grid colours and the native title bar
- A missing or broken HDRI now shows a message instead of failing silently
- Uploaded HDRI blob URLs are released after loading
- `/startup-file/<n>` returns 404 instead of 500 for an unknown file
- `.gitignore` no longer hides `static/vendor/three/build/`, the Draco decoder, or `hdri/` itself
