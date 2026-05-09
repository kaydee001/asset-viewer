import * as THREE from 'https://esm.sh/three@0.150.0';
import { GLTFLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://esm.sh/three@0.150.0/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/RGBELoader.js';

// canvas size
const width = window.innerWidth;
const height = window.innerHeight;

// scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);        
const renderer = new THREE.WebGLRenderer({alpha: true});
const loader = new GLTFLoader();

// default camera
camera.position.set(2.5, 2.5, 2.5);

// adding hdri
const new_RGBELoader = new RGBELoader();

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

new_RGBELoader.load("/hdri/studio_small_08_4k.hdr", function(texture){
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;    
})

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

controls.maxPolarAngle = Math.PI/2;
controls.enablePan = false;

renderer.setSize(width, height);
// renderer.domElement -> canvas element
document.body.appendChild(renderer.domElement);

// toggle auto rotate
controls.autoRotate = false;
const rotateBtn = document.getElementById("auto-rotate-btn");
rotateBtn.addEventListener("click", ()=>{
    controls.autoRotate = !controls.autoRotate;
})
controls.autoRotateSpeed = 5.0;

// toggle wireframe mode
const wireframeBtn = document.getElementById("wireframe-btn");
wireframeBtn.addEventListener("click", () => {
    scene.traverse(function(obj){
        if(obj.type == "Mesh"){
            obj.material.wireframe = !obj.material.wireframe;
        }
    })
})

// toggle scene grid
const size = 20;
const divisions = 50;
const gridHelper = new THREE.GridHelper(size, divisions, 0x000099);
scene.add(gridHelper);
const gridBtn = document.getElementById("grid-btn");
gridBtn.addEventListener("click", ()=>{
    gridHelper.visible = !gridHelper.visible;
})

// default cube
const defaultCubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const defaultCubeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.0, roughness: 1});
const defaultCube = new THREE.Mesh(defaultCubeGeometry, defaultCubeMaterial);

defaultCube.castShadow = true;
defaultCube.receiveShadow = true;

scene.add(defaultCube);

// ground plane
// const planeGeometry = new THREE.PlaneGeometry(20, 20);
// const planeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1});
// const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);

// groundPlane.rotation.x = -Math.PI / 2;
// planeMaterial.visible = false;
// groundPlane.receiveShadow = true;

// scene.add(groundPlane);

// current object
let currentObject;
currentObject = defaultCube;

// drag and drop GLTF
const dropZone = document.body;
dropZone.addEventListener("dragover", (event)=>{
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("hover");
})

dropZone.addEventListener("drop", (event)=>{
    event.preventDefault();

    scene.remove(currentObject);

    const file = event.dataTransfer.files[0];
    const fileName = file.name;
    let objCount = 0;
    const url = URL.createObjectURL(file);

    // url, onLoad, onProgress, onError
    loader.load(url, function(gltf){
        scene.add(gltf.scene);

        // calculate stats
        let vertices = 0;
        let faces = 0;
        let triangles = 0;
        scene.traverse(function(obj){
            if(obj.type == "Mesh"){
                vertices += obj.geometry.attributes.position.count;
                if(obj.geometry.index){
                    faces += obj.geometry.index.count / 3;
                    triangles += obj.geometry.index.count / 3;
                } else {
                    triangles += obj.geometry.attributes.position.count / 3;
                }
                objCount += 1;
            }
            obj.castShadow = true;
            obj.receiveShadow = true;
        })
        // display mesh stats
        document.getElementById("stats-panel").innerHTML = `
        name : ${fileName}<br>
        no of objects : ${objCount}<br>
        vertices : ${vertices}<br>
        faces : ${faces}<br>
        triangles : ${triangles}<br>
        `;

        // remove current object
        scene.remove(defaultCube);
        currentObject = gltf.scene;

    }, undefined, function(error){
        console.error(error);
    });
})

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}
animate();