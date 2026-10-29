import * as THREE from './vendor/three/build/three.module.js';

// debug views that temporarily replace the model's own materials

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

const overrides = {
    clay: new THREE.MeshStandardMaterial({color: 0xc8c8c8, roughness: 0.85, metalness: 0}),
    normals: new THREE.MeshNormalMaterial(),
    uv: new THREE.MeshBasicMaterial({map: checkerTexture()})
};

let mode = "shaded";

// the model's own material is kept in userData so it can be restored and disposed later
export function applyViewMode(root, newMode = mode){
    mode = newMode;
    root.traverse(function(obj){
        if(!obj.isMesh) return;
        if(!obj.userData.originalMaterial) obj.userData.originalMaterial = obj.material;
        obj.material = mode === "shaded" ? obj.userData.originalMaterial : overrides[mode];
    });
}
