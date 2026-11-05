// loading a model into the scene. flow of loadModel():
//   1. make blob urls for every dropped file so sidecars (.bin, .mtl, textures) can be found by name
//   2. parse with the loader that matches the extension (gltf/glb, fbx, obj, stl, ply, 3mf)
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
import { scene, camera, renderer, projection, PERSPECTIVE_FOV, ORTHO_FOV } from './scene.js';
import { controls } from './controls.js';
import { setAnimations } from './animation.js';
import { applyViewMode } from './viewmodes.js';
import { buildOutliner } from './outliner.js';
import { showStats } from './stats.js';
import { setBoundingTarget } from './helpers.js';

const MODEL_SIZE = 4; // every model is scaled so its longest side is this many units

export let modelLoaded = false;  // false while the default cube is showing
export let currentObject = null;  // what "reset view" frames
export let modelCameras = [];     // cameras stored in the loaded gltf (perspective only)

// everything the user loaded lives under this group
export const modelRoot = new THREE.Group();
scene.add(modelRoot);
let loadToken = 0; // incremented per load, lets a slow older load notice it was superseded

// default cube shown until the first model is loaded
const defaultCubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const defaultCubeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.0, roughness: 1});
const defaultCube = new THREE.Mesh(defaultCubeGeometry, defaultCubeMaterial);
defaultCube.position.y = 0.5;


modelRoot.add(defaultCube);
setBoundingTarget(defaultCube);
currentObject = defaultCube;

// put the camera at a 3/4 angle far enough away that the whole object is in view
export function frameCamera(object){
    const box = new THREE.Box3().setFromObject(object, true);
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
}

// free gpu memory held by a removed object
function disposeObject(object){
    object.traverse(function(obj){
        if(obj.geometry) obj.geometry.dispose();
        if(!obj.material) return;
        // a debug view may be active, dispose the model's own materials, not the shared override
        const source = obj.userData.originalMaterial || obj.material;
        const mats = Array.isArray(source) ? source : [source];
        mats.forEach(function(mat){
            Object.values(mat).forEach(value => { if(value && value.isTexture) value.dispose(); });
            mat.dispose();
        });
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

// one shared KTX2 (basis) texture decoder; it spawns workers, so it is created once on first use
let ktx2Loader = null;
function getKtx2Loader(){
    if(!ktx2Loader){
        ktx2Loader = new KTX2Loader().setTranscoderPath("/static/vendor/three/addons/libs/basis/").detectSupport(renderer);
    }
    return ktx2Loader;
}

// stl and ply give a bare geometry, wrap it in a mesh. models without normals (common for stl) get flat-shaded ones computed
function meshFromGeometry(geometry){
    if(!geometry.attributes.normal) geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({color: 0xcccccc, roughness: 0.6, metalness: 0, vertexColors: !!geometry.attributes.color});
    return new THREE.Mesh(geometry, material);
}

// blob urls of the model currently on screen, revoked when it is replaced
let activeUrls = [];

// sidecar lookup key: file name only (no folders), lowercase, so paths inside a model file still match
function fileKey(name){
    return name.split(/[\\/]/).pop().toLowerCase();
}

// load one model file, resolving sidecar files (.bin, .mtl, textures) from the dropped set
export async function loadModel(file, allFiles){
    const token = ++loadToken;
    const urls = new Map();
    const blobUrls = [];
    for(const f of allFiles){
        const blobUrl = URL.createObjectURL(f);
        blobUrls.push(blobUrl);
        urls.set(fileKey(f.name), blobUrl);
    }

    // redirect any url the loaders ask for (e.g. "textures/wood.png") to the matching dropped file
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(function(url){
        if(url.startsWith("blob:") || url.startsWith("data:")) return url;
        return urls.get(fileKey(decodeURIComponent(url.split("?")[0]))) || url;
    });

    const ext = file.name.split('.').pop().toLowerCase();
    const url = urls.get(fileKey(file.name));
    let result;
    try {
        if(ext == "gltf" || ext == "glb"){
            // draco decoder is bundled locally, so compressed models work offline too
            const draco = new DRACOLoader(manager).setDecoderPath("/static/vendor/three/addons/libs/draco/gltf/");
            const loader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(getKtx2Loader()).setMeshoptDecoder(MeshoptDecoder);
            result = await loader.loadAsync(url);
            draco.dispose();
        } else if(ext == "fbx"){
            result = await new FBXLoader(manager).loadAsync(url);
        } else if(ext == "stl"){
            result = meshFromGeometry(await new STLLoader(manager).loadAsync(url));
        } else if(ext == "ply"){
            result = meshFromGeometry(await new PLYLoader(manager).loadAsync(url));
        } else if(ext == "3mf"){
            result = await new ThreeMFLoader(manager).loadAsync(url);
        } else {
            const loader = new OBJLoader(manager);
            // obj has no materials of its own, use a dropped .mtl if there is one
            const mtl = allFiles.find(f => f.name.toLowerCase().endsWith(".mtl"));
            if(mtl){
                const materials = new MTLLoader(manager).parse(await mtl.text(), "");
                materials.preload();
                loader.setMaterials(materials);
            }
            result = await loader.loadAsync(url);
        }
    } catch(error) {
        blobUrls.forEach(u => URL.revokeObjectURL(u));
        throw error;
    }

    // gltf returns {scene, animations}, the others return the object itself
    const object = result.scene !== undefined ? result.scene : result;

    // a newer load started while this one was reading, drop this result
    if(token !== loadToken){
        disposeObject(object);
        blobUrls.forEach(u => URL.revokeObjectURL(u));
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
    const rawSize = new THREE.Box3().setFromObject(object, true).getSize(new THREE.Vector3());

    // standard materials so the hdri lights every model the same way
    object.traverse(function(obj){
        if(obj.isMesh && obj.material){
            obj.material = Array.isArray(obj.material) ? obj.material.map(toStandard) : toStandard(obj.material);
        }
    });

    // normalize scale, center on x/z and rest on the grid
    const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z);
    if(rawMax > 0) object.scale.multiplyScalar(MODEL_SIZE / rawMax);
    const box = new THREE.Box3().setFromObject(object, true);
    const center = box.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;

    applyViewMode(object);
    setBoundingTarget(object);
    modelCameras = (result.cameras || []).filter(c => c.isPerspectiveCamera);

    frameCamera(object);
    setAnimations(object, result.animations);

    showStats(object, file, rawSize);
    document.body.classList.add("has-model");
    buildOutliner(object);
    document.title = `${file.name} - Asset Viewer`;
}
