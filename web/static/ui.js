// the view toggles and buttons: hdri, orbit switches, wireframe, shading, grid, theme, screenshot, reset.
// the DOM ids used here are defined in web/index.html. the other ui files build on this one:
//   shortcuts.js (keys), dragdrop.js (opening files), settings.js (remembering all of this)
import * as THREE from './vendor/three/build/three.module.js';
import {
    scene, camera, renderer, setEnvironment, setSunAngle, setGridTheme, grid,
    projection, PERSPECTIVE_FOV, ORTHO_FOV, ORTHO_SCALE, SETTLED_PIXEL_RATIO
} from './scene.js';
import { updateViewOffset } from './layout.js';
import { bboxOverlay, axesOverlay } from './overlays.js';
import { controls, stopMotion, isGridLocked, setGridLock } from './controls.js';
import { frameCamera, resetView, currentObject, modelRoot, modelCameras } from './loader.js';
import { showToast } from './toast.js';
import { applyViewMode, setWireframeTheme } from './viewmodes.js';
import { hdriUrl } from './shell.js';
import { setSwitch, isOn } from './util.js';

const byId = (id) => document.getElementById(id);

// the switches' aria-checked starts out matching their "active" class in index.html
document.querySelectorAll("[role=switch]").forEach(btn => setSwitch(btn, isOn(btn)));

// a switch button that flips `get()` through `set(on)` and shows the new state
function wireSwitch(btn, get, set){
    btn.addEventListener("click", ()=>{
        set(!get());
        setSwitch(btn, get());
    });
    return btn;
}

// ---------- lighting ----------

// built-in presets (listed in index.html) and the user's own .hdr files
export const hdriSelect = byId("hdri-select");
const hdriName = byId("hdri-name");
hdriSelect.addEventListener("change", ()=>{
    setEnvironment(hdriUrl(hdriSelect.value));
    hdriName.textContent = "";
});

const hdriUpload = byId("hdri-upload");
byId("upload-hdri-btn").addEventListener("click", () => hdriUpload.click());
hdriUpload.addEventListener("change", ()=>{
    const file = hdriUpload.files[0];
    if(!file) return;
    setEnvironment(URL.createObjectURL(file), true);
    hdriName.textContent = file.name;
    hdriUpload.value = "";
});

// light angle: turns the lighting (hdri and key light together) around the model, see scene.js
export const sunRange = byId("sun-range");
sunRange.addEventListener("input", () => setSunAngle(+sunRange.value));

// exposure: overall brightness
export const exposureRange = byId("exposure-range");
export function setExposure(value){ renderer.toneMappingExposure = value; }
exposureRange.addEventListener("input", () => setExposure(+exposureRange.value));

// double click a slider to put it back to its default (the value in index.html)
for(const range of [sunRange, exposureRange]){
    range.addEventListener("dblclick", ()=>{
        range.value = range.defaultValue;
        range.dispatchEvent(new Event("input", {bubbles: true}));
        range.dispatchEvent(new Event("change", {bubbles: true}));
    });
}

// ---------- camera ----------

export const rotateBtn = wireSwitch(byId("auto-rotate-btn"), () => controls.autoRotate, (on)=>{
    controls.autoRotate = on;
    if(!on) stopMotion();
});

export const bottomLockBtn = wireSwitch(byId("bottom-lock-btn"), isGridLocked, setGridLock);

// orthographic <-> perspective, see the note in scene.js
export const orthoBtn = wireSwitch(byId("ortho-btn"), () => projection.orthographic, (on)=>{
    const before = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    projection.orthographic = on;
    projection.scale = on ? ORTHO_SCALE : 1;
    camera.fov = on ? ORTHO_FOV : PERSPECTIVE_FOV;
    camera.updateProjectionMatrix();
    // keep the model the same size on screen: move the camera out (or back in) by the change in tan(fov / 2)
    const ratio = before / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(ratio);
    camera.position.copy(controls.target).add(offset);
    controls.minDistance *= ratio;
    controls.maxDistance *= ratio;
    controls.update();
    // the field of view is the orbit camera's again, so a gltf camera picked in the list no longer applies
    showOrbitCamera();
});

// reset the camera view, other settings stay as they are
export const resetBtn = byId("reset-btn");
resetBtn.addEventListener("click", ()=>{
    resetView();
    showOrbitCamera();
});

