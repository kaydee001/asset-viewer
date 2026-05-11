import * as THREE from 'https://esm.sh/three@0.150.0';
import { GLTFLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/OBJLoader.js';
import { scene, camera, rgbeLoader, gridHelper } from './scene.js';
import { controls } from './controls.js';
import { loadModel, frameCamera, modelLoaded, currentObject } from './loader.js';

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
    bottomLockBtn.textContent = isLocked ? `- bottom lock [off]` : `- bottom lock [on]`;
});

// pan around object
const panBtn = document.getElementById("pan-btn");
panBtn.addEventListener("click", ()=>{
    controls.enablePan = !controls.enablePan;
    panBtn.textContent = controls.enablePan ? `- pan [on]` : `- pan [off]`;
});

// toggle auto rotate
controls.autoRotate = false;
const rotateBtn = document.getElementById("auto-rotate-btn");
rotateBtn.addEventListener("click", ()=>{
    controls.autoRotate = !controls.autoRotate;
    rotateBtn.textContent = controls.autoRotate ? `- auto rotate [on]` : `- auto rotate [off]`;
})
controls.autoRotateSpeed = 5.0;

// toggle wireframe mode
const wireframeBtn = document.getElementById("wireframe-btn");
wireframeBtn.addEventListener("click", () => {
    scene.traverse(function(obj){
        if(obj.type == "Mesh"){
            obj.material.wireframe = !obj.material.wireframe;
            wireframeBtn.textContent = obj.material.wireframe ? `- wireframe [on]` : `- wireframe [off]`;
        }
    })
});

// toggle scene grid
const gridBtn = document.getElementById("grid-btn");
gridBtn.addEventListener("click", ()=>{
    gridHelper.visible = !gridHelper.visible;
    gridBtn.textContent = gridHelper.visible ? `- grid [on]` : `- grid [off]`;
});

// toggle theme (light <-> dark)
const themeBtn = document.getElementById("theme-btn");
themeBtn.addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
    document.body.classList.toggle("light");
    themeBtn.textContent = document.body.classList.contains("dark") ? `- theme [dark]` : `- theme [light]`;
});

// reset back to default
const resetBtn = document.getElementById("reset-btn");
resetBtn.addEventListener("click", ()=>{
    controls.autoRotate = false;

    gridHelper.visible = true;

    controls.enablePan = false;

    controls.maxPolarAngle = Math.PI/2;
    bottomLockBtn.textContent = `- bottom lock [on]`;

    document.body.classList.remove("dark");
    themeBtn.textContent = `- theme [light]`;
    document.body.classList.add("light");

    scene.traverse(function(obj){
        if(obj.type == "Mesh"){
            obj.material.wireframe = false;
        }
    });
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

dropZone.addEventListener("drop", (event)=>{
    event.preventDefault();

    // remove current object
    scene.remove(currentObject);

    const file = event.dataTransfer.files[0];
    const fileName = file.name;
    const fileExt = fileName.split('.').pop().toLowerCase();   
    const url = URL.createObjectURL(file);

    if(fileExt == "gltf" || fileExt == "glb")
    {
        loadModel(url, file, new GLTFLoader());
    }
    else if(fileExt == "fbx")
    {
        loadModel(url, file, new FBXLoader());
    }   
    else if(fileExt == "obj")
    {
        loadModel(url, file, new OBJLoader());
    }

    document.getElementById("overlay").style.display = "none";
})