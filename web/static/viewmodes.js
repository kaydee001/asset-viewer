import * as THREE from './vendor/three/build/three.module.js';
import { pixelRatioUniform } from './scene.js';

// shading modes (the Shading dropdown): each one swaps every mesh's material for a shared override.
// "shaded" puts the model's own materials back. wireframe sits on top of any mode: one flat colour,
// whatever the shading, so the wires read the same in every mode

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

// the wireframe colour follows the theme (setWireframeTheme): light wires on the dark stage, dark on the light one.
// like the grid it is a guide, so exposure and tone mapping leave it alone.
// not GL wireframe lines: those are one device pixel wide, so they looked dimmer in the supersampled still
// frame than in the 1x frame drawn while moving. instead each triangle is filled and everything but a band
// along its edges is discarded, the band being WIRE_WIDTH CSS pixels wide at any pixel ratio (as the grid
// in scene.js). built on MeshBasicMaterial, so skinned and morphing meshes still deform
const WIRE_WIDTH = 1;
const wireMaterial = new THREE.MeshBasicMaterial({transparent: true, side: THREE.DoubleSide, toneMapped: false});
wireMaterial.onBeforeCompile = function(shader){
    shader.uniforms.wireWidth = {value: WIRE_WIDTH};
    shader.uniforms.pixelRatio = pixelRatioUniform;
    shader.vertexShader = shader.vertexShader
        .replace("void main() {", "attribute vec3 wireBary;\nvarying vec3 vWireBary;\nvoid main() {\n\tvWireBary = wireBary;");
    shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform float wireWidth;\nuniform float pixelRatio;\nvarying vec3 vWireBary;\nvoid main() {")
        .replace("#include <output_fragment>", `#include <output_fragment>
            // distance to each edge of the triangle in device pixels, and how much of this pixel the band covers
            vec3 wireDistance = vWireBary / fwidth(vWireBary);
            vec3 wireCover = clamp(wireWidth * pixelRatio * 0.5 + 0.5 - wireDistance, 0.0, 1.0);
            float wireEdge = max(max(wireCover.x, wireCover.y), wireCover.z);
            if(wireEdge <= 0.0) discard;
            gl_FragColor.a *= wireEdge;`);
};
wireMaterial.customProgramCacheKey = () => "asset-viewer-wire";

export function setWireframeTheme(dark){
    wireMaterial.color.setHex(dark ? 0xd2d2d6 : 0x2c2c30).convertSRGBToLinear();
}
setWireframeTheme(true);

// the edge band needs each triangle's own corners, so the wireframe draws a copy of the geometry with
// unshared vertices and a barycentric attribute. made the first time it is needed, kept in userData
// (loader.js disposes it with the model)
function wireGeometry(mesh){
    if(mesh.userData.wireGeometry) return mesh.userData.wireGeometry;
    const solid = mesh.userData.solidGeometry || mesh.geometry;
    const geometry = solid.index ? solid.toNonIndexed() : solid.clone();
    const corners = new Float32Array(geometry.attributes.position.count * 3);
    for(let i = 0; i < corners.length; i += 9){
        corners[i] = 1; corners[i + 4] = 1; corners[i + 8] = 1;
    }
    geometry.setAttribute("wireBary", new THREE.BufferAttribute(corners, 3));
    mesh.userData.solidGeometry = solid;
    mesh.userData.wireGeometry = geometry;
    return geometry;
}

let mode = "shaded";     // remembered so a newly loaded model gets the active mode
let wireframe = false;

// the object's own materials as an array, also while a shading mode or the wireframe has swapped them out
export function ownMaterials(object){
    return [].concat(object.userData.originalMaterial || object.material || []);
}

// the model's own material is kept in userData so it can be restored and disposed later
export function applyViewMode(root, newMode = mode, newWireframe = wireframe){
    mode = newMode;
    wireframe = newWireframe;
    root.traverse(function(obj){
        if(!obj.isMesh) return;
        if(!obj.userData.originalMaterial) obj.userData.originalMaterial = obj.material;
        obj.geometry = wireframe ? wireGeometry(obj) : (obj.userData.solidGeometry || obj.geometry);
        if(wireframe) obj.material = wireMaterial;
        else if(mode === "shaded") obj.material = obj.userData.originalMaterial;
        else if(mode === "vertexcolors") obj.material = obj.geometry.attributes.color ? overrides.vertexcolors : overrides.novertexcolors;
        else obj.material = overrides[mode];
    });
}
