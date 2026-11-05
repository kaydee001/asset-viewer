// the Parts section of the left panel: the model's node tree with a visibility checkbox per node and
// a triangle count per mesh. clicking a mesh shows its materials underneath.

const MAX_ROWS = 300; // cap the rows so huge scenes don't flood the DOM (the title still shows the full count)
const MAX_INDENT = 8; // deeper levels are drawn at the same indent

// texture slots worth listing in the material info
const MAP_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap"];

// rebuilt from scratch for every loaded model
export function buildOutliner(object){
    const list = document.getElementById("parts-list");
    const title = document.getElementById("parts-title");
    const info = document.getElementById("material-info");
    list.textContent = "";
    info.textContent = "";

    let meshCount = 0;
    object.traverse(obj => { if(obj.isMesh) meshCount++; });
    title.firstChild.textContent = `Parts (${meshCount})`;

    let rows = 0;
    let selected = null;

    // depth first, so children are listed right under their parent
    function addNode(node, depth){
        if(rows >= MAX_ROWS) return;
        rows++;

        const row = document.createElement("div");
        row.className = "part";
        row.style.paddingLeft = `${2 + Math.min(depth, MAX_INDENT) * 12}px`;

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
        if(node.isMesh){
            // non-indexed geometry has 3 vertices per triangle, indexed has 3 indices per triangle
            const geometry = node.geometry;
            const tris = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
            count.textContent = Math.round(tris).toLocaleString();
        }

        row.append(check, name, count);
        if(node.isMesh){
            row.addEventListener("click", function(event){
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
    const source = mesh.userData.originalMaterial || mesh.material;
    [].concat(source).forEach(function(mat, i){
        const box = document.createElement("div");
        box.className = "material";

        const head = document.createElement("div");
        head.className = "material-name";
        head.textContent = mat.name || `material ${i + 1}`;
        box.append(head);

        const lines = [["type", mat.type.replace("Mesh", "").replace("Material", "")]];
        if(mat.color) lines.push(["color", `#${mat.color.getHexString()}`]);
        if(mat.roughness !== undefined) lines.push(["roughness", mat.roughness.toFixed(2)]);
        if(mat.metalness !== undefined) lines.push(["metalness", mat.metalness.toFixed(2)]);
        if(mat.transparent || mat.opacity < 1) lines.push(["opacity", mat.opacity.toFixed(2)]);
        if(mat.side === 2) lines.push(["sides", "double"]);
        MAP_SLOTS.forEach(function(slot){
            const image = mat[slot] && mat[slot].image;
            if(mat[slot]) lines.push([slot, image && image.width ? `${image.width} x ${image.height}` : "yes"]);
        });

        lines.forEach(function([label, value]){
            const row = document.createElement("div");
            row.className = "stat-row";
            const key = document.createElement("span");
            key.textContent = label;
            const val = document.createElement("span");
            val.textContent = value;
            row.append(key, val);
            box.append(row);
        });
        info.append(box);
    });
}
