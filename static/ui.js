import { scene, camera, renderer, setEnvironment, gridHelper } from './scene.js';
import { controls } from './controls.js';
import { loadModel, frameCamera, modelLoaded, currentObject, modelRoot } from './loader.js';
import { showToast, hideToast } from './toast.js';
import { applyViewMode } from './viewmodes.js';

// toolbar buttons show their on/off state as a highlight
function setLabel(btn, name, isOn){
    btn.classList.toggle("active", isOn);
    btn.setAttribute("aria-checked", isOn);
}

// select hdri
const hdriSelect = document.getElementById("hdri-select");
hdriSelect.addEventListener("change", (event)=>{
    setEnvironment(`/hdri/${event.target.value}`);
    document.getElementById("hdri-name").textContent = "";
});

// upload hdri
const hdriUpload = document.getElementById("hdri-upload");
const uploadHdrBtn = document.getElementById("upload-hdri-btn");
uploadHdrBtn.addEventListener("click", ()=>{
    hdriUpload.click();
});
hdriUpload.addEventListener("change", (event)=>{
    const file = event.target.files[0];
    if(!file) return;
    setEnvironment(URL.createObjectURL(file));
    document.getElementById("hdri-name").textContent = file.name;
});

// bottom lock toggle
const bottomLockBtn = document.getElementById("bottom-lock-btn");
bottomLockBtn.addEventListener("click", ()=>{
    const isLocked = controls.maxPolarAngle === Math.PI/2;
    controls.maxPolarAngle = isLocked ? Math.PI : Math.PI/2;
    setLabel(bottomLockBtn, "bottom lock", !isLocked);
});

// pan around object
const panBtn = document.getElementById("pan-btn");
panBtn.addEventListener("click", ()=>{
    controls.enablePan = !controls.enablePan;
    setLabel(panBtn, "pan", controls.enablePan);
});

// toggle auto rotate
controls.autoRotate = false;
const rotateBtn = document.getElementById("auto-rotate-btn");
rotateBtn.addEventListener("click", ()=>{
    controls.autoRotate = !controls.autoRotate;
    setLabel(rotateBtn, "auto rotate", controls.autoRotate);
})
controls.autoRotateSpeed = 5.0;

// toggle wireframe mode
const wireframeBtn = document.getElementById("wireframe-btn");
let wireframeOn = false;
function setWireframe(value){
    wireframeOn = value;
    modelRoot.traverse(function(obj){
        if(!obj.isMesh) return;
        // set it on the model's own materials as well as whatever debug view is showing
        [obj.material, obj.userData.originalMaterial].filter(Boolean).forEach(function(source){
            const mats = Array.isArray(source) ? source : [source];
            mats.forEach(m => m.wireframe = wireframeOn);
        });
    });
    setLabel(wireframeBtn, "wireframe", wireframeOn);
}
wireframeBtn.addEventListener("click", () => setWireframe(!wireframeOn));

// shading mode (shaded, clay, normals, uv checker)
const shadingSelect = document.getElementById("shading-select");
shadingSelect.addEventListener("change", ()=>{
    applyViewMode(modelRoot, shadingSelect.value);
    setWireframe(wireframeOn);
});

// toggle scene grid
const gridBtn = document.getElementById("grid-btn");
gridBtn.addEventListener("click", ()=>{
    gridHelper.visible = !gridHelper.visible;
    setLabel(gridBtn, "grid", gridHelper.visible);
});

// toggle theme (light <-> dark)
const themeBtn = document.getElementById("theme-btn");
themeBtn.addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
    document.body.classList.toggle("light");
    setLabel(themeBtn, "theme", document.body.classList.contains("dark"));
});

// save the current view as a png
document.getElementById("screenshot-btn").addEventListener("click", ()=>{
    renderer.render(scene, camera);
    renderer.domElement.toBlob((blob)=>{
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "screenshot.png";
        link.click();
        URL.revokeObjectURL(link.href);
    });
});

// reset the camera view, other settings stay as they are
const resetBtn = document.getElementById("reset-btn");
resetBtn.addEventListener("click", ()=>{
    if (modelLoaded)
    {
        frameCamera(currentObject);
    }
    else
    {
        camera.position.set(2.5, 2.5, 2.5); 
        controls.target.set(0, 0.5, 0);
        controls.update();
    }
});

// keyboard shortcuts
const shortcuts = {
    w: wireframeBtn,
    g: gridBtn,
    r: rotateBtn,
    f: resetBtn,
    s: document.getElementById("screenshot-btn"),
    o: document.getElementById("open-btn"),
    t: themeBtn,
    p: panBtn,
    h: document.getElementById("hide-btn")
};

// tooltips: label plus its shortcut key
const keyOf = new Map(Object.entries(shortcuts).map(([key, btn]) => [btn, key.toUpperCase()]));
document.querySelectorAll(".tool").forEach(btn => {
    const key = keyOf.get(btn);
    btn.dataset.tip = key ? `${btn.dataset.label} (${key})` : btn.dataset.label;
});

