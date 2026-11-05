import * as THREE from './vendor/three/build/three.module.js';

// shading modes (the Shading dropdown): each one swaps every mesh's material for a shared override.
// "shaded" puts the model's own materials back

// 16x16 black/white checker drawn on a canvas, used to spot stretched or flipped UVs
function checkerTexture(){
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const cells = 16;
    const size = 512 / cells;
    for(let y = 0; y < cells; y++){
        for(let x = 0; x < cells; x++){
            ctx.fillStyle = (x + y) % 2 ? "#ffffff" : "#3a3a3a";
            ctx.fillRect(x * size, y * size, size, size);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 8;
    return texture;
}

// one shared material per mode (never disposed with the model)
const overrides = {
    clay: new THREE.MeshStandardMaterial({color: 0xc8c8c8, roughness: 0.85, metalness: 0}),
    normals: new THREE.MeshNormalMaterial(),
    uv: new THREE.MeshBasicMaterial({map: checkerTexture()}),
    vertexcolors: new THREE.MeshBasicMaterial({vertexColors: true}),
    novertexcolors: new THREE.MeshBasicMaterial({color: 0x808080}) // stand-in for meshes that have no color data
};

let mode = "shaded"; // remembered so a newly loaded model gets the active mode

// the model's own material is kept in userData so it can be restored and disposed later
export function applyViewMode(root, newMode = mode){
    mode = newMode;
    root.traverse(function(obj){
        if(!obj.isMesh) return;
        if(!obj.userData.originalMaterial) obj.userData.originalMaterial = obj.material;
        if(mode === "shaded") obj.material = obj.userData.originalMaterial;
        else if(mode === "vertexcolors") obj.material = obj.geometry.attributes.color ? overrides.vertexcolors : overrides.novertexcolors;
        else obj.material = overrides[mode];
    });
}
