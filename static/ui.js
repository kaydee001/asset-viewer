import * as THREE from 'https://esm.sh/three@0.150.0';
import { GLTFLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/OBJLoader.js';
import { scene, camera, rgbeLoader, gridHelper } from './scene.js';
import { controls } from './controls.js';
import { loadModel, frameCamera, modelLoaded, currentObject } from './loader.js';

// keeps button text in sync with state
function setLabel(btn, name, isOn, onText = "on", offText = "off"){
    btn.textContent = `- ${name} [${isOn ? onText : offText}]`;
}

// select hdri
const hdriSelect = document.getElementById("hdri-select");
hdriSelect.addEventListener("change", (event)=>{
    const updatedHDRI = event.target.value;
    rgbeLoader.load(`/hdri/${updatedHDRI}`, function(texture){
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;    
    })
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
    const url = URL.createObjectURL(file);
    rgbeLoader.load(url, function(texture){
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;    
    })
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
        controls.target.set(0, 0, 0);
        controls.update();
    }
});

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

dropZone.addEventListener("drop", (event)=>{
    event.preventDefault();
    document.getElementById("overlay").style.display = "none";

    const file = event.dataTransfer.files[0];
    if(!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    const loaders = {
        gltf: GLTFLoader,
        glb: GLTFLoader,
        fbx: FBXLoader,
        obj: OBJLoader
    };
    const LoaderClass = loaders[fileExt];
    if(!LoaderClass) return;

    setWireframe(false);
    loadModel(URL.createObjectURL(file), file, new LoaderClass());
})
