// everything that makes up the stage: scene, camera, renderer, lighting (hdri + key light), grid.
// the model itself is added by loader.js
import * as THREE from './vendor/three/build/three.module.js';
import { RGBELoader } from './vendor/three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from './vendor/three/addons/environments/RoomEnvironment.js';
import { showToast } from './toast.js';

// canvas fills the whole window
const width = window.innerWidth;
const height = window.innerHeight;

// scene setup
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);
export const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});

// default camera setup
camera.position.set(2.5, 2.5, 2.5);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7; // lower = darker overall
renderer.outputEncoding = THREE.sRGBEncoding;

// render at 2x-3x resolution even on normal screens (supersampling) for smoother edges
// renderer.domElement -> canvas element
renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 2), 3));
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

// fix reloading after window resizing
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// directional light. the hdri does most of the lighting, this adds a key light on top of it.
// it is aimed from the brightest part of the hdri (see prepareEnvironment / updateSun), so it agrees
// with the way the hdri already lights the model
export const light1 = new THREE.DirectionalLight(0xffffff, 0.5);
light1.position.set(5, 10, 5);
scene.add(light1);

// the camera is a perspective camera in both modes. "orthographic" is the same camera with a 1 degree
// field of view, moved far back: parallel lines stay parallel to well under a percent, and everything
// that already uses this camera (orbit controls, framing, the view offset) keeps working unchanged
export const PERSPECTIVE_FOV = 50;
export const ORTHO_FOV = 1;
// how much farther the camera has to be in orthographic mode to show the same size
export const ORTHO_SCALE = Math.tan(THREE.MathUtils.degToRad(PERSPECTIVE_FOV) / 2) / Math.tan(THREE.MathUtils.degToRad(ORTHO_FOV) / 2);
export const projection = {orthographic: false, scale: 1}; // scale is 1 or ORTHO_SCALE

// hdri / environment lighting, falls back to a built-in room if the file is missing
const rgbeLoader = new RGBELoader();
const pmrem = new THREE.PMREMGenerator(renderer);
let fallbackEnvironment = null;

// the hdri is kept as a 1024 px wide copy so it can be turned quickly with the sun angle slider.
// three.js r150 cannot rotate an environment map, so turning it means shifting the image sideways
const ENV_WIDTH = 1024;
const halfToFloat = new Float32Array(65536);
for(let i = 0; i < 65536; i++) halfToFloat[i] = THREE.DataUtils.fromHalfFloat(i);

let envSource = null;   // {data, width, height} half float rgba of the current hdri
let envTexture = null;  // the turned copy that scene.environment shows
let sunElevation = Math.atan2(10, Math.hypot(5, 5)); // where the brightest light sits in the hdri (radians)
let sunAzimuth = Math.PI/4;                          // (before turning)
let envRotation = 0;                                 // radians, from the sun angle slider
let updatePending = false;

