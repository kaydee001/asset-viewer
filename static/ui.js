// the view toggles and buttons: hdri, orbit switches, wireframe, shading, grid, theme, screenshot, reset.
// the DOM ids used here are defined in templates/index.html. the other ui files build on this one:
//   shortcuts.js (keys), dragdrop.js (opening files), settings.js (remembering all of this)
import {
    scene, camera, renderer, setEnvironment, setSunAngle, setGridTheme, gridHelper,
    projection, PERSPECTIVE_FOV, ORTHO_FOV, ORTHO_SCALE
} from './scene.js';
import { updateViewOffset } from './layout.js';
import { bboxHelper, axesHelper } from './helpers.js';
import { controls } from './controls.js';
import * as THREE from './vendor/three/build/three.module.js';
import { frameCamera, modelLoaded, currentObject, modelRoot, modelCameras } from './loader.js';
import { showToast } from './toast.js';
import { applyViewMode } from './viewmodes.js';

// switches are plain buttons; the "active" class is what styles them as on
function setLabel(btn, isOn){
    btn.classList.toggle("active", isOn);
    btn.setAttribute("aria-checked", isOn);
}

// select hdri (built-in presets listed in index.html)
export const hdriSelect = document.getElementById("hdri-select");
hdriSelect.addEventListener("change", (event)=>{
    setEnvironment(`/hdri/${event.target.value}`);
    document.getElementById("hdri-name").textContent = "";
});

// upload hdri
const hdriUpload = document.getElementById("hdri-upload");
const uploadHdrBtn = document.getElementById("upload-hdri-btn");
uploadHdrBtn.addEventListener("click", ()=>{
    hdriUpload.click();
});
hdriUpload.addEventListener("change", (event)=>{
    const file = event.target.files[0];
    if(!file) return;
    setEnvironment(URL.createObjectURL(file), true);
    document.getElementById("hdri-name").textContent = file.name;
});

// bottom lock toggle
export const bottomLockBtn = document.getElementById("bottom-lock-btn");
bottomLockBtn.addEventListener("click", ()=>{
    const isLocked = controls.maxPolarAngle === Math.PI/2;
    controls.maxPolarAngle = isLocked ? Math.PI : Math.PI/2;
    setLabel(bottomLockBtn, !isLocked);
});

// panning is always on (right mouse button or shift + left drag). with the grid lock on it must not
// carry the camera under the grid: when the target is dragged below it, lift it back up
controls.addEventListener("change", ()=>{
    if(controls.maxPolarAngle !== Math.PI/2 || controls.target.y >= 0) return;
    const lift = -controls.target.y;
    controls.target.y += lift;
    camera.position.y += lift;
});

// orthographic <-> perspective, see the note in scene.js
export const orthoBtn = document.getElementById("ortho-btn");
orthoBtn.addEventListener("click", ()=>{
    const on = !projection.orthographic;
    const before = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    projection.orthographic = on;
    projection.scale = on ? ORTHO_SCALE : 1;
    camera.fov = on ? ORTHO_FOV : PERSPECTIVE_FOV;
    camera.far = on ? 5000 : 1000;
    camera.updateProjectionMatrix();
    // keep the model the same size on screen: move the camera out (or back in) by the change in tan(fov / 2)
    const ratio = before / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(ratio);
    camera.position.copy(controls.target).add(offset);
    controls.minDistance *= ratio;
    controls.maxDistance *= ratio;
    controls.update();
    setLabel(orthoBtn, on);
});

// toggle auto rotate
controls.autoRotate = false;
export const rotateBtn = document.getElementById("auto-rotate-btn");
rotateBtn.addEventListener("click", ()=>{
    controls.autoRotate = !controls.autoRotate;
    setLabel(rotateBtn, controls.autoRotate);
    if(!controls.autoRotate) stopMotion();
})

// damping keeps the camera drifting for a moment after the input stops. update() with damping off drops
// that leftover motion, and putting the camera back where it was means it does not jump either
function stopMotion(){
    const position = camera.position.clone();
    const target = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
}
controls.autoRotateSpeed = 5.0;

// toggle wireframe mode (also reset to off by dragdrop.js whenever a new model loads)
export const wireframeBtn = document.getElementById("wireframe-btn");
let wireframeOn = false;
export function setWireframe(value){
    wireframeOn = value;
    modelRoot.traverse(function(obj){
        if(!obj.isMesh) return;
        // set it on the model's own materials as well as whatever debug view is showing
        [obj.material, obj.userData.originalMaterial].filter(Boolean).forEach(function(source){
            const mats = Array.isArray(source) ? source : [source];
            mats.forEach(m => m.wireframe = wireframeOn);
        });
    });
    setLabel(wireframeBtn, wireframeOn);
}
wireframeBtn.addEventListener("click", () => setWireframe(!wireframeOn));

