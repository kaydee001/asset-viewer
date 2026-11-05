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
- Tests (pytest) and a GitHub Actions workflow, sample models in `samples/`

### Changed
- The light angle slider turns the HDRI lighting and the key light together; the key light is aimed from the HDRI's brightest region
- Panning is part of the normal controls (right mouse button or shift + left drag) instead of a switch
- Shadows and the custom background colour are gone
- `ui.js` split into `ui.js`, `shortcuts.js`, `dragdrop.js` and `settings.js`, stats moved to `stats.js`
- Vertex count no longer merges every mesh just to count; the redundant "faces" row is gone
- Phong (OBJ/MTL) materials keep normal maps, opacity, sidedness and vertex colors, and shininess maps to roughness
- `pyinstaller` moved to `requirements-dev.txt`

### Fixed
- The model is centred in the free space between the side panels, not in the whole window
- The bounding box is drawn with visible edges (and works for the default cube); axes are now ground lines plus a corner gizmo instead of a 1 unit helper hidden inside the model
- Auto rotate stops immediately when switched off, and panning can no longer carry the camera under the grid
- Dark / light mode now also switches the grid colours and the native title bar
- A missing or broken HDRI now shows a message instead of failing silently
- Uploaded HDRI blob URLs are released after loading
- `/startup-file/<n>` returns 404 instead of 500 for an unknown file
- `.gitignore` no longer hides `static/vendor/three/build/`, the Draco decoder, or `hdri/` itself
