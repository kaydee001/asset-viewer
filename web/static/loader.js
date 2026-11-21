// loading a model into the scene. flow of loadModel():
//   1. make blob urls for every dropped file so sidecars (.bin, .mtl, textures) can be found by name
//   2. parse with the loader that matches the extension (FORMATS below)
//   3. swap it in for the previous model, normalize its size and position
//   4. apply the shading mode, frame the camera, start animations, fill stats (stats.js) + parts list
import * as THREE from './vendor/three/build/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from './vendor/three/addons/loaders/FBXLoader.js';
import { OBJLoader } from './vendor/three/addons/loaders/OBJLoader.js';
import { MTLLoader } from './vendor/three/addons/loaders/MTLLoader.js';
import { KTX2Loader } from './vendor/three/addons/loaders/KTX2Loader.js';
import { STLLoader } from './vendor/three/addons/loaders/STLLoader.js';
import { PLYLoader } from './vendor/three/addons/loaders/PLYLoader.js';
import { ThreeMFLoader } from './vendor/three/addons/loaders/3MFLoader.js';
import { DRACOLoader } from './vendor/three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from './vendor/three/addons/libs/meshopt_decoder.module.js';
import { scene, camera, renderer, projection, PERSPECTIVE_FOV, ORTHO_FOV, HOME_POSITION, requestRender } from './scene.js';
import { controls } from './controls.js';
import { setAnimations } from './animation.js';
import { applyViewMode, ownMaterials } from './viewmodes.js';
import { buildOutliner } from './outliner.js';
import { showStats } from './stats.js';
import { setBoundingTarget } from './overlays.js';
import { extensionOf } from './util.js';

const MODEL_SIZE = 4; // every model is scaled so its longest side is this many units
const VENDOR = "/static/vendor/three/addons/libs";

// one shared KTX2 (basis) texture decoder; it spawns workers, so it is created once on first use
let ktx2Loader = null;
function getKtx2Loader(){
    if(!ktx2Loader) ktx2Loader = new KTX2Loader().setTranscoderPath(`${VENDOR}/basis/`).detectSupport(renderer);
    return ktx2Loader;
}

async function loadGltf(url, manager){
    // the draco decoder is bundled, so compressed models work offline too. it runs in workers, freed after the load
    const draco = new DRACOLoader(manager).setDecoderPath(`${VENDOR}/draco/gltf/`);
    try {
        const loader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(getKtx2Loader()).setMeshoptDecoder(MeshoptDecoder);
        return await loader.loadAsync(url);
    } finally {
        draco.dispose();
    }
}

async function loadObj(url, manager, files){
    const loader = new OBJLoader(manager);
    // obj has no materials of its own, use a dropped .mtl if there is one
    const mtl = files.find(f => extensionOf(f.name) === "mtl");
    if(mtl){
        const materials = new MTLLoader(manager).parse(await mtl.text(), "");
        materials.preload();
        loader.setMaterials(materials);
    }
    return loader.loadAsync(url);
}

// stl and ply give a bare geometry, wrap it in a mesh. models without normals (common for stl) get flat-shaded ones computed
function meshFromGeometry(geometry){
    if(!geometry.attributes.normal) geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({color: 0xcccccc, roughness: 0.6, metalness: 0, vertexColors: !!geometry.attributes.color});
    return new THREE.Mesh(geometry, material);
}

// every format the viewer opens, by extension: (url, manager, all dropped files) -> a three.js object, or
// gltf's {scene, animations, cameras}. the same list is in src-tauri/src/startup.rs and the file associations
// in src-tauri/tauri.conf.json (a cargo test keeps those two in step)
const FORMATS = {
    glb: loadGltf,
    gltf: loadGltf,
    fbx: (url, manager) => new FBXLoader(manager).loadAsync(url),
    obj: loadObj,
    stl: async (url, manager) => meshFromGeometry(await new STLLoader(manager).loadAsync(url)),
    ply: async (url, manager) => meshFromGeometry(await new PLYLoader(manager).loadAsync(url)),
    "3mf": (url, manager) => new ThreeMFLoader(manager).loadAsync(url)
};
export const MODEL_EXTENSIONS = Object.keys(FORMATS);

