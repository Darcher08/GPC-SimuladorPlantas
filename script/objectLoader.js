import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export function loadFBX(scene, config = {}, showL) {
    let {
        filePath,
        scale = 0.1,
        position = { x: 0, y: -1, z: 0 },
        autoCenter = true
    } = config;

    if (!showL) {
        showL = false
    }

    if (!filePath) {
        console.error('Se requiere especificar la ruta del archivo FBX');
        return;
    }

    const loader = new FBXLoader();

    return new Promise((resolve, reject) => {
        loader.load(filePath, function (object) {
            scene.add(object);

            // Habilitar sombras
            object.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }

                // Para habilitar el uso de luces
                if (showL == true) {
                    if (child.isLight) {
                        if (child instanceof THREE.SpotLight || child instanceof THREE.DirectionalLight || child instanceof THREE.PointLight) {
                            child.castShadow = true;
                            if (child.shadow && child.shadow.mapSize) {
                                child.shadow.mapSize.width = 1024;
                                child.shadow.mapSize.height = 1024;
                                child.shadow.bias = -0.0001;
                            }
                        }
                    }
                }

            });


            // Centrar modelo si autoCenter es true
            if (autoCenter) {
                const box = new THREE.Box3().setFromObject(object);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                object.position.sub(center);
            }

            // Aplicar escala y posición
            const maxDim = scale;
            object.scale.setScalar(maxDim);
            object.position.set(position.x, position.y, position.z);

            // Info del modelo
            let info = `<p class="success">✓ Modelo cargado: ${filePath.split("/").pop()}</p>`;
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            info += `<p>Dimensiones: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}</p>`;

            let meshCount = 0;
            let vertexCount = 0;
            let materialInfo = [];

            object.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                    if (child.geometry) {
                        vertexCount += child.geometry.attributes.position.count;
                    }

                    if (child.material) {
                        const mat = child.material;
                        let matText = `<strong>${child.name || "Mesh"}:</strong><br>`;

                        if (mat.map) matText += `&nbsp;&nbsp;- Color Map: ✓<br>`;
                        if (mat.normalMap) matText += `&nbsp;&nbsp;- Normal Map: ✓<br>`;
                        if (mat.roughnessMap) matText += `&nbsp;&nbsp;- Roughness Map: ✓<br>`;
                        if (mat.metalnessMap) matText += `&nbsp;&nbsp;- Metalness Map: ✓<br>`;

                        materialInfo.push(matText);
                    }
                }
            });

            info += `<p>Meshes: ${meshCount}<br>Vértices: ${vertexCount.toLocaleString()}</p>`;

            if (materialInfo.length > 0) {
                info += "<p><strong>Materiales y Texturas:</strong></p>";
                materialInfo.forEach(
                    (mat) => (info += `<p style="font-size:12px; margin:5px 0;">${mat}</p>`)
                );
            }

            // Animaciones
            let mixer;
            if (object.animations && object.animations.length > 0) {
                info += `<p>Animaciones: ${object.animations.length}</p>`;
                mixer = new THREE.AnimationMixer(object);
                const action = mixer.clipAction(object.animations[0]);
                action.play();
            }

            resolve({
                object,
                info,
                mixer
            });
        },
            undefined, // onProgress callback
            (error) => {
                reject(error);
            });
    });
}
