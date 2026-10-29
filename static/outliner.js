// list of the model's meshes with a visibility checkbox each

const MAX_ROWS = 300;

export function buildOutliner(object){
    const list = document.getElementById("parts-list");
    const title = document.getElementById("parts-title");
    list.textContent = "";

    const meshes = [];
    object.traverse(obj => { if(obj.isMesh) meshes.push(obj); });
    title.firstChild.textContent = `Parts (${meshes.length})`;

    meshes.slice(0, MAX_ROWS).forEach(function(mesh, i){
        const row = document.createElement("label");
        row.className = "part";

        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = mesh.visible;
        check.addEventListener("change", () => { mesh.visible = check.checked; });

        const name = document.createElement("span");
        name.className = "part-name";
        name.textContent = mesh.name || `mesh ${i + 1}`;
        name.title = name.textContent;

        const geometry = mesh.geometry;
        const tris = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
        const count = document.createElement("span");
        count.className = "part-tris";
        count.textContent = Math.round(tris).toLocaleString();

        row.append(check, name, count);
        list.append(row);
    });
}
