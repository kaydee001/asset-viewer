import * as THREE from 'https://esm.sh/three@0.150.0';
import { scene, camera, renderer } from './scene.js';
import { controls } from './controls.js';
import './ui.js';

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}
animate();