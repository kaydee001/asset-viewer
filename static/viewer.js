import { scene, camera, renderer } from './scene.js';
import { controls } from './controls.js';
import { updateAnimation } from './animation.js';
import './ui.js';

function animate(){
    requestAnimationFrame(animate);
    updateAnimation();
    controls.update();
    renderer.render(scene, camera);
}
animate();
