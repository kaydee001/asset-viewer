import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// canvas size
const width = window.innerWidth;
const height = window.innerHeight;

// scene setup
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);
export const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});

// default camera setup
camera.position.set(2.5, 2.5, 2.5);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// renderer.domElement -> canvas element
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

// fix reloading after window resizing
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// hdri / environment lighting, falls back to a built-in room if the file is missing
const rgbeLoader = new RGBELoader();
const pmrem = new THREE.PMREMGenerator(renderer);
let fallbackEnvironment = null;

function useFallbackEnvironment(){
    if(!fallbackEnvironment){
        fallbackEnvironment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    scene.environment = fallbackEnvironment;
}

export function setEnvironment(url){
    rgbeLoader.load(url, function(texture){
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const previous = scene.environment;
        scene.environment = texture;
        if(previous && previous !== fallbackEnvironment) previous.dispose();
    }, undefined, function(error){
        console.error(error);
        if(!scene.environment) useFallbackEnvironment();
    });
}
setEnvironment("/hdri/hdri_1.hdr");

// directional light + shadows
const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
light1.position.set(5, 10, 5);
light1.castShadow = true;
light1.shadow.camera.left = -5;
light1.shadow.camera.right = 5;
light1.shadow.camera.top = 5;
light1.shadow.camera.bottom = -5;
light1.shadow.mapSize.set(2048, 2048);
scene.add(light1);
renderer.shadowMap.enabled = true;

// invisible ground that only shows the model's shadow
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({opacity: 0.25})
);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// scene grid setup
const size = 20;
const divisions = 40;
export const gridHelper = new THREE.GridHelper(size, divisions, 0x000099);
gridHelper.position.y = -0.01;
scene.add(gridHelper);
