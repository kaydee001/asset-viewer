// keeps the model in the middle of the free space between the side panels, not of the whole window.
// the panels float over the canvas, so without this the model looks pushed toward the busier side
import { camera } from './scene.js';

const leftPanel = document.getElementById("left-panel");
const rightPanel = document.getElementById("right-panel");

const shown = (panel) => getComputedStyle(panel).display !== "none";

// shifts the projection centre sideways (setViewOffset), the canvas itself keeps filling the window
export function updateViewOffset(){
    const width = window.innerWidth;
    const height = window.innerHeight;
    const freeLeft = shown(leftPanel) ? leftPanel.getBoundingClientRect().right : 0;
    const freeRight = shown(rightPanel) ? rightPanel.getBoundingClientRect().left : width;
    const shift = (freeLeft + freeRight) / 2 - width / 2;
    // in a very narrow window the panels cover the middle anyway, leave the view alone
    if(freeRight - freeLeft < 320 || Math.abs(shift) < 1){
        camera.clearViewOffset();
    } else {
        camera.setViewOffset(width, height, -shift, 0, width, height);
    }
}

// the panels appear and disappear through classes on body (has-model, ui-hidden)
new MutationObserver(updateViewOffset).observe(document.body, {attributes: true, attributeFilter: ["class"]});
window.addEventListener("resize", updateViewOffset);
updateViewOffset();
