import * as THREE from 'https://esm.sh/three@0.150.0';
import { mergeVertices } from 'https://esm.sh/three@0.150.0/examples/jsm/utils/BufferGeometryUtils.js';
import {scene, camera, renderer} from './scene.js';
import {controls} from './controls.js';

export let modelLoaded = false;
export let currentObject = null;

// fix live binding #1 
export function setCurrentObject(obj){  
    currentObject = obj;
}

// fix live binding #2 
export function setModelLoaded(val){
    modelLoaded = val;
}

// default cube
const defaultCubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const defaultCubeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.0, roughness: 1});
const defaultCube = new THREE.Mesh(defaultCubeGeometry, defaultCubeMaterial);

defaultCube.castShadow = true;
defaultCube.receiveShadow = true;

scene.add(defaultCube);
currentObject = defaultCube;

// auto frame camera
export function frameCamera(object){
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

// load 3D model
export function loadModel(  url, file, loader){
    let objCount = 0;
    loader.load(url, function(result){
        const object = result.scene !== undefined ? result.scene : result;
        scene.remove(currentObject);
        scene.add(object);
        setModelLoaded(true);
        setCurrentObject(object);

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
            if(obj.isMesh){
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
        const toStandard = (mat) => {
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
        };
        object.traverse(function(obj){
            if(obj.isMesh && obj.material)
            {
                obj.material = Array.isArray(obj.material) ? obj.material.map(toStandard) : toStandard(obj.material);
            }
        })

        // file size
        const fileSize = file.size/1024/1024;

        // display mesh stats
        const statsPanel = document.getElementById("stats-panel");
        statsPanel.textContent = "";
        const rows = [
            ["name", fileName],
            ["no of objects", objCount],
            ["vertices", vertices],
            ["faces", faces],
            ["triangles", triangles],
            ["file size", `${fileSize.toFixed(2)} mb`]
        ];
        for(const [label, value] of rows){
            const strong = document.createElement("strong");
            strong.textContent = label;
            statsPanel.append(strong, ` : ${value}`, document.createElement("br"));
        }
    }, undefined, function(error){
        console.error(error);
    });
}