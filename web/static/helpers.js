// optional overlays: a bounding box around the model and axes on the ground. also the navigation gizmo in the
// top right corner, which is always there (like blender's).
// they live in the scene, not in modelRoot, so loading a model never disposes them
import * as THREE from './vendor/three/build/three.module.js';
import { scene, camera, renderer, requestRender } from './scene.js';
import { controls, stopMotion } from './controls.js';
import { viewportRight } from './layout.js';

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

// --- navigation gizmo ---
// top right of the viewport, like blender's: axis balls that turn with the camera. always shown (unless the
// interface is hidden with H); clicking a ball turns the view to look along that axis. drawn on top of the
// scene by renderGizmo, every frame the scene is drawn
const gizmoScene = new THREE.Scene();
const GIZMO_EXTENT = 1.45; // half the gizmo's view in scene units: the balls sit at 1, so this leaves a rim
const gizmoCamera = new THREE.OrthographicCamera(-GIZMO_EXTENT, GIZMO_EXTENT, GIZMO_EXTENT, -GIZMO_EXTENT, 0.1, 20);
const GIZMO_SIZE = 110; // css pixels
const GIZMO_MARGIN = 12;
const GIZMO_TOP = 62;   // under the frame rate readout (style.css #fps: 12px from the top, 42px high)

// where the gizmo is on screen, in css pixels from the window's top left
function gizmoRect(){
    return {left: viewportRight - GIZMO_MARGIN - GIZMO_SIZE, top: GIZMO_TOP, size: GIZMO_SIZE};
}

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
    sprite.scale.setScalar(letter ? 0.5 : 0.36);
    sprite.userData.baseScale = sprite.scale.x;
    sprite.renderOrder = 1;
    return sprite;
}

// a faint disc behind the balls while the pointer is over the gizmo, so it reads as something to click
const backdrop = (()=>{
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    const material = new THREE.SpriteMaterial({map: new THREE.CanvasTexture(canvas), depthTest: false, toneMapped: false, transparent: true, opacity: 0});
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(GIZMO_EXTENT * 2);
    sprite.renderOrder = -1;
    gizmoScene.add(sprite);
    return sprite;
})();

const balls = []; // clickable: each one knows the direction the view turns to
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

    for(const [sign, label] of [[1, letter], [-1, ""]]){
        const ball = marker(color, label);
        ball.position.copy(direction).multiplyScalar(sign);
        ball.userData.direction = direction.clone().multiplyScalar(sign);
        gizmoScene.add(ball);
        balls.push(ball);
    }
}

// called every frame from viewer.js after the scene is drawn
export function renderGizmo(renderer, camera){
    if(document.body.classList.contains("ui-hidden")) return;
    gizmoCamera.position.set(0, 0, 6).applyQuaternion(camera.quaternion);
    gizmoCamera.quaternion.copy(camera.quaternion);

    const rect = gizmoRect();
    const x = rect.left;
    const y = renderer.domElement.clientHeight - rect.top - rect.size; // webgl counts from the bottom
    const viewport = renderer.getViewport(new THREE.Vector4());
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, rect.size, rect.size);
    renderer.setScissor(x, y, rect.size, rect.size);
    renderer.render(gizmoScene, gizmoCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(viewport);
    renderer.autoClear = true;
}

// whether the pointer is over the gizmo, and the ball under it (null if none)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function overGizmo(event){
    if(event.target !== renderer.domElement || document.body.classList.contains("ui-hidden")) return false;
    const rect = gizmoRect();
    return event.clientX >= rect.left && event.clientX <= rect.left + rect.size
        && event.clientY >= rect.top && event.clientY <= rect.top + rect.size;
}
function ballAt(event){
    if(!overGizmo(event)) return null;
    const rect = gizmoRect();
    pointer.set((event.clientX - rect.left) / rect.size * 2 - 1, 1 - (event.clientY - rect.top) / rect.size * 2);
    raycaster.setFromCamera(pointer, gizmoCamera);
    // nearest to the viewer first, so a ball in front wins over the one behind it
    const hit = raycaster.intersectObjects(balls, false)[0];
    return hit ? hit.object : null;
}

// hover: the backdrop fades in over the gizmo, the ball under the pointer grows a little
let hovered = null;
let backdropOn = false;
window.addEventListener("pointermove", (event)=>{
    if(event.buttons) return; // dragging the view across the gizmo is not hovering it
    const ball = ballAt(event);
    const over = overGizmo(event);
    if(ball === hovered && over === backdropOn) return;
    if(hovered) hovered.scale.setScalar(hovered.userData.baseScale);
    hovered = ball;
    if(hovered) hovered.scale.setScalar(hovered.userData.baseScale * 1.2);
    backdropOn = over;
    backdrop.material.opacity = over ? (document.body.classList.contains("dark") ? 0.08 : 0.18) : 0;
    renderer.domElement.style.cursor = ball ? "pointer" : "";
    requestRender();
});

// click: a press on a ball belongs to the gizmo, not the orbit controls (this capture listener on window
// runs before the controls' own one on the canvas). the view turns when the press is released on that ball
let pressed = null;
window.addEventListener("pointerdown", (event)=>{
    pressed = event.button === 0 ? ballAt(event) : null;
    if(pressed) event.stopPropagation();
}, true);
window.addEventListener("pointerup", (event)=>{
    if(!pressed) return;
    if(ballAt(event) === pressed) turnView(pressed.userData.direction);
    pressed = null;
}, true);

// turn the camera around the orbit target until it looks along -direction (clicking X shows the model from
// its +x side, as in blender), keeping the distance. eased over TURN_MS. with "Lock below grid" on, the
// orbit controls stop a view from below at the grid
const TURN_MS = 300;
let turn = null;
function turnView(direction){
    stopMotion();
    const offset = camera.position.clone().sub(controls.target);
    const from = offset.clone().normalize();
    // straight up or down has no heading of its own: lean a hair towards +z, so -z is up on screen
    const to = direction.clone();
    if(Math.abs(to.y) > 0.99) to.z += 1e-4;
    to.normalize();
    turn = {start: performance.now(), rotation: new THREE.Quaternion().setFromUnitVectors(from, to), from, distance: offset.length()};
    requestAnimationFrame(stepTurn);
}
function stepTurn(now){
    if(!turn) return;
    const t = Math.min((now - turn.start) / TURN_MS, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const direction = turn.from.clone().applyQuaternion(new THREE.Quaternion().slerp(turn.rotation, eased));
    camera.position.copy(controls.target).addScaledVector(direction, turn.distance);
    camera.lookAt(controls.target);
    requestRender();
    if(t < 1) requestAnimationFrame(stepTurn);
    else turn = null;
}
// any input on the view during a turn stops it where it is
renderer.domElement.addEventListener("pointerdown", () => { turn = null; });
renderer.domElement.addEventListener("wheel", () => { turn = null; }, {passive: true});

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
    // nothing to box while the default cube is hidden (loader.js)
    for(const bar of bars) bar.visible = target.visible;
    if(!target.visible) return;
    if(!boxStale && !animating) return;
    fitBoundingBox(target);
    boxStale = false;
}
