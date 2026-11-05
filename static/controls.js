import { OrbitControls } from './vendor/three/addons/controls/OrbitControls.js';
import { camera, renderer } from './scene.js';

// orbit camera controls. ui.js toggles auto rotate / bottom lock and the projection on this object,
// loader.js re-targets it and adjusts the zoom limits whenever a model is framed
export const controls = new OrbitControls(camera, renderer.domElement);

controls.zoomSpeed = 1.0;
controls.minDistance = 1; // zoom limits, replaced per model in frameCamera()
controls.maxDistance = 20;
controls.enableDamping = true;

controls.enablePan = true; // right mouse button or shift + left drag
// polar angle is measured from straight up: PI/2 stops the camera at the grid level (Lock below grid)
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI/2;