document.getElementById("hide-btn").addEventListener("click", ()=>{
    document.body.classList.toggle("ui-hidden");
    if(document.body.classList.contains("ui-hidden")){
        showToast("interface hidden, press H to show it");
    }
});

window.addEventListener("keydown", (event)=>{
    if(event.ctrlKey || event.metaKey || event.altKey) return;
    if(event.target.tagName === "SELECT" || event.target.tagName === "INPUT") return;
    const btn = shortcuts[event.key.toLowerCase()];
    if(btn) btn.click();
});

// loading a model: one asset per session, .bin, .mtl and texture files in the same drop are used as its sidecars
const MODEL_EXTENSIONS = ["gltf", "glb", "fbx", "obj"];

const extOf = (file) => file.name.split('.').pop().toLowerCase();

async function openModel(file, files, ignored){
    showToast(`loading ${file.name}...`, {sticky: true});
    try {
        await loadModel(file, files);
        setWireframe(false);
        if(ignored){
            showToast(`loaded ${file.name}, ${ignored} other model(s) ignored (one asset per session)`);
        } else {
            hideToast();
        }
    } catch(error) {
        console.error(error);
        showToast(`could not load ${file.name}: ${error.message || error}`, {error: true});
    }
}

function handleFiles(files){
    const models = files.filter(f => MODEL_EXTENSIONS.includes(extOf(f)));
    if(!models.length){
        showToast("no supported model found (glb, gltf, fbx, obj)", {error: true});
        return;
    }
    openModel(models[0], files, models.length - 1);
}

// read dropped files, including everything inside dropped folders
function readEntry(entry){
    if(entry.isFile){
        return new Promise(resolve => entry.file(resolve, () => resolve(null))).then(f => f ? [f] : []);
    }
    return new Promise(function(resolve){
        const reader = entry.createReader();
        const all = [];
        const readBatch = () => reader.readEntries(async function(batch){
            if(!batch.length){
                resolve((await Promise.all(all.map(readEntry))).flat());
                return;
            }
            all.push(...batch);
            readBatch();
        }, () => resolve([]));
        readBatch();
    });
}

// drag and drop 3D model
const dropZone = document.body;
dropZone.addEventListener("dragover", (event)=>{
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("hover");
    document.getElementById("overlay").style.display = "flex";
})

dropZone.addEventListener("dragleave", (event)=>{
    // relatedTarget is null only when the drag leaves the window
    if(event.relatedTarget === null){
        document.getElementById("overlay").style.display = "none";
    }
})

dropZone.addEventListener("drop", async (event)=>{
    event.preventDefault();
    document.getElementById("overlay").style.display = "none";

    // entries must be grabbed synchronously, before the first await
    const entries = [...event.dataTransfer.items].map(item => item.webkitGetAsEntry && item.webkitGetAsEntry());
    const plainFiles = [...event.dataTransfer.files];
    const files = entries.every(Boolean)
        ? (await Promise.all(entries.map(readEntry))).flat()
        : plainFiles;
    handleFiles(files);
})

// open file button
const openInput = document.getElementById("open-input");
document.getElementById("open-btn").addEventListener("click", ()=> openInput.click());
openInput.addEventListener("change", (event)=>{
    handleFiles([...event.target.files]);
    openInput.value = "";
});

// collapse / expand panel sections
document.addEventListener("click", (event)=>{
    const title = event.target.closest(".section-title");
    if(title) title.parentElement.classList.toggle("collapsed");
});

// settings are remembered between launches
const SETTINGS_KEY = "asset-viewer-settings";
function saveSettings(){
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        dark: document.body.classList.contains("dark"),
        grid: gridHelper.visible,
        autoRotate: controls.autoRotate,
        pan: controls.enablePan,
        lock: controls.maxPolarAngle === Math.PI/2,
        hdri: hdriSelect.value,
        shading: shadingSelect.value
    }));
}
const rightPanel = document.getElementById("right-panel");
rightPanel.addEventListener("click", () => setTimeout(saveSettings));
rightPanel.addEventListener("change", saveSettings);

// dark is the default, the saved values only change what differs from it
let saved = {};
try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch(error) {}
if(saved.dark === false) themeBtn.click();
if(saved.grid === false) gridBtn.click();
if(saved.autoRotate) rotateBtn.click();
if(saved.pan) panBtn.click();
if(saved.lock === false) bottomLockBtn.click();
if(saved.hdri && hdriSelect.querySelector(`option[value="${saved.hdri}"]`)){
    hdriSelect.value = saved.hdri;
    if(saved.hdri !== "hdri_1.hdr") setEnvironment(`/hdri/${saved.hdri}`);
}
if(saved.shading && shadingSelect.querySelector(`option[value="${saved.shading}"]`)){
    shadingSelect.value = saved.shading;
    applyViewMode(modelRoot, saved.shading);
}

// a file passed on the command line (or "open with") is served by the local server
fetch("/startup-files").then(r => r.json()).then(async function(items){
    if(!items.length) return;
    const files = await Promise.all(items.map(async function(item){
        const blob = await (await fetch(item.url)).blob();
        return new File([blob], item.name);
    }));
    handleFiles(files);
}).catch(error => console.error(error));
