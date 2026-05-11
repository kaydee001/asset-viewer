import { OrbitControls } from 'https://esm.sh/three@0.150.0/examples/jsm/controls/OrbitControls.js';
import {scene, camera, renderer} from './scene.js'

// scene controls
export const controls = new OrbitControls(camera, renderer.domElement);

controls.zoomSpeed = 1.0;
controls.minDistance = 5;
controls.maxDistance = 10;

controls.enablePan = false;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI/2;

// fix reloading after window resizing 
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});