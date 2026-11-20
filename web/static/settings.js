// settings are remembered between launches (localStorage; the Tauri shell keeps its origin, so it survives restarts).
// to remember a new setting: add it in saveSettings() and restore it in the block below.
import { setEnvironment, gridHelper, projection, DEFAULT_HDRI } from './scene.js';
import { controls } from './controls.js';
import { modelRoot } from './loader.js';
import { applyViewMode } from './viewmodes.js';
import { bboxHelper, axesHelper } from './helpers.js';
import { hdriUrl } from './shell.js';
import {
    hdriSelect, shadingSelect, themeBtn, gridBtn, rotateBtn, orthoBtn, bottomLockBtn, bboxBtn, axesBtn,
    sunRange, setSunAngle, exposureRange, setExposure,
    shotScaleSelect, shotBgBtn
} from './ui.js';

const SETTINGS_KEY = "asset-viewer-settings";
// bump when a saved value should not carry over. 2: new lighting presets with even brightness, so an exposure
// saved for the old ones (often turned all the way up) is dropped once
const SETTINGS_VERSION = 2;

function saveSettings(){
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        version: SETTINGS_VERSION,
        dark: document.body.classList.contains("dark"),
        grid: gridHelper.visible,
        autoRotate: controls.autoRotate,
        ortho: projection.orthographic,
        lock: controls.maxPolarAngle === Math.PI/2,
        hdri: hdriSelect.value,
        shading: shadingSelect.value,
        bbox: bboxHelper.visible,
        axes: axesHelper.visible,
        sun: +sunRange.value,
        exposure: +exposureRange.value,
        shotScale: shotScaleSelect.value,
        shotBg: shotBgBtn.classList.contains("active")
    }));
}

// save after every change in the scene panel (right) or the top bar (theme), setTimeout lets the click handler flip its state first
for(const id of ["scene-panel", "commandbar"]){
    const panel = document.getElementById(id);
    panel.addEventListener("click", () => setTimeout(saveSettings));
    panel.addEventListener("change", saveSettings);
}

// dark is the default, the saved values only change what differs from it
let saved = {};
try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch(error) {}
if((saved.version || 1) < 2) delete saved.exposure;
if(saved.dark === false) themeBtn.click();
if(saved.grid === false) gridBtn.click();
if(saved.autoRotate) rotateBtn.click();
if(saved.ortho) orthoBtn.click();
if(saved.lock === false) bottomLockBtn.click();
if(saved.hdri && hdriSelect.querySelector(`option[value="${saved.hdri}"]`)){
    hdriSelect.value = saved.hdri;
    if(saved.hdri !== DEFAULT_HDRI) setEnvironment(hdriUrl(saved.hdri));
}
if(saved.bbox) bboxBtn.click();
if(saved.axes) axesBtn.click();
if(typeof saved.sun === "number"){
    sunRange.value = saved.sun;
    setSunAngle(saved.sun);
}
if(typeof saved.exposure === "number"){
    exposureRange.value = saved.exposure;
    setExposure(saved.exposure);
}
if(saved.shotScale && shotScaleSelect.querySelector(`option[value="${saved.shotScale}"]`)) shotScaleSelect.value = saved.shotScale;
if(saved.shotBg) shotBgBtn.click();
if(saved.shading && shadingSelect.querySelector(`option[value="${saved.shading}"]`)){
    shadingSelect.value = saved.shading;
    applyViewMode(modelRoot, saved.shading);
}

// settings from an older version: store them in the current form right away (drops the old exposure)
if((saved.version || 1) < SETTINGS_VERSION) saveSettings();
