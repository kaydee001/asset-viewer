import * as THREE from 'https://esm.sh/three@0.150.0';
import { RGBELoader } from 'https://esm.sh/three@0.150.0/examples/jsm/loaders/RGBELoader.js';

// canvas size
const width = window.innerWidth;
const height = window.innerHeight;

// scene setup
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);        
export const renderer = new THREE.WebGLRenderer({alpha: true});

// default camera setup
camera.position.set(2.5, 2.5, 2.5);

// adding hdri / renderer setup
export const rgbeLoader = new RGBELoader();
rgbeLoader.load("/hdri/hdri_1.hdr", function(texture){
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;    
});

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// renderer.domElement -> canvas element
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

// directional light
const light1 = new THREE.DirectionalLight(0x333333, 0.5);
light1.position.set(5, 10, 5);
scene.add(light1);

// adding shadows
renderer.shadowMap.enabled = true;
light1.castShadow = true;

// scene grid setup
const size = 20;
const divisions = 40;
export const gridHelper = new THREE.GridHelper(size, divisions, 0x000099);
gridHelper.position.y = -0.01;
scene.add(gridHelper);