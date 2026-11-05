// getting files into the viewer: drag and drop (files or folders), the Open button, and the
// file passed on the command line. one asset per session: .bin, .mtl and texture files in the
// same drop are used as sidecars of the model.
import { loadModel } from './loader.js';
import { showToast, hideToast } from './toast.js';
import { setWireframe, updateCameraSelect } from './ui.js';

export const MODEL_EXTENSIONS = ["gltf", "glb", "fbx", "obj", "stl", "ply", "3mf"];

const extOf = (file) => file.name.split('.').pop().toLowerCase();

// load with a progress toast; errors are shown to the user instead of thrown
async function openModel(file, files, ignored){
    showToast(`loading ${file.name}...`, {sticky: true});
    try {
        await loadModel(file, files);
        setWireframe(false);
        updateCameraSelect();
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

// pick the first model out of whatever was dropped / chosen; the rest are its sidecars
function handleFiles(files){
    const models = files.filter(f => MODEL_EXTENSIONS.includes(extOf(f)));
    if(!models.length){
        showToast(`no supported model found (${MODEL_EXTENSIONS.join(", ")})`, {error: true});
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

// a file passed on the command line (or "open with") is served by the local server
fetch("/startup-files").then(r => r.json()).then(async function(items){
    if(!items.length) return;
    const files = await Promise.all(items.map(async function(item){
        const blob = await (await fetch(item.url)).blob();
        return new File([blob], item.name);
    }));
    handleFiles(files);
}).catch(error => console.error(error));