// cameras stored in a gltf file, offered next to the normal orbit camera
const ORBIT = "-1";
const cameraSection = byId("camera-section");
const cameraSelect = byId("camera-select");
export function updateCameraSelect(){
    cameraSelect.textContent = "";
    cameraSection.hidden = !modelCameras.length;
    if(!modelCameras.length) return;
    cameraSelect.add(new Option("Orbit (default)", ORBIT));
    modelCameras.forEach((cam, i) => cameraSelect.add(new Option(cam.name || `camera ${i + 1}`, i)));
}
function showOrbitCamera(){
    if(cameraSelect.options.length) cameraSelect.value = ORBIT;
}
cameraSelect.addEventListener("change", ()=>{
    if(cameraSelect.value === ORBIT){
        frameCamera(currentObject);
        return;
    }
    // look from the gltf camera's position, along its view direction, at the model's distance
    const cam = modelCameras[+cameraSelect.value];
    cam.updateWorldMatrix(true, false);
    const position = cam.getWorldPosition(new THREE.Vector3());
    const direction = cam.getWorldDirection(new THREE.Vector3());
    const center = new THREE.Box3().setFromObject(currentObject, true).getCenter(new THREE.Vector3());
    camera.position.copy(position);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    controls.target.copy(position).addScaledVector(direction, Math.max(position.distanceTo(center), 0.1));
    controls.update();
});

// ---------- overlays and shading ----------

export const gridBtn = wireSwitch(byId("grid-btn"), () => grid.visible, (on) => { grid.visible = on; });
export const bboxBtn = wireSwitch(byId("bbox-btn"), () => bboxOverlay.visible, (on) => { bboxOverlay.visible = on; });
export const axesBtn = wireSwitch(byId("axes-btn"), () => axesOverlay.visible, (on) => { axesOverlay.visible = on; });

// wireframe sits on top of the shading mode, which comes back when it is turned off (viewmodes.js).
// dragdrop.js turns it off whenever a new model loads
export const wireframeBtn = byId("wireframe-btn");
let wireframeOn = false;
export function setWireframe(on){
    wireframeOn = on;
    applyViewMode(modelRoot, undefined, wireframeOn);
    setSwitch(wireframeBtn, wireframeOn);
}
wireframeBtn.addEventListener("click", () => setWireframe(!wireframeOn));

// shading mode (shaded, clay, normals, uv checker, vertex colors)
export const shadingSelect = byId("shading-select");
shadingSelect.addEventListener("change", () => applyViewMode(modelRoot, shadingSelect.value));

// ---------- theme ----------

// .active = dark. a user toggle fades the colours (style.css body.theme-fade); the restore on startup switches at once
export const themeBtn = byId("theme-btn");
let themeFade = false;
requestAnimationFrame(() => { themeFade = true; });
let fadeTimer = null;
themeBtn.addEventListener("click", ()=>{
    if(themeFade){
        document.body.classList.add("theme-fade");
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => document.body.classList.remove("theme-fade"), 400);
    }
    const dark = !document.body.classList.contains("dark");
    document.body.classList.toggle("dark", dark);
    document.body.classList.toggle("light", !dark);
    setSwitch(themeBtn, dark);
    setGridTheme(dark);
    setWireframeTheme(dark);
});

// ---------- screenshot (hidden for now, see index.html) ----------

// a png of the current view. transparent by default; the scale option renders at a higher resolution,
// and "include background" paints the stage colour behind the model
export const shotScaleSelect = byId("shot-scale");
let shotBackground = false;
export const shotBgBtn = wireSwitch(byId("shot-bg-btn"), () => shotBackground, (on) => { shotBackground = on; });

// a flat colour standing in for the stage gradient: keep in step with body::before / ::after in style.css
function backgroundColor(){
    return document.body.classList.contains("dark") ? "#161617" : "#c6c6c9";
}

byId("screenshot-btn").addEventListener("click", ()=>{
    const gl = renderer.getContext();
    // the supersampled ratio, even if the click came while the view was still moving (drawn at screen resolution)
    const ratio = SETTLED_PIXEL_RATIO;
    const size = renderer.getSize(new THREE.Vector2());
    // never ask for a canvas bigger than the gpu allows
    const limit = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const scale = Math.max(1, Math.min(+shotScaleSelect.value, limit / (Math.max(size.x, size.y) * ratio)));

    renderer.setPixelRatio(ratio * scale);
    camera.clearViewOffset();
    renderer.render(scene, camera);

    let source = renderer.domElement;
    if(shotBackground){
        source = document.createElement("canvas");
        source.width = renderer.domElement.width;
        source.height = renderer.domElement.height;
        const ctx = source.getContext("2d");
        ctx.fillStyle = backgroundColor();
        ctx.fillRect(0, 0, source.width, source.height);
        ctx.drawImage(renderer.domElement, 0, 0);
    }
    source.toBlob((blob)=>{
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "screenshot.png";
        link.click();
        URL.revokeObjectURL(link.href);
    });

    // back to the normal resolution (the blob was captured when toBlob was called)
    renderer.setPixelRatio(ratio);
    updateViewOffset();
    renderer.render(scene, camera);
});

// ---------- panels ----------

// hide / show all panels
byId("hide-btn").addEventListener("click", ()=>{
    document.body.classList.toggle("ui-hidden");
    if(document.body.classList.contains("ui-hidden")){
        showToast("Interface hidden, press H to show it");
    }
});

// collapse / expand panel sections
document.addEventListener("click", (event)=>{
    const title = event.target.closest(".section-title");
    if(title) title.parentElement.classList.toggle("collapsed");
});
