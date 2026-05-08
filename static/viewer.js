const width = window.innerWidth;
const height = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 1000);        
const renderer = new THREE.WebGLRenderer({alpha: true});
const loader = new THREE.GLTFLoader();

const new_RGBELoader = new THREE.RGBELoader();

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputEncoding = THREE.sRGBEncoding;

new_RGBELoader.load("/hdri/studio_small_08_4k.hdr", function(texture){
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;    
})

const controls = new THREE.OrbitControls(camera, renderer.domElement);

controls.zoomSpeed = 1.0;
// round table anim
controls.autoRotate = true;
controls.autoRotateSpeed = 5.0;

controls.minDistance = 5;
controls.maxDistance = 10;

controls.maxPolarAngle = Math.PI/2;

controls.enablePan = false;

renderer.setSize(width, height);
// renderer.domElement -> canvas element
document.body.appendChild(renderer.domElement);

camera.position.z = 5;

// const ambLight = new THREE.AmbientLight(0x555555);
// scene.add(ambLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
directionalLight1.position.set(5,-3,3);
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight2.position.set(-4,-0.7,3);
scene.add(directionalLight2);

const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.3);
directionalLight3.position.set(0.7,4,5);
scene.add(directionalLight3);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.0, roughness: 1});
const defaultCube = new THREE.Mesh(geometry, material);

let currentObject;

scene.add(defaultCube);
currentObject = defaultCube;

const dropZone = document.body;
dropZone.addEventListener("dragover", (event)=>{
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("hover");
})

dropZone.addEventListener("drop", (event)=>{
    event.preventDefault();

    scene.remove(currentObject);

    const file = event.dataTransfer.files[0];
    const url = URL.createObjectURL(file);

    // url, onLoad, onProgress, onError
    loader.load(url, function(gltf){
        scene.add(gltf.scene);
        let vertices = 0;
        let faces = 0;
        scene.traverse(function(obj){
            if(obj.type == "Mesh"){
                vertices += obj.geometry.attributes.position.count;
                if(obj.geometry.index){
                    faces += obj.geometry.index.count / 3;
                }
            }
        })
        document.getElementById("stats-panel").innerHTML = `vertices : ${vertices}<br>faces : ${faces}`;

        scene.remove(defaultCube);
        currentObject = gltf.scene;

    }, undefined, function(error){
        console.error(error);
    });
})

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}
animate();