import * as THREE from 'three';
import { CameraMovement } from './camera.js';
import { loadFBX } from './objectLoader.js';
import * as CLASE from './clases_objetos3d.js';

let scene, camera, renderer, cameraMovement;
let cube, mixer;
let clock = new THREE.Clock();
let piso;

const posicionesUsadas = []; //para llevar cuenta de las macetas
let macetas = []; // Cambiado a array para múltiples macetas

let cajas = [];
const posicionesUsadasCajas = [];

// Configuración del grid
const GRID_SIZE = 20;
const GRID_HALF = GRID_SIZE / 2;

async function init() {
  // 1. Configurar la escena
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Color cielo

  // definir grid de ayuda, para posicionar objetos con un mejor orden
  const DIVISIONS = 10;
  const _colorCenterLine = 0xff0000;
  const _colorGrid = 0xE6E6E6;

  // agregar un grid visual para que sea mas facil posicionar los objetos
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
  camera.position.set(0, 12, 15); // Altura de ojos humanos + alejado del cubo
  camera.lookAt(0, 0, 0);
  // 3. Configurar el renderizador
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 4. Instanciar el control de cámara
  cameraMovement = new CameraMovement(camera, document.body);

  // 5. Añadir luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.1);
  directionalLight.position.set(0, 0, -10);
  scene.add(directionalLight);

  // Cargar todos los objetos a la escena
  //* MACETAS - Crear múltiples instancias
  const numMacetas = 5;
  await crearMacetasAleatorias(numMacetas);

  const numCajas = Math.ceil(numMacetas / 2);
  await crearCajasAleatorias(numCajas);

  //* PISO
  piso = new CLASE.RocaPiso(scene);
  await piso.cargarObjeto();

  // 9. Manejar redimensionamiento de ventana
  window.addEventListener('resize', onWindowResize);

  // 10. Iniciar animación
  animate();
}

// Función para crear macetas en posiciones aleatorias
async function crearMacetasAleatorias(cantidad) {

  const distanciaMinima = 2; // Distancia mínima entre macetas

  for (let i = 0; i < cantidad; i++) {
    let posicionValida = false;
    let x, z;
    let intentos = 0;
    const maxIntentos = 50;

    // Buscar una posición que no esté muy cerca de otras macetas
    while (!posicionValida && intentos < maxIntentos) {
      // Generar posición aleatoria dentro del grid
      x = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);
      z = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);

      // Verificar que no esté muy cerca de otras macetas
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

    // Crear la maceta
    const maceta = new CLASE.Maceta(scene);
    await maceta.cargarObjeto();

    // Posicionar la maceta
    if (maceta.refObjeto) {
      maceta.refObjeto.position.set(x, 0, z);
      // Rotación aleatoria en Y para variedad
      maceta.actualizarPosicion(x, z);
      maceta.refObjeto.rotation.y = Math.random() * Math.PI * 2;
    }

    macetas.push(maceta);
    posicionesUsadas.push({ x, z });

    console.log(`Maceta ${i + 1} creada en posición (${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
}

const DISTANCIA_MINIMA = 2;
// Función para crear cajas en posiciones aleatorias
async function crearCajasAleatorias(cantidad) {

  for (let i = 0; i < cantidad; i++) {
    let posicionValida = false;
    let x, z;
    let intentos = 0;
    const maxIntentos = 50;

    // Buscar una posición que no esté muy cerca de otros objetos
    while (!posicionValida && intentos < maxIntentos) {
      // Generar posición aleatoria dentro del grid
      x = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);
      z = Math.random() * (GRID_SIZE - 2) - (GRID_HALF - 1);

      // Verificar que no esté muy cerca de otros objetos
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

    // Crear la caja
    const caja = new CLASE.Caja(scene);
    await caja.cargarObjeto();

    // Posicionar la caja
    if (caja.refObjeto) {
      caja.refObjeto.position.set(x, -0.2, z);
      // Rotación aleatoria en Y para variedad
      caja.refObjeto.scale.setScalar(0.009);
      caja.refObjeto.rotation.y = Math.random() * Math.PI * 2;
    }

    cajas.push(caja);
    posicionesUsadasCajas.push({ x, z });

    console.log(`Caja ${i + 1} creada en posición (${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
}

// FUNCION PARA CONTROLAR AL OBJETO EN ESCENA
function setupObjectControls() {
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Actualizar animaciones FBX
  //if (mixer) mixer.update(delta);

  // Actualizar movimiento de cámara
  cameraMovement.update();

  // Animar todas las macetas
  macetas.forEach((maceta) => {
    if (maceta && maceta.isLoaded && maceta.refObjeto) {
      maceta.refObjeto.rotation.y += 0.005;
    }
  });

  if (piso && piso.isLoaded && piso.refObjeto) {
    piso.refObjeto.position.y = -4.8;
  }

  // Renderizar la escena
  renderer.render(scene, camera);
}

// Iniciar la aplicación
init();