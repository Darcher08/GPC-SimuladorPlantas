import * as THREE from 'three';
import { CameraMovement } from './camera.js';
import { loadFBX } from './objectLoader.js';
import * as CLASE from './clases_objetos3d.js';

let scene, camera, renderer, cameraMovement;
let cube, mixer;
let clock = new THREE.Clock();
let piso;

const posicionesUsadas = [];
let macetas = [];

let cajas = [];
const posicionesUsadasCajas = [];

let sun;
let moon;

// Configuración del grid
const GRID_SIZE = 20;
const GRID_HALF = GRID_SIZE / 2;

// Variables del sistema de riego
let modoRiego = false;

async function init() {
  // 1. Configurar la escena
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);

  const DIVISIONS = 10;
  const _colorCenterLine = 0xff0000;
  const _colorGrid = 0xE6E6E6;

  const gridHelper = new THREE.GridHelper(GRID_SIZE, DIVISIONS, _colorCenterLine, _colorGrid);
  scene.add(gridHelper);
  gridHelper.position.y = 0.5;

  // 2. Configurar la cámara
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    .1,
    1000
  );
  camera.position.set(0, 12, 25);
  camera.lookAt(0, 0, 0);

  // 3. Configurar el renderizador
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 4. Instanciar el control de cámara
  cameraMovement = new CameraMovement(camera, document.body);

  // 5. Añadir luces
  const ambientLight = new THREE.AmbientLight(0x87CEEB, 1.5);
  scene.add(ambientLight);

  // Guardar referencia global para animación
  window.ambientLight = ambientLight;

  // Cargar todos los objetos a la escena
  const numMacetas = 5;
  await crearMacetasAleatorias(numMacetas);

  const numCajas = Math.ceil(numMacetas / 2);
  await crearCajasAleatorias(numCajas);

  // Actualizar posiciones de cajas después de crearlas
  cajas.forEach(caja => {
    if (caja.refObjeto) {
      const pos = caja.refObjeto.position;
      caja.actualizarPosicion(pos.x, pos.z);
    }
  });

  //* PISO
  piso = new CLASE.RocaPiso(scene);
  await piso.cargarObjeto();

  //* SOL
  sun = new CLASE.Sol(scene);
  await sun.cargarObjeto();
  sun.refObjeto.position.set(0, 40, 0);
  sun.refObjeto.scale.setScalar(0.09);

  sun.refObjeto.castShadow = false;
  sun.refObjeto.receiveShadow = false;
  sun.refObjeto.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  const sunLight = new THREE.DirectionalLight(0xF28B16, 3);
  sunLight.castShadow = true;

  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 150;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;

  sun.refObjeto.add(sunLight);

  sunLight.position.set(0, 0, 0);
  sunLight.target.position.set(0, -40, 0);
  sun.refObjeto.add(sunLight.target);

  //* LUNA
  moon = new CLASE.Luna(scene);
  await moon.cargarObjeto();
  moon.refObjeto.position.set(0, -40, 0); // Posición inicial opuesta al sol
  moon.refObjeto.scale.setScalar(0.06);

  moon.refObjeto.castShadow = false;
  moon.refObjeto.receiveShadow = false;
  moon.refObjeto.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });

  // Luz de la luna - azul tenue
  const moonLight = new THREE.DirectionalLight(0xB0C4DE, 0.8);
  moonLight.castShadow = false;

  moonLight.shadow.mapSize.width = 1024;
  moonLight.shadow.mapSize.height = 1024;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 150;
  moonLight.shadow.camera.left = -50;
  moonLight.shadow.camera.right = 50;
  moonLight.shadow.camera.top = 50;
  moonLight.shadow.camera.bottom = -50;

  moon.refObjeto.add(moonLight);

  moonLight.position.set(0, 0, 0);
  moonLight.target.position.set(0, 40, 0); // Apunta hacia abajo cuando está arriba
  moon.refObjeto.add(moonLight.target);

  // Calcular vecinos para todas las macetas
  macetas.forEach(maceta => {
    maceta.calcularVecinos(macetas, cajas);
  });

  // Configurar controles
  setupControls();

  // 9. Manejar redimensionamiento de ventana
  window.addEventListener('resize', onWindowResize);

  // 10. Iniciar animación
  animate();
}

