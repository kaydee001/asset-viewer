import * as THREE from 'https://esm.sh/three@0.150.0';
import { GLTFLoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://esm.sh/three@0.150.0/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/RGBELoader.js';

const width = window.innerWidth;
const height = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);        
const renderer = new THREE.WebGLRenderer({alpha: true});
const loader = new GLTFLoader();

const new_RGBELoader = new RGBELoader();

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

new_RGBELoader.load("/hdri/studio_small_08_4k.hdr", function(texture){
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;    
})

const controls = new OrbitControls(camera, renderer.domElement);

controls.zoomSpeed = 1.0;

controls.autoRotate = false;
const rotateBtn = document.getElementById("auto-rotate-btn");
rotateBtn.addEventListener("click", (event)=>{
    controls.autoRotate = !controls.autoRotate;
})
controls.autoRotateSpeed = 5.0;

const wireframeBtn = document.getElementById("wireframe-btn");
wireframeBtn.addEventListener("click", () => {
    scene.traverse(function(obj){
        if(obj.type == "Mesh"){
            obj.material.wireframe = !obj.material.wireframe;
        }
    })
})

controls.minDistance = 5;
controls.maxDistance = 10;

controls.maxPolarAngle = Math.PI/2;

controls.enablePan = false;

renderer.setSize(width, height);
// renderer.domElement -> canvas element
document.body.appendChild(renderer.domElement);

camera.position.set(2.5, 2.5, 2.5);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.0, roughness: 1});
const defaultCube = new THREE.Mesh(geometry, material);

const size = 20;
const divisions = 50;
const gridHelper = new THREE.GridHelper(size, divisions, 0x000099);
scene.add(gridHelper);

let currentObject;

scene.add(defaultCube);
currentObject = defaultCube;

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
    const url = URL.createObjectURL(file);

    // url, onLoad, onProgress, onError
    loader.load(url, function(gltf){
        scene.add(gltf.scene);
        let vertices = 0;
        let faces = 0;
        scene.traverse(function(obj){
            if(obj.type == "Mesh"){
                vertices += obj.geometry.attributes.position.count;
                if(obj.geometry.index){
                    faces += obj.geometry.index.count / 3;
                }
            }
        })
        document.getElementById("stats-panel").innerHTML = `vertices : ${vertices}<br>faces : ${faces}`;

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