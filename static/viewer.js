import { scene, camera, renderer } from './scene.js';
import { controls } from './controls.js';
import { updateAnimation } from './animation.js';
import { modelRoot } from './loader.js';
import './ui.js';

// handle for debugging from the dev tools console: add ?debug to the url
if(location.search.includes("debug")) window.viewer = { scene, camera, renderer, controls, modelRoot };

function animate(){
    requestAnimationFrame(animate);
    updateAnimation();
    controls.update();
    renderer.render(scene, camera);
}
animate();
