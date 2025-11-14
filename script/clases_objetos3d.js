import * as THREE from 'three';
import { loadFBX } from './objectLoader.js';

//La base de todo objeto 3D
export class Objeto3D {
    constructor(scene, path) {
        this.path = path
        this.refObjeto = null;
        this.mixer = null;
        this.scene = scene;
        this.isLoaded = false;
    }
    async cargarObjeto() {
        try {
            const result = await loadFBX(this.scene, {
                filePath: this.path
            });
            this.refObjeto = result.object;
            this.mixer = result.mixer;
            this.isLoaded = true;
            console.log(result.info);
            console.log('Objeto FBX cargado:', this.refObjeto);
            return this
        } catch (error) {
            console.error('Error al cargar el modelo', error);
            throw error;
        }
    }
}

// Clase para el sistema L-System de crecimiento
class LSystem {
    constructor() {
        this.axiom = 'F';
        this.rules = {
            'F': 'FF+[+F-F-F]-[-F+F+F]' // Regla de ramificación
        };
        this.angle = 25; // Ángulo de ramificación en grados
    }

    generate(iterations, lightFactor, waterFactor) {
        let result = this.axiom;

        // Ajustar iteraciones basadas en condiciones
        const effectiveIterations = Math.floor(iterations * lightFactor * waterFactor);

        for (let i = 0; i < effectiveIterations; i++) {
            let newResult = '';
            for (let char of result) {
                newResult += this.rules[char] || char;
            }
            result = newResult;
        }

        return result;
    }
}

export class Maceta extends Objeto3D {
    constructor(scene) {
        const path = 'objetos3D/maceta/maceta.fbx';
        super(scene, path);

        // Propiedades de crecimiento
        this.humedadAgua = 100; // 0-100
        this.cantidadSol = 0; // 0-100
        this.x = null;
        this.z = null;

        // Sistema de crecimiento
        this.lSystem = new LSystem();
        this.plantGroup = null;
        this.iteraciones = 0;
        this.maxIteraciones = 4;
        this.tiempoUltimoCrecimiento = Date.now();
        this.tiempoCrecimiento = 5000; // 5 segundos entre crecimientos

        // Sistema de hojas
        this.hojasGroup = null;
        this.hojasGeneradas = false;
        this.puntosRamas = []; // Guardar posiciones de las ramas para colocar hojas
        this.hojas = []; // Instancias de hojas

        // Hitbox
        this.hitbox = null;
        this.hitboxHelper = null;

        // Vecinos (para reducción de luz)
        this.vecinosCercanos = [];
        this.reduccionLuz = 0;
    }

    async cargarObjeto() {
        await super.cargarObjeto();

        if (this.refObjeto) {
            // Crear hitbox
            this.crearHitbox();

            // Crear grupo para la planta
            this.plantGroup = new THREE.Group();
            this.refObjeto.add(this.plantGroup);
            this.plantGroup.position.y = 22.5; // Posición inicial de la planta

            // Crear grupo para las hojas
            this.hojasGroup = new THREE.Group();
            this.plantGroup.add(this.hojasGroup);
        }

        return this;
    }

    crearHitbox() {
        // Crear una caja de colisión cilíndrica aproximada
        const radius = 0.4;
        const height = 1.0;

        this.hitbox = new THREE.Box3();
        this.actualizarHitbox();

        // Visualizador de hitbox (opcional, para debug)
        const size = new THREE.Vector3();
        this.hitbox.getSize(size);
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        this.hitboxHelper = new THREE.Mesh(geometry, material);
        this.hitboxHelper.visible = false; // Cambiar a true para ver hitboxes
        this.refObjeto.add(this.hitboxHelper);
    }

    actualizarHitbox() {
        if (!this.refObjeto) return;

        const worldPos = new THREE.Vector3();
        this.refObjeto.getWorldPosition(worldPos);

        const radius = 0.4;
        const height = 1.0 + (this.iteraciones * 0.5);

        this.hitbox.setFromCenterAndSize(
            new THREE.Vector3(worldPos.x, worldPos.y + height, worldPos.z),
            new THREE.Vector3(20, 50, 20)
        );
    }

    actualizarPosicion(x, z) {
        this.x = x;
        this.z = z;
        return this;
    }

    // Sistema de riego
    regar(cantidad = 30) {
        this.humedadAgua = Math.min(100, this.humedadAgua + cantidad);
        console.log(`Maceta regada. Humedad: ${this.humedadAgua.toFixed(1)}%`);
    }

