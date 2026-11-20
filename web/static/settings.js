// settings are remembered between launches (localStorage; the Tauri shell keeps its origin, so it survives restarts).
// to remember a new setting: add it in saveSettings() and restore it in the block below.
// imported last by viewer.js, after every control it restores is wired up
import { setEnvironment, setSunAngle, grid, projection, DEFAULT_HDRI } from './scene.js';
import { controls, isGridLocked } from './controls.js';
import { modelRoot } from './loader.js';
import { applyViewMode } from './viewmodes.js';
import { bboxOverlay, axesOverlay } from './overlays.js';
import { hdriUrl } from './shell.js';
import { isOn, hasOption } from './util.js';
import {
    hdriSelect, shadingSelect, themeBtn, gridBtn, rotateBtn, orthoBtn, bottomLockBtn, bboxBtn, axesBtn,
    sunRange, exposureRange, setExposure, shotScaleSelect, shotBgBtn
} from './ui.js';

const SETTINGS_KEY = "asset-viewer-settings";
// bump when a saved value should not carry over
const SETTINGS_VERSION = 2;
// version 2 brought new lighting presets with even brightness, so an exposure saved for the old ones
// (often turned all the way up) is dropped once
const EXPOSURE_SINCE = 2;

function saveSettings(){
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        version: SETTINGS_VERSION,
        dark: document.body.classList.contains("dark"),
        grid: grid.visible,
        autoRotate: controls.autoRotate,
        ortho: projection.orthographic,
        lock: isGridLocked(),
        hdri: hdriSelect.value,
        shading: shadingSelect.value,
        bbox: bboxOverlay.visible,
        axes: axesOverlay.visible,
        sun: +sunRange.value,
        exposure: +exposureRange.value,
        shotScale: shotScaleSelect.value,
        shotBg: isOn(shotBgBtn)
    }));
}

// save after every change in the scene panel (right) or the top bar (theme), setTimeout lets the click handler flip its state first
for(const id of ["scene-panel", "commandbar"]){
    const panel = document.getElementById(id);
    panel.addEventListener("click", () => setTimeout(saveSettings));
    panel.addEventListener("change", saveSettings);
}

// dark is the default, the saved values only change what differs from it. switches are restored by
// clicking them, so their own handlers apply the change
let saved = {};
try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
} catch(error) {
    console.warn("ignoring unreadable saved settings", error);
}
const version = saved.version || 1;
if(version < EXPOSURE_SINCE) delete saved.exposure;

if(saved.dark === false) themeBtn.click();
if(saved.grid === false) gridBtn.click();
if(saved.autoRotate) rotateBtn.click();
if(saved.ortho) orthoBtn.click();
if(saved.lock === false) bottomLockBtn.click();
if(saved.bbox) bboxBtn.click();
if(saved.axes) axesBtn.click();
if(saved.shotBg) shotBgBtn.click();
if(hasOption(hdriSelect, saved.hdri)){
    hdriSelect.value = saved.hdri;
    if(saved.hdri !== DEFAULT_HDRI) setEnvironment(hdriUrl(saved.hdri));
}
if(hasOption(shadingSelect, saved.shading)){
    shadingSelect.value = saved.shading;
    applyViewMode(modelRoot, saved.shading);
}
if(hasOption(shotScaleSelect, saved.shotScale)) shotScaleSelect.value = saved.shotScale;
if(typeof saved.sun === "number"){
    sunRange.value = saved.sun;
    setSunAngle(saved.sun);
}
if(typeof saved.exposure === "number"){
    exposureRange.value = saved.exposure;
    setExposure(saved.exposure);
}

// settings from an older version: store them in the current form right away (drops the old exposure)
if(version < SETTINGS_VERSION) saveSettings();
