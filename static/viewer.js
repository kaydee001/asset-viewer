// entry point (loaded by templates/index.html): imports every module, then runs the render loop
import { scene, camera, renderer } from './scene.js';
import { controls } from './controls.js';
import { updateAnimation } from './animation.js';
import { modelRoot } from './loader.js';
import { updateHelpers, renderGizmo } from './helpers.js';
// imported only for their side effects, they wire up the page. settings.js goes last so it can restore saved state
import './layout.js';
import './ui.js';
import './shortcuts.js';
import './dragdrop.js';
import './settings.js';

// handle for debugging from the dev tools console: add ?debug to the url
if(location.search.includes("debug")) window.viewer = { scene, camera, renderer, controls, modelRoot };

// runs every frame: advance animation, update camera damping, draw (the axes gizmo goes on top)
function animate(){
    requestAnimationFrame(animate);
    updateAnimation();
    updateHelpers();
    controls.update();
    renderer.render(scene, camera);
    renderGizmo(renderer, camera);
}
animate();