    // Actualizar cantidad de sol (llamar desde main)
    calcularSol(sunPosition) {
        if (!this.refObjeto) return;

        const plantPos = new THREE.Vector3();
        this.refObjeto.getWorldPosition(plantPos);

        // Calcular distancia al sol
        const distancia = plantPos.distanceTo(sunPosition);

        // Calcular intensidad basada en altura del sol (y)
        let intensidad = 0;
        if (sunPosition.y > 0) {
            // Sol está "arriba", dar luz proporcional a su altura
            intensidad = Math.min(100, (sunPosition.y / 50) * 100);
        }

        // Aplicar reducción por vecinos
        intensidad *= (1 - this.reduccionLuz);

        this.cantidadSol = Math.max(0, Math.min(100, intensidad));
    }

    // Calcular vecinos cercanos y reducción de luz
    calcularVecinos(todasLasMacetas, cajas) {
        if (!this.refObjeto) return;

        this.vecinosCercanos = [];
        this.reduccionLuz = 0;

        const miPos = new THREE.Vector3(this.x, 0, this.z);
        const distanciaVecino = 3; // Distancia para considerar vecino

        // Direcciones cardinales
        const direcciones = [
            { nombre: 'norte', vector: new THREE.Vector3(0, 0, -1) },
            { nombre: 'sur', vector: new THREE.Vector3(0, 0, 1) },
            { nombre: 'este', vector: new THREE.Vector3(1, 0, 0) },
            { nombre: 'oeste', vector: new THREE.Vector3(-1, 0, 0) }
        ];

        // Revisar macetas vecinas
        todasLasMacetas.forEach(otraMaceta => {
            if (otraMaceta === this || !otraMaceta.x) return;

            const otraPos = new THREE.Vector3(otraMaceta.x, 0, otraMaceta.z);
            const distancia = miPos.distanceTo(otraPos);

            if (distancia < distanciaVecino) {
                const direccion = otraPos.clone().sub(miPos).normalize();

                // Determinar en qué dirección cardinal está
                direcciones.forEach(dir => {
                    const angulo = direccion.angleTo(dir.vector);
                    if (angulo < Math.PI / 4) { // 45 grados
                        this.vecinosCercanos.push({
                            objeto: otraMaceta,
                            direccion: dir.nombre
                        });
                        this.reduccionLuz += 0.15; // 15% por vecino
                    }
                });
            }
        });

        // Revisar cajas vecinas (sombra más fuerte)
        cajas.forEach(caja => {
            if (!caja.x) return;

            const cajaPos = new THREE.Vector3(caja.x, 0, caja.z);
            const distancia = miPos.distanceTo(cajaPos);

            if (distancia < distanciaVecino) {
                this.reduccionLuz += 0.25; // 25% por caja
            }
        });

        // Limitar reducción máxima
        this.reduccionLuz = Math.min(0.8, this.reduccionLuz); // Máximo 80%
    }

    // Sistema de crecimiento
    update(deltaTime) {
        if (!this.isLoaded || !this.plantGroup) return;

        // Consumir humedad gradualmente
        this.humedadAgua = Math.max(0, this.humedadAgua - deltaTime * 0.5);

        // Actualizar hitbox
        this.actualizarHitbox();

        // Verificar si es tiempo de crecer
        const tiempoActual = Date.now();
        if (tiempoActual - this.tiempoUltimoCrecimiento > this.tiempoCrecimiento) {
            this.intentarCrecer();
            this.tiempoUltimoCrecimiento = tiempoActual;
        }

        // Si llegó al máximo y no ha generado hojas, generarlas
        if (this.iteraciones >= this.maxIteraciones && !this.hojasGeneradas) {
            this.generarHojas();
        }
    }

    intentarCrecer() {
        if (this.iteraciones >= this.maxIteraciones) return;

        // Factores de crecimiento (0-1)
        const factorAgua = this.humedadAgua / 100;
        const factorSol = this.cantidadSol / 100;

        // Requiere mínimos para crecer
        if (factorAgua < 0.5 || factorSol < 0.2) {
            console.log(`No hay suficiente agua (${(factorAgua * 100).toFixed(0)}%) o sol (${(factorSol * 100).toFixed(0)}%) para crecer`);
            return;
        }

        // Calcular factor de crecimiento combinado
        const factorCrecimiento = (factorAgua * 0.6 + factorSol * 0.4);

        // Probabilidad de crecer basada en condiciones
        if (Math.random() < factorCrecimiento) {
            this.iteraciones++;
            this.generarPlanta();
            console.log(`¡Planta creció! Iteración: ${this.iteraciones}, Factor: ${(factorCrecimiento * 100).toFixed(0)}%`);
        }
    }

