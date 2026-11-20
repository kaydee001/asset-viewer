// getting files into the viewer: drag and drop (files or folders), the Open button, and the
// file passed on the command line. one asset per session: .bin, .mtl and texture files in the
// same drop are used as sidecars of the model.
import { loadModel, endOpening, MODEL_EXTENSIONS } from './loader.js';
import { showToast, hideToast } from './toast.js';
import { setWireframe, updateCameraSelect } from './ui.js';
import { BACKEND } from './shell.js';
import { extensionOf } from './util.js';

// the empty state lists what can be opened
document.getElementById("hint-formats").textContent = MODEL_EXTENSIONS.join(" · ");

// load with a progress toast; errors are shown to the user instead of thrown
async function openModel(file, files, ignored){
    showToast(`Loading ${file.name}…`, {sticky: true});
    try {
        await loadModel(file, files);
        setWireframe(false);
        updateCameraSelect();
        if(ignored){
            showToast(`Opened ${file.name}. ${ignored} other ${ignored === 1 ? "model was" : "models were"} skipped, one asset per session`);
        } else {
            hideToast();
        }
    } catch(error) {
        console.error(error);
        showToast(`Could not load ${file.name}: ${error.message || error}`, {error: true});
    }
}

// pick the first model out of whatever was dropped / chosen; the rest are its sidecars
async function handleFiles(files){
    const models = files.filter(f => MODEL_EXTENSIONS.includes(extensionOf(f.name)));
    if(!models.length){
        showToast(`No supported model found (${MODEL_EXTENSIONS.join(", ")})`, {error: true});
        return;
    }
    await openModel(models[0], files, models.length - 1);
}

// read dropped files, including everything inside dropped folders
function readEntry(entry){
    if(entry.isFile){
        return new Promise(resolve => entry.file(resolve, () => resolve(null))).then(f => f ? [f] : []);
    }
    return new Promise((resolve)=>{
        const reader = entry.createReader();
        const all = [];
        const readBatch = () => reader.readEntries(async (batch)=>{
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

// drag and drop, anywhere on the window
const overlay = document.getElementById("overlay");
document.body.addEventListener("dragover", (event)=>{
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    overlay.hidden = false;
});

document.body.addEventListener("dragleave", (event)=>{
    // relatedTarget is null only when the drag leaves the window
    if(event.relatedTarget === null) overlay.hidden = true;
});

document.body.addEventListener("drop", async (event)=>{
    event.preventDefault();
    overlay.hidden = true;

    // entries must be grabbed synchronously, before the first await
    const entries = [...event.dataTransfer.items].map(item => item.webkitGetAsEntry && item.webkitGetAsEntry());
    const plainFiles = [...event.dataTransfer.files];
    const files = entries.every(Boolean)
        ? (await Promise.all(entries.map(readEntry))).flat()
        : plainFiles;
    handleFiles(files);
});

// open file button
const openInput = document.getElementById("open-input");
document.getElementById("open-btn").addEventListener("click", () => openInput.click());
openInput.addEventListener("change", ()=>{
    handleFiles([...openInput.files]);
    openInput.value = "";
});

// a file passed on the command line (or "open with") is served by the shell (shell.js, protocol.rs)
async function fetchOk(url){
    const response = await fetch(url);
    if(!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
    return response;
}

async function openStartupFiles(){
    const items = await (await fetchOk(`${BACKEND}/startup-files`)).json();
    if(!items.length) return;
    const files = await Promise.all(items.map(async (item) => {
        const blob = await (await fetchOk(BACKEND + item.url)).blob();
        return new File([blob], item.name);
    }));
    await handleFiles(files);
}
openStartupFiles().catch((error)=>{
    console.error(error);
    showToast("Could not open the file passed on the command line", {error: true});
}).finally(endOpening);