// shrinks the hdri to ENV_WIDTH and finds the direction of its brightest light
function prepareEnvironment(texture){
    const {data, width, height} = texture.image;
    const f = Math.max(1, Math.floor(width / ENV_WIDTH));
    const w = Math.floor(width / f);
    const h = Math.floor(height / f);
    const out = new Uint16Array(w * h * 4);
    const luminance = new Float32Array(w * h);
    const area = f * f;
    let brightest = 0;
    for(let y = 0; y < h; y++){
        for(let x = 0; x < w; x++){
            let r = 0, g = 0, b = 0;
            for(let j = 0; j < f; j++){
                for(let i = 0; i < f; i++){
                    const k = ((y * f + j) * width + x * f + i) * 4;
                    r += halfToFloat[data[k]];
                    g += halfToFloat[data[k + 1]];
                    b += halfToFloat[data[k + 2]];
                }
            }
            r /= area; g /= area; b /= area;
            const o = (y * w + x) * 4;
            out[o] = THREE.DataUtils.toHalfFloat(Math.min(r, 65504));
            out[o + 1] = THREE.DataUtils.toHalfFloat(Math.min(g, 65504));
            out[o + 2] = THREE.DataUtils.toHalfFloat(Math.min(b, 65504));
            out[o + 3] = 15360; // alpha 1.0
            luminance[y * w + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if(luminance[y * w + x] > brightest) brightest = luminance[y * w + x];
        }
    }
    envSource = {data: out, width: w, height: h};

    // brightest light = average direction of the pixels that are at least half as bright as the brightest one.
    // rows are stored top first: row 0 is straight up. u = atan(z, x) / 2pi + 0.5 is how three maps a direction to a column
    let sx = 0, sy = 0, sz = 0;
    for(let y = 0; y < h; y++){
        const elevation = (0.5 - (y + 0.5) / h) * Math.PI;
        for(let x = 0; x < w; x++){
            const l = luminance[y * w + x];
            if(l < brightest * 0.5) continue;
            const azimuth = ((x + 0.5) / w - 0.5) * 2 * Math.PI;
            const weight = l * Math.cos(elevation);
            sx += weight * Math.cos(elevation) * Math.cos(azimuth);
            sy += weight * Math.sin(elevation);
            sz += weight * Math.cos(elevation) * Math.sin(azimuth);
        }
    }
    sunAzimuth = Math.atan2(sz, sx);
    sunElevation = Math.atan2(sy, Math.hypot(sx, sz));
}

// puts the key light where the (turned) hdri brightest light is, kept between 30 and 75 degrees
// so a model is never lit flat from the side or straight from above
function updateSun(){
    const elevation = THREE.MathUtils.clamp(sunElevation, THREE.MathUtils.degToRad(30), THREE.MathUtils.degToRad(75));
    const azimuth = sunAzimuth + envRotation;
    const distance = 12;
    light1.position.set(
        Math.cos(elevation) * Math.cos(azimuth) * distance,
        Math.sin(elevation) * distance,
        Math.cos(elevation) * Math.sin(azimuth) * distance
    );
}

// builds the environment texture from envSource, shifted sideways by envRotation
function applyEnvironment(){
    updatePending = false;
    updateSun();
    if(!envSource) return;
    const {data, width, height} = envSource;
    const turns = ((envRotation / (2 * Math.PI)) % 1 + 1) % 1;
    const shift = Math.round(turns * width) % width * 4;
    const rowLength = width * 4;
    const turned = new Uint16Array(data.length);
    for(let y = 0; y < height; y++){
        const row = y * rowLength;
        // every row moves right by shift; what falls off the end comes back at the start
        turned.set(data.subarray(row, row + rowLength - shift), row + shift);
        turned.set(data.subarray(row + rowLength - shift, row + rowLength), row);
    }
    const texture = new THREE.DataTexture(turned, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = true;
    texture.needsUpdate = true;
    const previous = envTexture;
    envTexture = texture;
    scene.environment = texture;
    if(previous) previous.dispose();
}

// turn the lighting (hdri and key light together) around the model, in degrees. several calls in one frame cost one rebuild
export function setSunAngle(degrees){
    envRotation = THREE.MathUtils.degToRad(degrees);
    if(updatePending) return;
    updatePending = true;
    requestAnimationFrame(applyEnvironment);
}

function useFallbackEnvironment(){
    if(!fallbackEnvironment){
        fallbackEnvironment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    if(envTexture){
        envTexture.dispose();
        envTexture = null;
    }
    envSource = null;
    sunElevation = Math.atan2(10, Math.hypot(5, 5));
    sunAzimuth = Math.PI/4;
    scene.environment = fallbackEnvironment;
    updateSun();
}

// swap the hdri used for lighting + reflections (url can be a /hdri/ path or a blob: url from an upload,
// pass revoke = true for the latter so the blob is freed once it is read)
export function setEnvironment(url, revoke = false){
    rgbeLoader.load(url, function(texture){
        prepareEnvironment(texture);
        texture.dispose();
        applyEnvironment();
        if(revoke) URL.revokeObjectURL(url);
    }, undefined, function(error){
        console.error(error);
        if(revoke) URL.revokeObjectURL(url);
        if(!scene.environment) useFallbackEnvironment();
        showToast(revoke ? "could not read that HDRI file" : "could not load that HDRI, keeping the current lighting", {error: true});
    });
}
setEnvironment("/hdri/hdri_1.hdr");

// scene grid setup (12 units wide, 24 cells); sits just under y=0 so it doesn't z-fight with the model's base
const size = 12;
const divisions = 24;
export const gridHelper = new THREE.GridHelper(size, divisions, 0x3344aa, 0x888888);
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.5;
gridHelper.position.y = -0.01;
scene.add(gridHelper);

// the grid lines are mid grey, which suits a dark background; on a light one they are darkened
export function setGridTheme(dark){
    gridHelper.material.color.setHex(dark ? 0xffffff : 0x555555);
}
