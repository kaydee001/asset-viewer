// keeps the model in the middle of the free space between the docked side panels, not of the whole window.
// the canvas fills the window under the docks, so without this the model would sit off centre
import { camera, requestRender } from './scene.js';

const leftPanel = document.getElementById("model-panel");  // parts and model info, only once a model is loaded
const rightPanel = document.getElementById("scene-panel"); // scene settings

const shown = (panel) => getComputedStyle(panel).display !== "none";

// shifts the projection centre sideways (setViewOffset), the canvas itself keeps filling the window
// left edge of the free viewport in css pixels (the gizmo in helpers.js is drawn from there)
export let viewportLeft = 0;

export function updateViewOffset(){
    const width = window.innerWidth;
    const height = window.innerHeight;
    const freeLeft = shown(leftPanel) ? leftPanel.getBoundingClientRect().right : 0;
    const freeRight = shown(rightPanel) ? rightPanel.getBoundingClientRect().left : width;
    viewportLeft = freeLeft;
    const shift = (freeLeft + freeRight) / 2 - width / 2;
    // in a very narrow window the panels cover the middle anyway, leave the view alone
    if(freeRight - freeLeft < 320 || Math.abs(shift) < 1){
        camera.clearViewOffset();
    } else {
        camera.setViewOffset(width, height, -shift, 0, width, height);
    }
    requestRender();
}

// the panels appear and disappear through classes on body (has-model, ui-hidden)
new MutationObserver(updateViewOffset).observe(document.body, {attributes: true, attributeFilter: ["class"]});
window.addEventListener("resize", updateViewOffset);
updateViewOffset();
