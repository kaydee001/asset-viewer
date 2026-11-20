// the Parts section of the left panel: the model's node tree with a visibility checkbox per node and
// a triangle count per mesh. clicking a mesh shows its materials underneath.
import * as THREE from './vendor/three/build/three.module.js';
import { triangleCount } from './stats.js';
import { ownMaterials } from './viewmodes.js';
import { formatCount } from './util.js';

const MAX_ROWS = 300; // cap the rows so huge scenes don't flood the DOM (the title still shows the full count)
const MAX_INDENT = 8; // deeper levels are drawn at the same indent

// texture slots worth listing in the material info, with their readable names
const MAP_SLOTS = {
    map: "Base color map", normalMap: "Normal map", roughnessMap: "Roughness map", metalnessMap: "Metalness map",
    aoMap: "AO map", emissiveMap: "Emissive map", alphaMap: "Alpha map", bumpMap: "Bump map"
};

// a type icon in front of each name, lucide-style paths on a 24 unit grid (style.css .part-icon).
// the formats only carry what three.js turns into these types: a Blender lattice or force field arrives
// as an empty, a curve as a line
const SVG_NS = "http://www.w3.org/2000/svg";
const ICONS = {
    scene: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    empty: '<path d="M12 12V3"/><path d="M12 12h9"/><path d="m12 12-7 7"/>',
    mesh: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    curve: '<circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/>',
    points: '<circle cx="6" cy="17" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="18" cy="14" r="1.5"/>',
    light: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    camera: '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    bone: '<path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"/>'
};
const TYPE_LABELS = {scene: "Scene", empty: "Empty", mesh: "Mesh", curve: "Curve", points: "Point cloud", light: "Light", camera: "Camera", bone: "Bone"};

function nodeType(node, depth){
    if(node.isMesh) return "mesh"; // also skinned and instanced meshes
    if(node.isLine) return "curve"; // lines, line segments and loops
    if(node.isPoints) return "points";
    if(node.isLight) return "light";
    if(node.isCamera) return "camera";
    if(node.isBone) return "bone";
    return depth === 0 ? "scene" : "empty";
}

function typeIcon(type){
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", `part-icon ${type}`);
    svg.innerHTML = `<title>${TYPE_LABELS[type]}</title>${ICONS[type]}`;
    return svg;
}

// rebuilt from scratch for every loaded model
export function buildOutliner(object){
    const list = document.getElementById("parts-list");
    const info = document.getElementById("material-info");
    list.textContent = "";
    info.textContent = "";

    let meshCount = 0;
    object.traverse(obj => { if(obj.isMesh) meshCount++; });
    document.getElementById("parts-count").textContent = formatCount(meshCount);

    let rows = 0;
    let selected = null;

    // depth first, so children are listed right under their parent
    function addNode(node, depth){
        if(rows >= MAX_ROWS) return;
        rows++;

        const row = document.createElement("div");
        row.className = "part";
        row.style.paddingLeft = `${8 + Math.min(depth, MAX_INDENT) * 12}px`;

        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = node.visible;
        check.addEventListener("change", () => { node.visible = check.checked; });

        const name = document.createElement("span");
        name.className = "part-name";
        name.textContent = node.name || (node.isMesh ? "mesh" : "node");
        name.title = name.textContent;

        const count = document.createElement("span");
        count.className = "part-tris";
        if(node.isMesh) count.textContent = formatCount(triangleCount(node.geometry));

        row.append(check, typeIcon(nodeType(node, depth)), name, count);
        if(node.isMesh){
            row.addEventListener("click", (event)=>{
                if(event.target === check) return;
                if(selected) selected.classList.remove("selected");
                selected = row;
                row.classList.add("selected");
                showMaterials(info, node);
            });
        } else {
            row.classList.add("group");
        }
        list.append(row);

        node.children.forEach(child => addNode(child, depth + 1));
    }
    addNode(object, 0);
}

// materials of one mesh (the model's own, even if a debug shading mode is active)
function showMaterials(info, mesh){
    info.textContent = "";
    ownMaterials(mesh).forEach((mat, i)=>{
        const box = document.createElement("div");
        box.className = "material";

        const head = document.createElement("div");
        head.className = "material-name";
        head.textContent = mat.name || `Material ${i + 1}`;
        box.append(head);

        const lines = [["Type", mat.type.replace("Mesh", "").replace("Material", "")]];
        if(mat.color) lines.push(["Color", `#${mat.color.getHexString()}`]);
        if(mat.roughness !== undefined) lines.push(["Roughness", mat.roughness.toFixed(2)]);
        if(mat.metalness !== undefined) lines.push(["Metalness", mat.metalness.toFixed(2)]);
        if(mat.transparent || mat.opacity < 1) lines.push(["Opacity", mat.opacity.toFixed(2)]);
        if(mat.side === THREE.DoubleSide) lines.push(["Sides", "Double"]);
        for(const [slot, label] of Object.entries(MAP_SLOTS)){
            if(!mat[slot]) continue;
            const image = mat[slot].image;
            lines.push([label, image && image.width ? `${image.width} × ${image.height}` : "Yes"]);
        }

        for(const [label, value] of lines){
            const row = document.createElement("div");
            row.className = "stat-row";
            const key = document.createElement("span");
            key.textContent = label;
            const val = document.createElement("span");
            val.textContent = value;
            row.append(key, val);
            box.append(row);
        }
        info.append(box);
    });
}
