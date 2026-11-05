// plays the clips that come with GLB / FBX files and drives the transport bar at the bottom of the viewport:
// play / pause, time scrubber, clip picker, speed and loop
import * as THREE from './vendor/three/build/three.module.js';

const clock = new THREE.Clock();
const select = document.getElementById("animation-select");
const timeSlider = document.getElementById("animation-time");
const speedSelect = document.getElementById("animation-speed");
const loopBtn = document.getElementById("animation-loop-btn");
const playBtn = document.getElementById("animation-btn");
const currentLabel = document.getElementById("animation-current");
const durationLabel = document.getElementById("animation-duration");

let mixer = null;  // THREE.AnimationMixer for the current model, null if it has no clips
let clips = [];    // clips of the current model
let action = null; // the clip that is currently playing
let loop = true;

// the play button shows a pause icon while playing (CSS swaps the icons on .playing)
function setPlaying(playing){
    playBtn.classList.toggle("playing", playing);
}

// 83.4 -> "1:23"
function formatTime(seconds){
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// moves the seek bar, its filled part and the time label to the given position (0..1)
function showPosition(fraction){
    timeSlider.value = fraction;
    timeSlider.style.setProperty("--pct", `${fraction * 100}%`);
    currentLabel.textContent = formatTime(fraction * (action ? action.getClip().duration : 0));
}

// start the clip picked in the dropdown (stopping the previous one)
function playSelected(){
    if(action) action.stop();
    action = mixer.clipAction(clips[select.selectedIndex]);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true; // stay on the last frame instead of snapping back
    action.play();
    setPlaying(true);
    durationLabel.textContent = formatTime(action.getClip().duration);
}

// the bar stays visible but greyed out while the model has no clips
function setControlsEnabled(enabled){
    [select, timeSlider, speedSelect, loopBtn, playBtn].forEach(el => { el.disabled = !enabled; });
}
setControlsEnabled(false);
select.add(new Option("No animations", ""));

// called by loader.js for every new model; disables the controls when there are no clips
export function setAnimations(object, newClips){
    if(mixer) mixer.stopAllAction();
    mixer = null;
    action = null;
    clips = newClips || [];
    select.textContent = "";
    showPosition(0);
    durationLabel.textContent = formatTime(0);
    setPlaying(false);
    setControlsEnabled(clips.length > 0);
    if(!clips.length){
        select.add(new Option("No animations", ""));
        return;
    }

    mixer = new THREE.AnimationMixer(object);
    mixer.timeScale = +speedSelect.value;
    clips.forEach((clip, i) => {
        select.add(new Option(clip.name || `clip ${i + 1}`, i));
    });
    playSelected();
}

select.addEventListener("change", () => { if(mixer) playSelected(); });

playBtn.addEventListener("click", () => {
    if(!action) return;
    // a clip that played through once (loop off) is restarted by Play
    if(finished()){
        action.reset().play();
    } else {
        action.paused = !action.paused;
    }
    setPlaying(!action.paused);
});

speedSelect.addEventListener("change", () => { if(mixer) mixer.timeScale = +speedSelect.value; });

loopBtn.addEventListener("click", () => {
    loop = !loop;
    loopBtn.classList.toggle("active", loop);
    loopBtn.setAttribute("aria-checked", loop);
    if(action){
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        // turning loop back on after the clip finished restarts it
        if(loop && finished()) action.reset().play();
    }
});

// a non-looping clip that reached its end (it stays there, paused)
function finished(){
    return !loop && action.time >= action.getClip().duration;
}

// dragging the scrubber jumps to that point of the clip (and pauses so it stays there)
let scrubbing = false;
timeSlider.addEventListener("input", () => {
    if(!action) return;
    scrubbing = true;
    action.paused = true;
    setPlaying(false);
    action.time = timeSlider.value * action.getClip().duration;
    mixer.update(0);
    showPosition(+timeSlider.value);
});
timeSlider.addEventListener("change", () => { scrubbing = false; });

// called every frame from viewer.js
export function updateAnimation(){
    const delta = clock.getDelta();
    if(!mixer) return;
    mixer.update(delta);
    if(!scrubbing && action){
        showPosition(action.time / action.getClip().duration);
        // keeps the icon right when a clip stops by itself (loop off)
        setPlaying(!action.paused);
    }
}
