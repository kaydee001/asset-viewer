import * as THREE from './vendor/three/build/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from './vendor/three/addons/loaders/FBXLoader.js';
import { OBJLoader } from './vendor/three/addons/loaders/OBJLoader.js';
import { MTLLoader } from './vendor/three/addons/loaders/MTLLoader.js';
import { DRACOLoader } from './vendor/three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from './vendor/three/addons/libs/meshopt_decoder.module.js';
import { mergeVertices } from './vendor/three/addons/utils/BufferGeometryUtils.js';
import { scene, camera } from './scene.js';
import { controls } from './controls.js';
import { setAnimations } from './animation.js';

const MODEL_SIZE = 4;

export let modelLoaded = false;
export let currentObject = null;

// default cube
const defaultCubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const defaultCubeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.0, roughness: 1});
const defaultCube = new THREE.Mesh(defaultCubeGeometry, defaultCubeMaterial);
defaultCube.position.y = 0.5;

defaultCube.castShadow = true;
defaultCube.receiveShadow = true;

scene.add(defaultCube);
currentObject = defaultCube;

// auto frame camera
export function frameCamera(object){
    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    // distance at which the bounding sphere just fits the view, with some margin
    const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.15;
    const direction = new THREE.Vector3(0, 0.45, 1).normalize();

    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    controls.target.copy(sphere.center);

    controls.minDistance = sphere.radius * 0.5;
    controls.maxDistance = sphere.radius * 10;

    controls.update();
}

// free gpu memory held by a removed object
function disposeObject(object){
    object.traverse(function(obj){
        if(obj.geometry) obj.geometry.dispose();
        if(!obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function(mat){
            Object.values(mat).forEach(value => { if(value && value.isTexture) value.dispose(); });
            mat.dispose();
        });
    });
}

// converting phong material to standard material
function toStandard(mat){
    if(!mat.isMeshPhongMaterial) return mat;
    const converted = new THREE.MeshStandardMaterial({
        color: mat.color,
        roughness: 0.5,
        metalness: 0,
        map: mat.map || null,
        emissive: mat.emissive || new THREE.Color(0x000000),
        emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1,
        emissiveMap: mat.emissiveMap || null
    });
    mat.dispose();
    return converted;
}

// blob urls of the model currently on screen, revoked when it is replaced
let activeUrls = [];

function fileKey(name){
    return name.split(/[\\/]/).pop().toLowerCase();
}

// load one model file, resolving sidecar files (.bin, .mtl, textures) from the dropped set
export async function loadModel(file, allFiles){
    const urls = new Map();
    const blobUrls = [];
    for(const f of allFiles){
        const blobUrl = URL.createObjectURL(f);
        blobUrls.push(blobUrl);
        urls.set(fileKey(f.name), blobUrl);
    }

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
            const draco = new DRACOLoader(manager).setDecoderPath("/static/vendor/three/addons/libs/draco/gltf/");
            const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
            result = await loader.loadAsync(url);
            draco.dispose();
        } else if(ext == "fbx"){
            result = await new FBXLoader(manager).loadAsync(url);
        } else {
            const loader = new OBJLoader(manager);
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

    const object = result.scene !== undefined ? result.scene : result;
    scene.remove(currentObject);
    disposeObject(currentObject);
    activeUrls.forEach(u => URL.revokeObjectURL(u));
    activeUrls = blobUrls;

    scene.add(object);
    modelLoaded = true;
    currentObject = object;

    // real-world size before normalizing
    const rawSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());

    object.traverse(function(obj){
        if(obj.isMesh && obj.material){
            obj.material = Array.isArray(obj.material) ? obj.material.map(toStandard) : toStandard(obj.material);
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });

    // normalize scale, center on x/z and rest on the grid
    const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z);
    if(rawMax > 0) object.scale.multiplyScalar(MODEL_SIZE / rawMax);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;

    frameCamera(object);
    setAnimations(object, result.animations);

    // calculate stats
    let objCount = 0;
    let vertices = 0;
    let triangles = 0;
    object.traverse(function(obj){
        if(!obj.isMesh) return;
        const merged = mergeVertices(obj.geometry);
        vertices += merged.attributes.position.count;
        merged.dispose();
        const count = obj.geometry.index ? obj.geometry.index.count : obj.geometry.attributes.position.count;
        triangles += count / 3;
        objCount += 1;
    });

    // display mesh stats
    const rows = [
        ["name", file.name],
        ["no of objects", objCount.toLocaleString()],
        ["vertices", vertices.toLocaleString()],
        ["faces", triangles.toLocaleString()],
        ["triangles", triangles.toLocaleString()],
        ["dimensions", `${rawSize.x.toFixed(2)} x ${rawSize.y.toFixed(2)} x ${rawSize.z.toFixed(2)}`],
        ["file size", `${(file.size/1024/1024).toFixed(2)} mb`]
    ];
    const statsPanel = document.getElementById("stats-panel");
    statsPanel.textContent = "";
    for(const [label, value] of rows){
        const strong = document.createElement("strong");
        strong.textContent = label;
        statsPanel.append(strong, ` : ${value}`, document.createElement("br"));
    }
}
