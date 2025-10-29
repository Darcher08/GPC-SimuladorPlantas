import * as THREE from 'three';

export class CameraMovement {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;

        // Configuración de movimiento
        this.moveSpeed = 0.1;
        this.lookSpeed = 0.002;

        // Estado de teclas
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        // Rotación de cámara
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.euler.setFromQuaternion(camera.quaternion);

        // Bloqueo de puntero
        this.isLocked = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Click para activar controles
        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });

        // Eventos de pointer lock
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.domElement;
            const instructions = document.getElementById('instructions');
            if (this.isLocked) {
                instructions.classList.add('hidden');
            } else {
                instructions.classList.remove('hidden');
            }
        });

        // Movimiento del mouse
        document.addEventListener('mousemove', (event) => {
            if (!this.isLocked) return;

            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;

            this.euler.y -= movementX * this.lookSpeed;
            this.euler.x -= movementY * this.lookSpeed;

            // Limitar rotación vertical
            this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
        });

        // Teclas
        document.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'KeyW': this.keys.forward = true; break;
                case 'KeyS': this.keys.backward = true; break;
                case 'KeyA': this.keys.left = true; break;
                case 'KeyD': this.keys.right = true; break;
                case 'Escape': document.exitPointerLock(); break;
            }
        });

        document.addEventListener('keyup', (event) => {
            switch (event.code) {
                case 'KeyW': this.keys.forward = false; break;
                case 'KeyS': this.keys.backward = false; break;
                case 'KeyA': this.keys.left = false; break;
                case 'KeyD': this.keys.right = false; break;
            }
        });
    }

    update() {
        if (!this.isLocked) return;

        // Actualizar rotación de cámara
        this.camera.quaternion.setFromEuler(this.euler);

        // Vector de dirección
        const direction = new THREE.Vector3();

        if (this.keys.forward) {
            direction.z -= 1;
        }
        if (this.keys.backward) {
            direction.z += 1;
        }
        if (this.keys.left) {
            direction.x -= 1;
        }
        if (this.keys.right) {
            direction.x += 1;
        }

        // Normalizar para movimiento diagonal consistente
        if (direction.length() > 0) {
            direction.normalize();

            // Aplicar movimiento relativo a la rotación de la cámara
            direction.applyQuaternion(this.camera.quaternion);

            this.camera.position.addScaledVector(direction, this.moveSpeed);
        }
    }
}