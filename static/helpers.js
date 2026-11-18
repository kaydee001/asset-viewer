// optional overlays: a bounding box around the model and axes (ground lines plus a corner gizmo, like blender).
// they live in the scene, not in modelRoot, so loading a model never disposes them
import * as THREE from './vendor/three/build/three.module.js';
import { scene } from './scene.js';
import { viewportLeft } from './layout.js';

// --- bounding box ---
// webgl lines are one pixel wide and a tight box lies right on the model's own edges, so the edges are
// drawn as thin solid bars on top of everything (updateHelpers keeps them on the model)
export const bboxHelper = new THREE.Group();
bboxHelper.visible = false;
scene.add(bboxHelper);

// overlay colours are exact: no tone mapping or exposure, and the hex values are taken as sRGB
// (three r150 would otherwise treat them as linear and the output encoding would wash them out)
const overlayColor = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const barMaterial = new THREE.MeshBasicMaterial({color: overlayColor(0xffcc00), depthTest: false, transparent: true, toneMapped: false});
const bars = [];
for(let i = 0; i < 12; i++){
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), barMaterial);
    bar.renderOrder = 5;
    bboxHelper.add(bar);
    bars.push(bar);
}

const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();

function fitBoundingBox(object){
    box.setFromObject(object, true);
    if(box.isEmpty()) return;
    box.getSize(size);
    box.getCenter(center);
    const t = Math.max(size.x, size.y, size.z) * 0.008; // bar thickness
    let i = 0;
    // four bars along each axis, one in each corner of the box
    for(const sa of [-1, 1]){
        for(const sb of [-1, 1]){
            bars[i++].position.set(center.x, center.y + sa * size.y / 2, center.z + sb * size.z / 2);
            bars[i - 1].scale.set(size.x + t, t, t);
            bars[i++].position.set(center.x + sa * size.x / 2, center.y, center.z + sb * size.z / 2);
            bars[i - 1].scale.set(t, size.y + t, t);
            bars[i++].position.set(center.x + sa * size.x / 2, center.y + sb * size.y / 2, center.z);
            bars[i - 1].scale.set(t, t, size.z + t);
        }
    }
}

// --- axes ---
// on the ground: a red line along x and a blue one along z, as long as the grid (the model hides the middle)
export const axesHelper = new THREE.Group();
axesHelper.visible = false;
scene.add(axesHelper);

function groundLine(width, depth, color){
    const line = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({color: overlayColor(color), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false})
    );
    line.rotation.x = -Math.PI/2;
    line.position.y = 0.004;
    axesHelper.add(line);
}
groundLine(12, 0.03, 0xff3653);
groundLine(0.03, 12, 0x2c8fff);

// in the corner: a small gizmo that turns with the camera, drawn on top of the scene (renderGizmo)
const gizmoScene = new THREE.Scene();
const gizmoCamera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 20);
const GIZMO_SIZE = 120; // css pixels
const GIZMO_MARGIN = 16;

// a round marker, with a letter for the positive end of an axis
function marker(color, letter){
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = letter ? 1 : 0.55;
    ctx.fill();
    if(letter){
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#161617";
        ctx.font = "bold 34px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, 32, 34);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map, depthTest: false, toneMapped: false}));
    sprite.scale.setScalar(letter ? 0.5 : 0.32);
    sprite.renderOrder = 1;
    return sprite;
}

for(const [direction, color, letter] of [
    [new THREE.Vector3(1, 0, 0), "#ff3653", "X"],
    [new THREE.Vector3(0, 1, 0), "#8adb00", "Y"],
    [new THREE.Vector3(0, 0, 1), "#2c8fff", "Z"]
]){
    const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1, 8),
        new THREE.MeshBasicMaterial({color: overlayColor(color), toneMapped: false})
    );
    stick.position.copy(direction).multiplyScalar(0.5);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    gizmoScene.add(stick);

    const positive = marker(color, letter);
    positive.position.copy(direction);
    gizmoScene.add(positive);
    const negative = marker(color, "");
    negative.position.copy(direction).multiplyScalar(-1);
    gizmoScene.add(negative);
}

// called every frame from viewer.js after the scene is drawn
export function renderGizmo(renderer, camera){
    if(!axesHelper.visible || document.body.classList.contains("ui-hidden")) return;
    gizmoCamera.position.set(0, 0, 6).applyQuaternion(camera.quaternion);
    gizmoCamera.quaternion.copy(camera.quaternion);

    const viewport = renderer.getViewport(new THREE.Vector4());
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    const x = viewportLeft + GIZMO_MARGIN;
    renderer.setViewport(x, GIZMO_MARGIN, GIZMO_SIZE, GIZMO_SIZE);
    renderer.setScissor(x, GIZMO_MARGIN, GIZMO_SIZE, GIZMO_SIZE);
    renderer.render(gizmoScene, gizmoCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(viewport);
    renderer.autoClear = true;
}

// --- shared ---
let target = null;
let boxStale = true; // the exact box walks every vertex, so it is only measured again when it can have changed

// called by loader.js for every new model
export function setBoundingTarget(object){
    target = object;
    boxStale = true;
    updateHelpers();
}

// the model moved without a clip playing (scrubbing the seek bar)
export function invalidateBox(){
    boxStale = true;
}

// called from viewer.js before each drawn frame. a still model keeps its box; a playing clip can move
// the model, so then the box is measured every frame
export function updateHelpers(animating = false){
    if(animating) boxStale = true; // also while the box is hidden, so it is right when it is turned on
    if(!bboxHelper.visible || !target) return;
    if(!boxStale && !animating) return;
    fitBoundingBox(target);
    boxStale = false;
}