    generarPlanta() {
        // Limpiar planta anterior
        while (this.plantGroup.children.length > 0) {
            const child = this.plantGroup.children[0];
            if (child !== this.hojasGroup) {
                this.plantGroup.remove(child);
            } else {
                break;
            }
        }

        // Reiniciar puntos de ramas
        this.puntosRamas = [];

        // Generar string L-System
        const factorAgua = this.humedadAgua / 100;
        const factorSol = this.cantidadSol / 100;
        const lString = this.lSystem.generate(this.iteraciones, factorSol, factorAgua);

        // Interpretar y renderizar
        this.interpretarLSystem(lString, factorAgua, factorSol);
    }

    interpretarLSystem(lString, factorAgua, factorSol) {
        const stack = [];
        const angleRad = THREE.MathUtils.degToRad(this.lSystem.angle);

        // Parámetros de la rama (ajustados por condiciones)
        const longitudBase = 1.3 * (0.7 + factorAgua * 0.3);
        const grosorBase = 1 * (0.8 + factorSol * 0.2);

        // Estado actual del dibujo
        let posicion = new THREE.Vector3(0, 0, 0);
        let direccion = new THREE.Vector3(0, 1, 0);
        let grosor = grosorBase;

        for (let i = 0; i < lString.length; i++) {
            const char = lString[i];

            switch (char) {
                case 'F':
                    // Dibujar rama
                    const longitud = longitudBase * (0.9 + Math.random() * 0.2);
                    const nuevaPosicion = posicion.clone().add(
                        direccion.clone().multiplyScalar(longitud)
                    );

                    this.crearRama(posicion, nuevaPosicion, grosor, factorSol);

                    // Guardar punto para posible hoja
                    this.puntosRamas.push({
                        posicion: nuevaPosicion.clone(),
                        direccion: direccion.clone(),
                        grosor: grosor
                    });

                    posicion = nuevaPosicion;
                    grosor *= 0.7; // Reducir grosor en cada segmento
                    break;

                case '+':
                    // Rotar a la derecha
                    direccion.applyAxisAngle(new THREE.Vector3(0, 0, 1), angleRad);
                    break;

                case '-':
                    // Rotar a la izquierda
                    direccion.applyAxisAngle(new THREE.Vector3(0, 0, 1), -angleRad);
                    break;

                case '[':
                    // Guardar estado
                    stack.push({
                        posicion: posicion.clone(),
                        direccion: direccion.clone(),
                        grosor: grosor
                    });
                    break;

                case ']':
                    // Restaurar estado
                    if (stack.length > 0) {
                        const estado = stack.pop();
                        posicion = estado.posicion;
                        direccion = estado.direccion;
                        grosor = estado.grosor;
                    }
                    break;
            }
        }
    }

    crearRama(inicio, fin, grosor, factorSol) {
        const direccion = fin.clone().sub(inicio);
        const longitud = direccion.length();

        // Geometría de cilindro para la rama
        const geometry = new THREE.CylinderGeometry(
            grosor,
            grosor * 1.4,
            longitud * 1.2,
            8
        );

        // Color basado en salud (más verde con más sol)
        const colorVerde = new THREE.Color().setHSL(0.3, 0.6, 0.3 + factorSol * 0.2);
        const material = new THREE.MeshPhongMaterial({
            color: colorVerde,
            flatShading: false
        });

        const rama = new THREE.Mesh(geometry, material);

        // Posicionar y orientar
        rama.position.copy(inicio).add(direccion.multiplyScalar(0.5));
        rama.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direccion.normalize()
        );