let modelLoaded = false;          // false while the default cube is showing
export let currentObject = null;  // what "reset view" frames
export let modelCameras = [];     // cameras stored in the loaded gltf (perspective only)

// everything the user loaded lives under this group
export const modelRoot = new THREE.Group();
scene.add(modelRoot);
let loadToken = 0; // incremented per load, lets a slow older load notice it was superseded

// default cube shown until the first model is loaded
const defaultCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0, roughness: 1})
);
defaultCube.position.y = 0.5;
modelRoot.add(defaultCube);
setBoundingTarget(defaultCube);
currentObject = defaultCube;

// a model opened from Explorer is already on its way (main.rs), so the cube and the drop hint stay hidden
// instead of flashing up while it loads
if(window.__AV_OPENING__){
    defaultCube.visible = false;
    document.body.classList.add("opening");
}

// the startup model is in, or failed to load: back to the normal empty state if nothing was loaded
export function endOpening(){
    if(!document.body.classList.contains("opening")) return;
    document.body.classList.remove("opening");
    if(!modelLoaded){
        defaultCube.visible = true;
        setBoundingTarget(defaultCube);
        requestRender();
    }
}

// put the camera at a 3/4 angle far enough away that the whole object is in view.
// box: the object's exact bounds if the caller already has them (measuring walks every vertex)
export function frameCamera(object, box = new THREE.Box3().setFromObject(object, true)){
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    // distance at which the bounding sphere just fits the view, with some margin
    camera.fov = projection.orthographic ? ORTHO_FOV : PERSPECTIVE_FOV; // back to the default after viewing through a gltf camera
    camera.updateProjectionMatrix();
    const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.15;
    const direction = new THREE.Vector3(0, 0.45, 1).normalize();

    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    controls.target.copy(sphere.center);

    controls.minDistance = sphere.radius * 0.5 * projection.scale;
    controls.maxDistance = sphere.radius * 10 * projection.scale;

    controls.update();
    requestRender();
}

// "reset view": frame the model, or go back to the starting view of the default cube
export function resetView(){
    if(modelLoaded){
        frameCamera(currentObject);
        return;
    }
    camera.position.copy(HOME_POSITION).multiplyScalar(projection.scale);
    controls.target.set(0, 0.5, 0);
    controls.update();
}

// free gpu memory held by a removed object
function disposeObject(object){
    object.traverse((obj)=>{
        // the wireframe's copy of the geometry too (viewmodes.js), if one was made
        new Set([obj.geometry, obj.userData.solidGeometry, obj.userData.wireGeometry]).forEach(g => g && g.dispose());
        // a shading mode may be active: dispose the model's own materials, not the shared override
        for(const mat of ownMaterials(obj)){
            Object.values(mat).forEach(value => { if(value && value.isTexture) value.dispose(); });
            mat.dispose();
        }
    });
}

// converting phong material to standard material, so the hdri lights every model the same way.
// phong has no roughness, so shininess is mapped to one (shininess 30 is the old default -> about 0.5)
function toStandard(mat){
    if(!mat.isMeshPhongMaterial) return mat;
    const converted = new THREE.MeshStandardMaterial({
        color: mat.color,
        roughness: THREE.MathUtils.clamp(1 - Math.sqrt(mat.shininess / 100), 0.05, 1),
        metalness: 0,
        map: mat.map || null,
        normalMap: mat.normalMap || null,
        alphaMap: mat.alphaMap || null,
        opacity: mat.opacity,
        transparent: mat.transparent,
        side: mat.side,
        vertexColors: mat.vertexColors,
        emissive: mat.emissive || new THREE.Color(0x000000),
        emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1,
        emissiveMap: mat.emissiveMap || null
    });
    mat.dispose();
    return converted;
}

