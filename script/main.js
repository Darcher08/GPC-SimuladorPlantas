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


// variable para el sol como objeto
let sun;
//crear variables que sea una luz dirigida en el mismo sentido que el sol


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
  camera.position.set(0, 12, 25); // Altura de ojos humanos + alejado del cubo
  camera.lookAt(0, 0, 0);
  // 3. Configurar el renderizador
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 4. Instanciar el control de cámara
  cameraMovement = new CameraMovement(camera, document.body);

  // 5. Añadir luces 0xffffff 0x404040
  const ambientLight = new THREE.AmbientLight(0xffffff, 2); // Más oscuro
  scene.add(ambientLight);


  // Cargar todos los objetos a la escena
  //* MACETAS - Crear múltiples instancias
  const numMacetas = 5;
  await crearMacetasAleatorias(numMacetas);

  const numCajas = Math.ceil(numMacetas / 2);
  await crearCajasAleatorias(numCajas);

  //* PISO
  piso = new CLASE.RocaPiso(scene);
  await piso.cargarObjeto();

  //* SOL

  sun = new CLASE.Sol(scene);
  await sun.cargarObjeto();
  sun.refObjeto.position.set(0, 40, 0);
  sun.refObjeto.scale.setScalar(0.09);

  // SOLUCIÓN: El sol no debe proyectar ni recibir sombras
  sun.refObjeto.castShadow = false;
  sun.refObjeto.receiveShadow = false;
  sun.refObjeto.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  // Crear la luz direccional del sol
  const sunLight = new THREE.DirectionalLight(0xF28B16, 3); // Color cálido y brillante
  sunLight.castShadow = true; // Si quieres sombras

  // Configurar sombras (opcional pero recomendado)
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 150;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;

  // Añadir la luz como hijo del sol para que se mueva con él
  sun.refObjeto.add(sunLight);

  // La luz apuntará hacia abajo desde el sol
  sunLight.position.set(0, 0, 0); // Posición relativa al sol
  sunLight.target.position.set(0, -40, 0); // Apunta hacia abajo
  sun.refObjeto.add(sunLight.target); // Importante: agregar el target como hijo también

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

  // Define el tiempo de órbita en segundos
  const orbitDuration = 24; // t segundos para completar una vuelta
  const orbitRadius = 50; // Radio de la órbita (ajusta según tu escena)

  // En tu función de animación (donde tienes delta time)
  if (sun && sun.isLoaded && sun.refObjeto) {
    // Calcula el ángulo basado en el tiempo
    const angularSpeed = (Math.PI * 2) / orbitDuration; // radianes por segundo
    const angle = (Date.now() / 1000) * angularSpeed; // ángulo actual

    // Actualiza la posición para orbitar
    sun.refObjeto.position.x = Math.cos(angle) * orbitRadius;
    sun.refObjeto.position.y = Math.sin(angle) * orbitRadius;
    const sunLight = sun.refObjeto.children.find(child => child.isDirectionalLight);
    if (sunLight) {
      const height = sun.refObjeto.position.y;

      // Define el rango donde ocurre la transición
      const transitionStart = -5;  // Empieza a apagarse aquí
      const transitionEnd = 5;     // Totalmente encendido aquí

      // Normalizar entre 0 y 1
      const t = THREE.MathUtils.clamp(
        (height - transitionStart) / (transitionEnd - transitionStart),
        0,
        1
      );

      // smoothstep hace la transición más natural (curva S)
      sunLight.intensity = THREE.MathUtils.smoothstep(t, 0, 1);
    }
    // Opcional: rota el sol sobre sí mismo
    sun.refObjeto.rotation.y += 0.001;
  }

  // Renderizar la escena
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves
  renderer.render(scene, camera);
}

// Iniciar la aplicación
init();