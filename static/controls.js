import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { camera, renderer } from './scene.js';

// scene controls
export const controls = new OrbitControls(camera, renderer.domElement);

controls.zoomSpeed = 1.0;
controls.minDistance = 1;
controls.maxDistance = 20;
controls.enableDamping = true;

controls.enablePan = false;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI/2;
