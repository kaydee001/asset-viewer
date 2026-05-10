import * as THREE from 'https://esm.sh/three@0.150.0';
import { GLTFLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'https://esm.sh/three@0.150.0/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/RGBELoader.js';
import { mergeVertices } from 'https://esm.sh/three@0.150.0/examples/jsm/utils/BufferGeometryUtils.js';

// canvas size
const width = window.innerWidth;
const height = window.innerHeight;

// scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);        
const renderer = new THREE.WebGLRenderer({alpha: true});
const loader = new GLTFLoader();

// default camera setup
camera.position.set(2.5, 2.5, 2.5);

// adding hdri / renderer setup
const new_RGBELoader = new RGBELoader();

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

new_RGBELoader.load("/hdri/hdri_1.hdr", function(texture){
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;    
})
// select hdri
const hdriSelect = document.getElementById("hdri-select");
hdriSelect.addEventListener("change", (event)=>{
    const updatedHDRI = event.target.value;
    new_RGBELoader.load(`/hdri/${updatedHDRI}`, function(texture){
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
    new_RGBELoader.load(url, function(texture){
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;    
    })
    document.getElementById("hdri-name").textContent = file.name;
});

// directional light
const light1 = new THREE.DirectionalLight(0x333333, 0.5);
light1.position.set(5, 10, 5);
scene.add(light1);

// adding shadows
renderer.shadowMap.enabled = true;
light1.castShadow = true;

// scene controls
const controls = new OrbitControls(camera, renderer.domElement);

controls.zoomSpeed = 1.0;
controls.minDistance = 5;
controls.maxDistance = 10;

controls.enablePan = false;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI/2;

// bottom lock toggle
const bottomLockBtn = document.getElementById("bottom-lock-btn");
bottomLockBtn.addEventListener("click", ()=>{
    const isLocked = controls.maxPolarAngle === Math.PI/2;  
    controls.maxPolarAngle = isLocked ? Math.PI : Math.PI/2;
    bottomLockBtn.textContent = isLocked ? `- bottom lock [off]` : `- bottom lock [on]`;
});

// renderer.domElement -> canvas element
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

// pan around object
const panBtn = document.getElementById("pan-btn");
panBtn.addEventListener("click", ()=>{
    controls.enablePan = !controls.enablePan;
    panBtn.textContent = controls.enablePan ? `- pan [on]` : `- pan [off]`;
});

let modelLoaded = false;
// default cube
const defaultCubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const defaultCubeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.0, roughness: 1});
const defaultCube = new THREE.Mesh(defaultCubeGeometry, defaultCubeMaterial);

defaultCube.castShadow = true;
defaultCube.receiveShadow = true;

scene.add(defaultCube);

// current object
let currentObject;
currentObject = defaultCube;

// auto frame camera
function frameCamera(object){
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    camera.position.set(center.x, center.y+maxDim*1.5, center.z+maxDim*3);
    controls.target.set(center.x, center.y, center.z);

    controls.minDistance = maxDim * 0.5;
    controls.maxDistance = maxDim * 10;

    controls.update();
}

// scene grid setup
const size = 20;
const divisions = 50;
const gridHelper = new THREE.GridHelper(size, divisions, 0x000099);
scene.add(gridHelper);
gridHelper.position.y = -0.01;
    
// ground plane
// const planeGeometry = new THREE.PlaneGeometry(20, 20);
// const planeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1});
// const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);

// groundPlane.rotation.x = -Math.PI / 2;
// planeMaterial.visible = false;
// groundPlane.receiveShadow = true;

// scene.add(groundPlane);

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

// drag and drop GLTF
const dropZone = document.body;
dropZone.addEventListener("dragover", (event)=>{
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("hover");
    document.getElementById("overlay").style.display = "flex";
})

function loadModel(url, file, loader)
{
    let objCount = 0;
    loader.load(url, function(result){
        const object = result.scene !== undefined ? result.scene : result;
        scene.add(object);
        modelLoaded = true;
        currentObject = object;

        // normalize fbx scale
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if(maxDim > 100)
        {
            object.scale.setScalar(1 / (maxDim/10));
        }

        frameCamera(object);

        // calculate stats
        const fileName = file.name;

        let vertices = 0;
        let faces = 0;
        let triangles = 0;

        scene.traverse(function(obj){
            if(obj.type == "Mesh"){
                const merged = mergeVertices(obj.geometry);
                vertices += merged.attributes.position.count;

                if(obj.geometry.index){
                    const tris = obj.geometry.index.count / 3;
                    triangles += tris;
                    faces +=  tris;
                } else {
                    const tris = obj.geometry.attributes.position.count / 3;
                    triangles += tris;
                    faces +=  tris;
                }
                
                objCount += 1;
            }
            obj.castShadow = true;
            obj.receiveShadow = true;
        })

        // converting phong material to standard material
        object.traverse(function(obj){
            if(obj.isMesh && obj.material)
            {
                if(obj.material.isMeshPhongMaterial)
                {
                    obj.material = new THREE.MeshStandardMaterial({
                        color: obj.material.color,
                        roughness: obj.material.roughness !== undefined ? obj.material.roughness : 0.5,
                        metalness: obj.material.metalness !== undefined ? obj.material.metalness : 1,
                        map: obj.material.map || null,
                        emissive: obj.material.emissive || new THREE.Color(0x000000),
                        emissiveIntensity: obj.material.emissiveIntensity !== undefined ? obj.material.emissiveIntensity : 1,
                        emissiveMap: obj.material.emissiveMap || null
                    });
                }
            }
        })

        // file size
        const fileSize = file.size/1024/1024;

        // display mesh stats
        document.getElementById("stats-panel").innerHTML = `
        <strong>name</strong> : ${fileName}<br>
        <strong>no</strong> of objects : ${objCount}<br>
        <strong>vertices</strong> : ${vertices}<br>
        <strong>faces</strong> : ${faces}<br>
        <strong>triangles</strong> : ${triangles}<br>
        <strong>file size</strong> : ${fileSize.toFixed(2)} mb<br>
        `;
    }, undefined, function(error){
        console.error(error);
    });
}

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

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}
animate();