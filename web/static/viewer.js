// entry point (loaded by web/index.html): imports every module, then runs the render loop
import { scene, camera, renderer, projection, requestRender, takeRenderRequest, SETTLED_PIXEL_RATIO, MOVING_PIXEL_RATIO } from './scene.js';
import * as THREE from './vendor/three/build/three.module.js';
import { controls } from './controls.js';
import { updateAnimation } from './animation.js';
import { modelRoot } from './loader.js';
import { updateHelpers, renderGizmo } from './helpers.js';
import { countFrame } from './fps.js';
// imported only for their side effects, they wire up the page. settings.js goes last so it can restore saved state
import './layout.js';
import './ui.js';
import './shortcuts.js';
import './dragdrop.js';
import './dropdown.js';
import './settings.js';

// handle for debugging from the dev tools console: add ?debug to the url, or start the app with --debug
if(location.search.includes("debug") || window.__AV_DEBUG__) window.viewer = { scene, camera, renderer, controls, modelRoot };

// any input can change the picture (a toggle, a slider, a key, a dropped file), so it asks for a frame.
// capture phase, so it runs even when a handler stops the event
for(const type of ["pointerdown", "pointerup", "click", "input", "change", "keydown", "keyup", "drop"]){
    window.addEventListener(type, requestRender, true);
}

// frames are only drawn when something changed: the camera moved (input, damping, auto rotate), a clip is
// playing, or something asked for one. a still scene costs almost nothing, which matters at 2x-3x supersampling.
// while moving the screen's own resolution is used, the sharp supersampled frame follows SETTLE_MS later
const SETTLE_MS = 200;
// a slow redraw as a safety net for changes nothing announced
const IDLE_REFRESH_MS = 1000;
let lastMotion = -Infinity;
let lastFrame = -Infinity;

// orbit controls also move the camera from inside their own wheel and drag handlers, which the update()
// below would not report, so their change event counts as camera motion too
let controlsChanged = false;
controls.addEventListener("change", () => { controlsChanged = true; });

// damping keeps nudging the camera by ever smaller amounts for seconds after the input stops. once a frame's
// movement is below a fifth of a pixel nobody can see it, so the camera counts as still (no more frames,
// and the sharp frame is drawn) without waiting for the drift to end
const lastEye = new THREE.Vector3();
const lastTarget = new THREE.Vector3();
function visibleMotion(){
    const distance = camera.position.distanceTo(controls.target);
    const pixel = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance / window.innerHeight;
    const moved = camera.position.distanceTo(lastEye) + controls.target.distanceTo(lastTarget);
    lastEye.copy(camera.position);
    lastTarget.copy(controls.target);
    return moved > pixel * 0.2;
}

// orthographic is a 1 degree camera hundreds of units away (scene.js). with a near plane of 0.1 the depth
// buffer has almost no precision left at that distance and surfaces flicker through each other, so the near
// and far planes are kept around the target instead. the scene (12 unit grid, 4 unit model) fits in +-50
const ORTHO_DEPTH = 50;
function updateClipPlanes(){
    let near = 0.1, far = 1000;
    if(projection.orthographic){
        const distance = camera.position.distanceTo(controls.target);
        near = Math.max(0.1, distance - ORTHO_DEPTH);
        far = distance + ORTHO_DEPTH;
    }
    if(camera.near === near && camera.far === far) return;
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
}

// the axes gizmo is drawn on top of the scene
function animate(now){
    requestAnimationFrame(animate);
    const animating = updateAnimation();
    const controlsMoved = controls.update() || controlsChanged;
    controlsChanged = false;
    const cameraMoved = visibleMotion() && controlsMoved;
    const requested = takeRenderRequest();
    if(animating || cameraMoved) lastMotion = now;

    const ratio = now - lastMotion < SETTLE_MS ? MOVING_PIXEL_RATIO : SETTLED_PIXEL_RATIO;
    const ratioChanged = renderer.getPixelRatio() !== ratio;
    if(ratioChanged) renderer.setPixelRatio(ratio);

    const needed = animating || cameraMoved || requested || ratioChanged;
    if(!needed && now - lastFrame <= IDLE_REFRESH_MS) return;
    lastFrame = now;
    updateHelpers(animating);
    updateClipPlanes();
    renderer.render(scene, camera);
    renderGizmo(renderer, camera);
    countFrame(animating); // the frame rate is only measured (and shown) while a clip plays
}
requestAnimationFrame(animate);