// shading mode (shaded, clay, normals, uv checker)
export const shadingSelect = document.getElementById("shading-select");
shadingSelect.addEventListener("change", ()=>{
    applyViewMode(modelRoot, shadingSelect.value);
    setWireframe(wireframeOn);
});

// toggle scene grid
export const gridBtn = document.getElementById("grid-btn");
gridBtn.addEventListener("click", ()=>{
    gridHelper.visible = !gridHelper.visible;
    setLabel(gridBtn, gridHelper.visible);
});

// toggle theme (light <-> dark)
export const themeBtn = document.getElementById("theme-btn");
themeBtn.addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
    document.body.classList.toggle("light");
    const dark = document.body.classList.contains("dark");
    setLabel(themeBtn, dark);
    setGridTheme(dark);
});

// save the current view as a png. transparent by default; the scale option renders at a higher
// resolution, and "include background" paints the current background colour behind the model
export const shotScaleSelect = document.getElementById("shot-scale");
export const shotBgBtn = document.getElementById("shot-bg-btn");
shotBgBtn.addEventListener("click", ()=>{
    setLabel(shotBgBtn, !shotBgBtn.classList.contains("active"));
});

document.getElementById("screenshot-btn").addEventListener("click", ()=>{
    const gl = renderer.getContext();
    const ratio = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());
    // never ask for a canvas bigger than the gpu allows
    const limit = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const scale = Math.max(1, Math.min(+shotScaleSelect.value, limit / (Math.max(size.x, size.y) * ratio)));

    renderer.setPixelRatio(ratio * scale);
    camera.clearViewOffset();
    renderer.render(scene, camera);

    let source = renderer.domElement;
    if(shotBgBtn.classList.contains("active")){
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

// reset the camera view, other settings stay as they are
export const resetBtn = document.getElementById("reset-btn");
resetBtn.addEventListener("click", ()=>{
    if (modelLoaded)
    {
        frameCamera(currentObject);
    }
    else
    {
        camera.position.set(2.5, 2.5, 2.5).multiplyScalar(projection.scale);
        controls.target.set(0, 0.5, 0);
        controls.update();
    }
});

// bounding box and axes overlays (helpers.js)
export const bboxBtn = document.getElementById("bbox-btn");
bboxBtn.addEventListener("click", ()=>{
    bboxHelper.visible = !bboxHelper.visible;
    setLabel(bboxBtn, bboxHelper.visible);
});

export const axesBtn = document.getElementById("axes-btn");
axesBtn.addEventListener("click", ()=>{
    axesHelper.visible = !axesHelper.visible;
    setLabel(axesBtn, axesHelper.visible);
});

// light angle: turns the lighting (hdri and key light together) around the model, see scene.js
export const sunRange = document.getElementById("sun-range");
export { setSunAngle };
sunRange.addEventListener("input", () => setSunAngle(+sunRange.value));

// exposure: overall brightness
export const exposureRange = document.getElementById("exposure-range");
export function setExposure(value){ renderer.toneMappingExposure = value; }
exposureRange.addEventListener("input", () => setExposure(+exposureRange.value));

// a flat colour standing in for the background in screenshots: the theme's base colour
function backgroundColor(){
    return document.body.classList.contains("dark") ? "#181b22" : "#dbe4f2";
}

// cameras stored in a gltf file, offered next to the normal orbit camera
const cameraSection = document.getElementById("camera-section");
const cameraSelect = document.getElementById("camera-select");
export function updateCameraSelect(){
    cameraSelect.textContent = "";
    cameraSection.style.display = modelCameras.length ? "block" : "none";
    if(!modelCameras.length) return;
    cameraSelect.add(new Option("Orbit (default)", -1));
    modelCameras.forEach((cam, i) => cameraSelect.add(new Option(cam.name || `camera ${i + 1}`, i)));
}
cameraSelect.addEventListener("change", ()=>{
    const index = +cameraSelect.value;
    if(index < 0){
        frameCamera(currentObject);
        return;
    }
    // look from the gltf camera's position, along its view direction, at the model's distance
    const cam = modelCameras[index];
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

// hide / show all panels
document.getElementById("hide-btn").addEventListener("click", ()=>{
    document.body.classList.toggle("ui-hidden");
    if(document.body.classList.contains("ui-hidden")){
        showToast("interface hidden, press H to show it");
    }
});

// collapse / expand panel sections
document.addEventListener("click", (event)=>{
    const title = event.target.closest(".section-title");
    if(title) title.parentElement.classList.toggle("collapsed");
});
