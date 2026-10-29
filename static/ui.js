import { scene, camera, renderer, setEnvironment, gridHelper } from './scene.js';
import { controls } from './controls.js';
import { loadModel, frameCamera, modelLoaded, currentObject } from './loader.js';
import { showToast, hideToast } from './toast.js';

// keeps button text in sync with state
function setLabel(btn, name, isOn, onText = "on", offText = "off"){
    btn.textContent = `- ${name} [${isOn ? onText : offText}]`;
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
    scene.traverse(function(obj){
        if(obj.isMesh && obj.material){
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => m.wireframe = wireframeOn);
        }
    });
    setLabel(wireframeBtn, "wireframe", wireframeOn);
}
wireframeBtn.addEventListener("click", () => setWireframe(!wireframeOn));

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
    setLabel(themeBtn, "theme", document.body.classList.contains("dark"), "dark", "light");
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

// reset back to default
const resetBtn = document.getElementById("reset-btn");
resetBtn.addEventListener("click", ()=>{
    controls.autoRotate = false;
    setLabel(rotateBtn, "auto rotate", false);

    gridHelper.visible = true;
    setLabel(gridBtn, "grid", true);

    controls.enablePan = false;
    setLabel(panBtn, "pan", false);

    controls.maxPolarAngle = Math.PI/2;
    setLabel(bottomLockBtn, "bottom lock", true);

    document.body.classList.remove("dark");
    document.body.classList.add("light");
    setLabel(themeBtn, "theme", false, "dark", "light");

    setWireframe(false);
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
    o: document.getElementById("open-btn")
};
for(const [key, btn] of Object.entries(shortcuts)){
    btn.title = `shortcut: ${key.toUpperCase()}`;
}
window.addEventListener("keydown", (event)=>{
    if(event.ctrlKey || event.metaKey || event.altKey) return;
    if(event.target.tagName === "SELECT" || event.target.tagName === "INPUT") return;
    const key = event.key.toLowerCase();
    if(key === "h"){
        document.body.classList.toggle("ui-hidden");
        return;
    }
    const btn = shortcuts[key];
    if(btn) btn.click();
});

// loading models: a drop / file pick can hold several models plus their .bin, .mtl and texture files
const MODEL_EXTENSIONS = ["gltf", "glb", "fbx", "obj"];
const assetList = document.getElementById("asset-list");
let droppedFiles = [];

const extOf = (file) => file.name.split('.').pop().toLowerCase();

async function openModel(file){
    showToast(`loading ${file.name}...`, {sticky: true});
    try {
        await loadModel(file, droppedFiles);
        setWireframe(false);
        assetList.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.name === file.name));
        hideToast();
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
    droppedFiles = files;

    // list every model so several can be browsed, click one to view it
    assetList.textContent = "";
    if(models.length > 1){
        for(const model of models){
            const item = document.createElement("button");
            item.textContent = model.name;
            item.title = model.name;
            item.dataset.name = model.name;
            item.addEventListener("click", () => openModel(model));
            assetList.append(item);
        }
    }
    openModel(models[0]);
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
