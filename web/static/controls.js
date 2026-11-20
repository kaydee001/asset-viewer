// orbit camera controls. ui.js wires the auto rotate, grid lock and projection switches to this object;
// loader.js re-targets it and sets the zoom limits whenever a model is framed
import { OrbitControls } from './vendor/three/addons/controls/OrbitControls.js';
import { camera, renderer } from './scene.js';

export const controls = new OrbitControls(camera, renderer.domElement);

controls.zoomSpeed = 1.0;
controls.minDistance = 1; // zoom limits, replaced per model in frameCamera()
controls.maxDistance = 20;
controls.enableDamping = true;
controls.enablePan = true; // right mouse button or shift + left drag
controls.autoRotate = false;
controls.autoRotateSpeed = 5.0;

// "Lock below grid": the polar angle is measured from straight up, so PI/2 stops the camera at the grid level
const GRID_LOCK_ANGLE = Math.PI / 2;
controls.minPolarAngle = 0;
controls.maxPolarAngle = GRID_LOCK_ANGLE;

export function isGridLocked(){
    return controls.maxPolarAngle === GRID_LOCK_ANGLE;
}

export function setGridLock(locked){
    controls.maxPolarAngle = locked ? GRID_LOCK_ANGLE : Math.PI;
}

// panning must not carry the camera under the grid while it is locked: when the target is dragged below it,
// camera and target are lifted back up together
controls.addEventListener("change", ()=>{
    if(!isGridLocked() || controls.target.y >= 0) return;
    const lift = -controls.target.y;
    controls.target.y += lift;
    camera.position.y += lift;
});

// damping keeps the camera drifting for a moment after the input stops. update() with damping off drops
// that leftover motion, and putting the camera back where it was means it does not jump either
export function stopMotion(){
    const position = camera.position.clone();
    const target = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
}
