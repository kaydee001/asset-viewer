// frame rate readout in the top right corner of the viewport. it only measures and shows while an animation
// clip plays: otherwise frames are drawn on demand (viewer.js) and a frame rate would mean nothing, so the
// readout stays hidden. the text is updated twice a second, not every frame
const readout = document.getElementById("fps");
const value = readout.querySelector(".fps-value");
const detail = readout.querySelector(".fps-ms");

const INTERVAL_MS = 500;
let frames = 0;    // counted frames in the current interval
let lastTime = 0;  // when the last counted frame was drawn
let frameTime = 0; // smoothed time between counted frames

// called by viewer.js for every drawn frame; playing is true while a clip is playing
export function countFrame(playing){
    if(!playing) return;
    const now = performance.now();
    // a gap longer than a second is a pause (or the first frame after play), not a frame time
    if(lastTime && now - lastTime < 1000) frameTime = frameTime ? frameTime * 0.8 + (now - lastTime) * 0.2 : now - lastTime;
    lastTime = now;
    frames++;
}

setInterval(() => {
    const show = frames > 0 && frameTime > 0;
    readout.hidden = !show;
    if(show){
        value.textContent = `${Math.round(1000 / frameTime)} fps`;
        detail.textContent = `${frameTime.toFixed(1)} ms`;
    } else {
        frameTime = 0;
        lastTime = 0;
    }
    frames = 0;
}, INTERVAL_MS);
