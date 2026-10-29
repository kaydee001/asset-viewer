import * as THREE from 'three';

const clock = new THREE.Clock();
const section = document.getElementById("animation-section");
const select = document.getElementById("animation-select");
const playBtn = document.getElementById("animation-btn");

let mixer = null;
let clips = [];
let action = null;

function playSelected(){
    if(action) action.stop();
    action = mixer.clipAction(clips[select.selectedIndex]);
    action.play();
    playBtn.textContent = "- pause";
}

export function setAnimations(object, newClips){
    if(mixer) mixer.stopAllAction();
    mixer = null;
    action = null;
    clips = newClips || [];
    select.textContent = "";
    section.style.display = clips.length ? "flex" : "none";
    if(!clips.length) return;

    mixer = new THREE.AnimationMixer(object);
    clips.forEach((clip, i) => {
        select.add(new Option(clip.name || `clip ${i + 1}`, i));
    });
    playSelected();
}

select.addEventListener("change", () => { if(mixer) playSelected(); });
playBtn.addEventListener("click", () => {
    if(!action) return;
    action.paused = !action.paused;
    playBtn.textContent = action.paused ? "- play" : "- pause";
});

export function updateAnimation(){
    const delta = clock.getDelta();
    if(mixer) mixer.update(delta);
}