// blob urls of the model currently on screen, revoked when it is replaced
let activeUrls = [];

// sidecar lookup key: file name only (no folders), lowercase, so paths inside a model file still match
function fileKey(name){
    return name.split(/[\\/]/).pop().toLowerCase();
}

// load one model file, resolving sidecar files (.bin, .mtl, textures) from the dropped set
export async function loadModel(file, allFiles){
    const load = FORMATS[extensionOf(file.name)];
    if(!load) throw new Error(`unsupported file type (${MODEL_EXTENSIONS.join(", ")})`);

    const token = ++loadToken;
    const urls = new Map();
    const blobUrls = [];
    for(const f of allFiles){
        const blobUrl = URL.createObjectURL(f);
        blobUrls.push(blobUrl);
        urls.set(fileKey(f.name), blobUrl);
    }
    const revokeAll = () => blobUrls.forEach(u => URL.revokeObjectURL(u));

    // redirect any url the loaders ask for (e.g. "textures/wood.png") to the matching dropped file.
    // the loaders resolve a sidecar against the model's own url, which is a blob url here, so a .gltf's
    // "scene.bin" arrives as "blob:http://tauri.localhost/scene.bin": only our own blob urls (and data: urls)
    // pass through untouched, everything else is matched by its file name
    const ownUrls = new Set(blobUrls);
    const manager = new THREE.LoadingManager();
    // textures can finish after the model is on screen (fbx, obj), draw them as they arrive
    manager.onProgress = requestRender;
    manager.setURLModifier((url)=>{
        if(url.startsWith("data:") || ownUrls.has(url)) return url;
        return urls.get(fileKey(decodeURIComponent(url.split("?")[0]))) || url;
    });

    let result;
    try {
        result = await load(urls.get(fileKey(file.name)), manager, allFiles);
    } catch(error) {
        revokeAll();
        throw error;
    }

    // gltf returns {scene, animations, cameras}, the others return the object itself
    const object = result.scene !== undefined ? result.scene : result;

    // a newer load started while this one was reading, drop this result
    if(token !== loadToken){
        disposeObject(object);
        revokeAll();
        return;
    }

    // one asset per session: remove and free the previous model (or the default cube)
    for(const child of [...modelRoot.children]){
        modelRoot.remove(child);
        disposeObject(child);
    }
    activeUrls.forEach(u => URL.revokeObjectURL(u));
    activeUrls = blobUrls;

    modelRoot.add(object);
    modelLoaded = true;
    currentObject = object;

    // original size, shown in the stats panel (the model itself gets rescaled below)
    const box = new THREE.Box3().setFromObject(object, true);
    const rawSize = box.getSize(new THREE.Vector3());

    // standard materials so the hdri lights every model the same way
    object.traverse((obj)=>{
        if(obj.isMesh && obj.material){
            obj.material = Array.isArray(obj.material) ? obj.material.map(toStandard) : toStandard(obj.material);
        }
    });

    // normalize scale, center on x/z and rest on the grid.
    // scaling the root by k around its own position moves every point p to pos + k(p - pos), and so does
    // the box, so it is adjusted here instead of walking every vertex again
    const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z);
    if(rawMax > 0){
        const k = MODEL_SIZE / rawMax;
        const pivot = object.getWorldPosition(new THREE.Vector3());
        object.scale.multiplyScalar(k);
        box.min.sub(pivot).multiplyScalar(k).add(pivot);
        box.max.sub(pivot).multiplyScalar(k).add(pivot);
    }
    const center = box.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    object.position.add(offset);
    object.updateMatrixWorld(true);
    box.translate(offset);

    applyViewMode(object);
    setBoundingTarget(object);
    modelCameras = (result.cameras || []).filter(c => c.isPerspectiveCamera);

    frameCamera(object, box);
    setAnimations(object, result.animations);

    showStats(object, file, rawSize);
    document.body.classList.add("has-model");
    buildOutliner(object);
    document.title = `${file.name} - Asset Viewer`;
}