async function crearMacetasAleatorias(cantidad) {
  const distanciaMinima = 2;

  for (let i = 0; i < cantidad; i++) {
    let posicionValida = false;
    let x, z;
    let intentos = 0;
    const maxIntentos = 50;

    while (!posicionValida && intentos < maxIntentos) {
      x = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);
      z = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);

      posicionValida = true;
      for (const pos of posicionesUsadas) {
        const distancia = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(z - pos.z, 2));
        if (distancia < distanciaMinima) {
          posicionValida = false;
          break;
        }
      }
      intentos++;
    }

    const maceta = new CLASE.Maceta(scene);
    await maceta.cargarObjeto();

    if (maceta.refObjeto) {
      maceta.refObjeto.position.set(x, 0, z);
      maceta.actualizarPosicion(x, z);
      maceta.refObjeto.rotation.y = Math.random() * Math.PI * 2;
    }

    macetas.push(maceta);
    posicionesUsadas.push({ x, z });

    console.log(`Maceta ${i + 1} creada en posición (${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
}

const DISTANCIA_MINIMA = 2;

async function crearCajasAleatorias(cantidad) {
  for (let i = 0; i < cantidad; i++) {
    let posicionValida = false;
    let x, z;
    let intentos = 0;
    const maxIntentos = 50;

    while (!posicionValida && intentos < maxIntentos) {
      x = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);
      z = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);

      posicionValida = true;
      for (const pos of posicionesUsadas) {
        const distancia = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(z - pos.z, 2));
        if (distancia < DISTANCIA_MINIMA) {
          posicionValida = false;
          break;
        }
      }
      intentos++;
    }

    const caja = new CLASE.Caja(scene);
    await caja.cargarObjeto();

    if (caja.refObjeto) {
      caja.refObjeto.position.set(x, -0.2, z);
      caja.refObjeto.scale.setScalar(0.009);
      caja.refObjeto.rotation.y = Math.random() * Math.PI * 2;
    }

    cajas.push(caja);
    posicionesUsadasCajas.push({ x, z });

    console.log(`Caja ${i + 1} creada en posición (${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
}

// Sistema de controles
function setupControls() {
  // Crear UI para controles
  const controlsDiv = document.createElement('div');
  controlsDiv.style.position = 'absolute';
  controlsDiv.style.top = '10px';
  controlsDiv.style.left = '10px';
  controlsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  controlsDiv.style.color = 'white';
  controlsDiv.style.padding = '15px';
  controlsDiv.style.fontFamily = 'monospace';
  controlsDiv.style.fontSize = '12px';
  controlsDiv.style.borderRadius = '5px';
  controlsDiv.style.zIndex = '1000';

  controlsDiv.innerHTML = `
    <h3 style="margin: 0 0 10px 0;">Controles del Jardín</h3>
    <div><strong>R</strong> - Modo Riego (Click para regar)</div>
    <div><strong>I</strong> - Mostrar Info de Macetas</div>
    <div><strong>H</strong> - Toggle Hitboxes</div>
    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #555;">
      <div id="modoActual">Modo: Normal</div>
    </div>
  `;

  document.body.appendChild(controlsDiv);

  // Eventos de teclado
  window.addEventListener('keydown', (e) => {
    const modoDiv = document.getElementById('modoActual');

    switch (e.key.toLowerCase()) {
      case 'r':
        modoRiego = !modoRiego;
        modoDiv.textContent = modoRiego ? 'Modo: RIEGO (Click en macetas)' : 'Modo: Normal';
        break;

      case 'i':
        mostrarInfoMacetas();
        break;

      case 'h':
        toggleHitboxes();
        break;
    }
  });

  // Click para regar
  window.addEventListener('click', (e) => {
    if (modoRiego) {
      const maceta = detectarMacetaClick(e);
      if (maceta) {
        maceta.regar(30);
      }
    }
  });
}

function detectarMacetaClick(event) {
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // Buscar intersección con macetas
  for (const maceta of macetas) {
    if (!maceta.refObjeto) continue;

    const intersects = raycaster.intersectObject(maceta.refObjeto, true);
    if (intersects.length > 0) {
      return maceta;
    }
  }

  return null;
}

function mostrarInfoMacetas() {
  console.log('\n=== INFO DE MACETAS ===');
  macetas.forEach((maceta, i) => {
    console.log(`\nMaceta ${i + 1}:`);
    console.log(`  Posición: (${maceta.x?.toFixed(2)}, ${maceta.z?.toFixed(2)})`);
    console.log(`  Humedad: ${maceta.humedadAgua.toFixed(1)}%`);
    console.log(`  Sol: ${maceta.cantidadSol.toFixed(1)}%`);
    console.log(`  Reducción luz: ${(maceta.reduccionLuz * 100).toFixed(0)}%`);
    console.log(`  Iteraciones: ${maceta.iteraciones}/${maceta.maxIteraciones}`);
    console.log(`  Vecinos: ${maceta.vecinosCercanos.length}`);
  });
}

function toggleHitboxes() {
  macetas.forEach(maceta => {
    if (maceta.hitboxHelper) {
      maceta.hitboxHelper.visible = !maceta.hitboxHelper.visible;
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  cameraMovement.update();

  // Animar todas las macetas
  macetas.forEach((maceta) => {
    if (maceta && maceta.isLoaded && maceta.refObjeto) {
      maceta.refObjeto.rotation.y = 0.005;

      // Actualizar sistema de crecimiento
      maceta.update(delta);
    }
  });

  if (piso && piso.isLoaded && piso.refObjeto) {
    piso.refObjeto.position.y = -4.8;
  }

  // Animación del sol y la luna
  const orbitDuration = 24;
  const orbitRadius = 50;

  if (sun && sun.isLoaded && sun.refObjeto) {
    const angularSpeed = (Math.PI * 2) / orbitDuration;
    const angle = (Date.now() / 1000) * angularSpeed;

    // Movimiento del sol
    sun.refObjeto.position.x = Math.cos(angle) * orbitRadius;
    sun.refObjeto.position.y = Math.sin(angle) * orbitRadius;

    // Movimiento de la luna (órbita opuesta)
    if (moon && moon.isLoaded && moon.refObjeto) {
      moon.refObjeto.position.x = Math.cos(angle + Math.PI) * orbitRadius;
      moon.refObjeto.position.y = Math.sin(angle + Math.PI) * orbitRadius;
      moon.refObjeto.rotation.y += 0.001;

      // Controlar intensidad de luz de la luna
      const moonLight = moon.refObjeto.children.find(child => child.isDirectionalLight);
      if (moonLight) {
        const moonHeight = moon.refObjeto.position.y;
        const transitionStart = -5;
        const transitionEnd = 5;

        const t = THREE.MathUtils.clamp(
          (moonHeight - transitionStart) / (transitionEnd - transitionStart),
          0,
          1
        );

        // La luna brilla más cuando está arriba (durante la noche)
        moonLight.intensity = THREE.MathUtils.smoothstep(t, 0, 1) * 2.8;
      }
    }

    // Actualizar color de luz ambiente según altura del sol
    const sunHeight = sun.refObjeto.position.y;
    const normalizedHeight = (sunHeight + orbitRadius) / (orbitRadius * 2); // 0 a 1

    let ambientColor;
    let ambientIntensity;
    let skyColor;

    if (normalizedHeight > 0.7) {
      // DÍA (Sol alto) - Azul cielo brillante
      const t = (normalizedHeight - 0.7) / 0.3;
      ambientColor = new THREE.Color(0x87CEEB).lerp(new THREE.Color(0xADD8E6), t);
      ambientIntensity = 1.5 + (t * 0.5);
      skyColor = new THREE.Color(0x87CEEB).lerp(new THREE.Color(0x87CEEB), t);

    } else if (normalizedHeight > 0.45) {
      // TARDE/ATARDECER - Transición a naranja
      const t = (normalizedHeight - 0.45) / 0.25;
      ambientColor = new THREE.Color(0xFF8C42).lerp(new THREE.Color(0x87CEEB), t);
      ambientIntensity = 1.0 + (t * 0.5);
      skyColor = new THREE.Color(0xFF6B35).lerp(new THREE.Color(0x87CEEB), t);

    } else if (normalizedHeight > 0.3) {
      // CREPÚSCULO - Naranja oscuro
      const t = (normalizedHeight - 0.3) / 0.15;
      ambientColor = new THREE.Color(0xCC5500).lerp(new THREE.Color(0xFF8C42), t);
      ambientIntensity = 0.5 + (t * 0.5);
      skyColor = new THREE.Color(0x8B4513).lerp(new THREE.Color(0xFF6B35), t);

    } else {
      // NOCHE - Azul marino oscuro
      const t = normalizedHeight / 0.3;
      ambientColor = new THREE.Color(0x0A1929).lerp(new THREE.Color(0xCC5500), t);
      ambientIntensity = 0.3 + (t * 0.2);
      skyColor = new THREE.Color(0x001529).lerp(new THREE.Color(0x8B4513), t);
    }

    // Aplicar colores
    if (window.ambientLight) {
      window.ambientLight.color.copy(ambientColor);
      window.ambientLight.intensity = ambientIntensity;
    }

    scene.background = skyColor;

    // Actualizar cantidad de sol en todas las macetas
    const sunPosition = sun.refObjeto.position;
    macetas.forEach(maceta => {
      maceta.calcularSol(sunPosition);
    });

    const sunLight = sun.refObjeto.children.find(child => child.isDirectionalLight);
    if (sunLight) {
      const height = sun.refObjeto.position.y;

      const transitionStart = -5;
      const transitionEnd = 5;

      const t = THREE.MathUtils.clamp(
        (height - transitionStart) / (transitionEnd - transitionStart),
        0,
        1
      );

      sunLight.intensity = THREE.MathUtils.smoothstep(t, 0, 1) * 3;
    }

    sun.refObjeto.rotation.y += 0.001;
  }

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.render(scene, camera);
}

init();