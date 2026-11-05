// the model info card at the top of the left panel: name, counts, size
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

    const rows = [
        ["objects", objCount.toLocaleString()],
        ["materials", materials.size.toLocaleString()],
        ["vertices", vertices.toLocaleString()],
        ["triangles", triangles.toLocaleString()],
        ["size", `${rawSize.x.toFixed(2)} x ${rawSize.y.toFixed(2)} x ${rawSize.z.toFixed(2)}`],
        ["file size", `${(file.size/1024/1024).toFixed(2)} MB`]
    ];
    const statsPanel = document.getElementById("stats-panel");
    statsPanel.textContent = "";
    const title = document.createElement("div");
    title.className = "stat-name";
    title.textContent = file.name;
    statsPanel.append(title);
    for(const [label, value] of rows){
        const row = document.createElement("div");
        row.className = "stat-row";
        const key = document.createElement("span");
        key.textContent = label;
        const val = document.createElement("span");
        val.textContent = value;
        row.append(key, val);
        statsPanel.append(row);
    }
}

// unique vertex positions. indexed geometry already shares vertices, so its position count is used as is;
// unindexed geometry (fbx, obj, stl) repeats every corner, so identical positions are counted once
function countVertices(geometry){
    const position = geometry.attributes.position;
    if(geometry.index) return position.count;
    const seen = new Set();
    for(let i = 0; i < position.count; i++){
        seen.add(`${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`);
    }
    return seen.size;
}