        this.plantGroup.add(rama);
    }

    generarHojas() {
        if (this.hojasGeneradas || this.puntosRamas.length === 0) return;

        console.log('🍃 Generando hojas en la planta...');

        // Limpiar hojas anteriores
        while (this.hojasGroup.children.length > 0) {
            this.hojasGroup.remove(this.hojasGroup.children[0]);
        }
        this.hojas = [];

        // Filtrar puntos: solo usar ramas delgadas (puntas)
        const puntosParaHojas = this.puntosRamas.filter(punto => punto.grosor < 0.3);

        // Cantidad de hojas basada en la cantidad de puntos disponibles
        const cantidadHojas = Math.min(
            Math.floor(puntosParaHojas.length * 0.7), // 70% de las puntas
            50 // Máximo 50 hojas (ahora podemos más!)
        );

        // Seleccionar puntos aleatorios
        const puntosSeleccionados = [];
        for (let i = 0; i < cantidadHojas; i++) {
            const indiceAleatorio = Math.floor(Math.random() * puntosParaHojas.length);
            puntosSeleccionados.push(puntosParaHojas[indiceAleatorio]);
        }

        // Crear geometría de hoja (solo una vez, compartida)
        const hojaGeometry = this.crearGeometriaHoja();

        // Material de hoja con variaciones de color
        const tonalidades = [
            new THREE.Color(0x2d5016), // Verde oscuro
            new THREE.Color(0x3d6b1f), // Verde medio
            new THREE.Color(0x4a7c2a), // Verde claro
            new THREE.Color(0x5a8f35)  // Verde brillante
        ];

        // Crear hojas
        for (let i = 0; i < puntosSeleccionados.length; i++) {
            const punto = puntosSeleccionados[i];

            // Elegir color aleatorio
            const colorHoja = tonalidades[Math.floor(Math.random() * tonalidades.length)];

            const material = new THREE.MeshLambertMaterial({
                color: colorHoja,
                side: THREE.DoubleSide,
                flatShading: false
            });

            const hoja = new THREE.Mesh(hojaGeometry, material);

            // Posicionar la hoja
            hoja.position.copy(punto.posicion);

            // Offset aleatorio
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                Math.random() * 0.3,
                (Math.random() - 0.5) * 0.4
            );
            hoja.position.add(offset);

            // Orientar según dirección de la rama con variación
            const direccionRama = punto.direccion.clone();
            const anguloAleatorio = (Math.random() - 0.5) * Math.PI / 2;
            hoja.lookAt(hoja.position.clone().add(direccionRama));
            hoja.rotateZ(anguloAleatorio);
            hoja.rotateY((Math.random() - 0.5) * Math.PI / 3);

            // Escala aleatoria
            const escala = 0.15 + Math.random() * 0.1; // 0.15 a 0.25
            hoja.scale.setScalar(escala);

            // Añadir al grupo
            this.hojasGroup.add(hoja);
            this.hojas.push(hoja);
        }

        this.hojasGeneradas = true;
        console.log(`✅ ${this.hojas.length} hojas generadas!`);
    }

    crearGeometriaHoja() {
        // Crear forma de hoja usando Shape
        const shape = new THREE.Shape();

        // Forma de hoja ovalada/elíptica
        shape.moveTo(0, 0);

        // Lado derecho de la hoja
        shape.bezierCurveTo(
            0.5, 0.2,   // punto control 1
            0.7, 0.8,   // punto control 2
            0, 1.5      // punto final
        );

        // Lado izquierdo de la hoja
        shape.bezierCurveTo(
            -0.7, 0.8,  // punto control 1
            -0.5, 0.2,  // punto control 2
            0, 0        // punto final (cierra)
        );

        const geometry = new THREE.ShapeGeometry(shape);
        return geometry;
    }
}

export class RocaPiso extends Objeto3D {
    constructor(scene) {
        const path = 'objetos3D/rocaPiso/rocaPiso.fbx';
        super(scene, path);
    }
}

export class Caja extends Objeto3D {
    constructor(scene) {
        const path = 'objetos3D/caja/box_wood.fbx';
        super(scene, path);
        this.x = null;
        this.z = null;
    }
    actualizarPosicion(x, z) {
        this.x = x;
        this.z = z;
        return this;
    }
}

export class Sol extends Objeto3D {
    constructor(scene) {
        const path = 'objetos3D/sol/sol.fbx';
        super(scene, path);
    }
}

export class Luna extends Objeto3D {
    constructor(scene) {
        const path = 'objetos3D/luna/moon.fbx';
        super(scene, path);
    }

}

export class Hoja extends Objeto3D {
    constructor(scene) {
        const path = 'objetos3D/hoja/hoja.fbx';
        super(scene, path)
    }

}