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

export class Maceta extends Objeto3D {
    constructor(scene) {
        const path = 'objetos3D/maceta/maceta.fbx';
        super(scene, path) //object tiene la referencia al objeto que necesito
        this.humedadAgua = 100;
        this.cantidadSol = 0;
        this.x = null;
        this.z = null;
    }
    actualizarPosicion(x, z) {
        this.x = x;
        this.z = z;
        return this
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
        return this
    }
}

export class Sol extends Objeto3D {

    constructor(scene) {
        const path = 'objetos3D/sol/sol.fbx';
        super(scene, path);

    }

}