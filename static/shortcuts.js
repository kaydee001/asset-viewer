// keyboard shortcuts and the tooltips that show them.
// each key just clicks the matching button. to add one, add it to `shortcuts` below and
// give the button a data-label in index.html so it gets a tooltip.
import { wireframeBtn, gridBtn, rotateBtn, resetBtn, themeBtn, orthoBtn, bboxBtn, axesBtn } from './ui.js';

const shortcuts = {
    w: wireframeBtn,
    g: gridBtn,
    r: rotateBtn,
    f: resetBtn,
    s: document.getElementById("screenshot-btn"),
    o: document.getElementById("open-btn"),
    t: themeBtn,
    p: orthoBtn,
    b: bboxBtn,
    x: axesBtn,
    h: document.getElementById("hide-btn"),
    "?": document.getElementById("help-btn"),
    " ": document.getElementById("animation-btn")
};

// tooltips: label plus its shortcut key
const keyOf = new Map(Object.entries(shortcuts).map(([key, btn]) => [btn, key.toUpperCase()]));
document.querySelectorAll(".tool").forEach(btn => {
    const key = keyOf.get(btn);
    btn.dataset.tip = key ? `${btn.dataset.label} (${key})` : btn.dataset.label;
    // the text label is hidden in narrow windows, so screen readers need the name too
    btn.setAttribute("aria-label", btn.dataset.label);
});

// shortcut overlay: one row per shortcut, named after its button
const help = document.getElementById("help");
const helpList = document.getElementById("help-list");
for(const [key, btn] of Object.entries(shortcuts)){
    const row = document.createElement("div");
    row.className = "help-row";
    const name = document.createElement("span");
    name.textContent = btn.dataset.label || btn.querySelector(".row-label").textContent;
    const keycap = document.createElement("kbd");
    keycap.textContent = key === " " ? "Space" : key.toUpperCase();
    row.append(name, keycap);
    helpList.append(row);
}
const helpBtn = shortcuts["?"];
const setHelp = (open) => { help.style.display = open ? "flex" : "none"; };
helpBtn.addEventListener("click", () => setHelp(help.style.display === "none"));
help.addEventListener("click", (event) => { if(event.target === help) setHelp(false); });

window.addEventListener("keydown", (event)=>{
    if(event.ctrlKey || event.metaKey || event.altKey) return;
    if(event.key === "Escape") setHelp(false);
    if(event.target.tagName === "SELECT" || event.target.tagName === "INPUT") return;
    // a focused button already reacts to Space itself
    if(event.key === " " && event.target.tagName === "BUTTON") return;
    const btn = shortcuts[event.key.toLowerCase()];
    if(btn){
        event.preventDefault(); // Space would scroll the panel
        btn.click();
    }
});
