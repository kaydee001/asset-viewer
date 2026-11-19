// the model info at the top of the left panel: name, format, counts, dimensions
export function showStats(object, file, rawSize){
    let objCount = 0;
    let vertices = 0;
    let triangles = 0;
    const materials = new Set();
    object.traverse(function(obj){
        if(!obj.isMesh) return;
        [].concat(obj.userData.originalMaterial || obj.material).forEach(m => materials.add(m));
        vertices += countVertices(obj.geometry);
        const count = obj.geometry.index ? obj.geometry.index.count : obj.geometry.attributes.position.count;
        triangles += count / 3;
        objCount += 1;
    });

    const statsPanel = document.getElementById("stats-panel");
    statsPanel.textContent = "";

    const title = document.createElement("div");
    title.className = "stat-name";
    title.textContent = file.name;
    title.title = file.name;
    const extension = file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "";
    const meta = document.createElement("div");
    meta.className = "stat-meta";
    meta.textContent = [extension, formatBytes(file.size)].filter(Boolean).join(" · ");
    statsPanel.append(title, meta);

    // counts as a 2 x 2 grid of figures
    const figures = document.createElement("div");
    figures.className = "figures";
    for(const [label, value] of [
        ["Triangles", triangles], ["Vertices", vertices], ["Objects", objCount], ["Materials", materials.size]
    ]){
        const cell = document.createElement("div");
        cell.className = "figure";
        const key = document.createElement("span");
        key.textContent = label;
        const val = document.createElement("strong");
        val.textContent = Math.round(value).toLocaleString("en-US");
        cell.append(key, val);
        figures.append(cell);
    }
    statsPanel.append(figures);

    // size per axis, lettered in the same colours as the axes gizmo (helpers.js)
    const dims = document.createElement("div");
    dims.className = "dims";
    const dimsLabel = document.createElement("span");
    dimsLabel.className = "dims-label";
    dimsLabel.textContent = "Dimensions";
    dims.append(dimsLabel);
    for(const axis of ["x", "y", "z"]){
        const cell = document.createElement("span");
        cell.className = "dim";
        const letter = document.createElement("i");
        letter.className = `axis axis-${axis}`;
        letter.textContent = axis.toUpperCase();
        cell.append(letter, rawSize[axis].toFixed(2));
        dims.append(cell);
    }
    statsPanel.append(dims);
}

function formatBytes(bytes){
    if(bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("en-US")} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// unique vertex positions. indexed geometry already shares vertices, so its position count is used as is;
// unindexed geometry (fbx, obj, stl) repeats every corner, so identical positions are counted once.
// positions are rounded to 1e-4 and kept in an open addressing hash table that stores the index of the
// first corner seen at each position (one Int32Array, no strings), which keeps this fast and small
// for scans with millions of corners
function countVertices(geometry){
    const position = geometry.attributes.position;
    if(geometry.index) return position.count;
    const n = position.count;
    let capacity = 1;
    while(capacity < n * 2) capacity *= 2;
    const mask = capacity - 1;
    const slots = new Int32Array(capacity).fill(-1); // corner index, -1 = empty
    const sameAs = (k, x, y, z) => Math.round(position.getX(k) * 1e4) === x
        && Math.round(position.getY(k) * 1e4) === y && Math.round(position.getZ(k) * 1e4) === z;
    let unique = 0;
    for(let i = 0; i < n; i++){
        const x = Math.round(position.getX(i) * 1e4);
        const y = Math.round(position.getY(i) * 1e4);
        const z = Math.round(position.getZ(i) * 1e4);
        let slot = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) & mask;
        for(;;){
            const k = slots[slot];
            if(k === -1){
                slots[slot] = i;
                unique++;
                break;
            }
            if(sameAs(k, x, y, z)) break;
            slot = (slot + 1) & mask;
        }
    }
    return unique;
}
